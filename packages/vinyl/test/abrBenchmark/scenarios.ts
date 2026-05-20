/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Network bandwidth profiles for ABR benchmark scenarios.
 *
 * Each profile is a function of elapsed time (seconds) returning
 * { downloadThroughput, uploadThroughput, latency, offline }.
 * Throughput is in bytes/sec, latency in ms.
 */

export interface NetworkCondition {
    readonly downloadThroughput: number // bytes/sec
    readonly uploadThroughput: number // bytes/sec
    readonly latency: number // ms
    readonly offline: boolean
}

export interface Scenario {
    readonly name: string
    readonly description: string
    /** Optional override for the hard timeout (seconds). Defaults to 120. */
    readonly timeoutSeconds?: number
    /**
     * When true, this scenario is only run when explicitly requested via
     * `--scenario <name>`; it is excluded from the default "run all" set.
     */
    readonly optional?: boolean
    /**
     * Returns network conditions at the given elapsed time (seconds).
     * `rng` is a seeded RNG (mulberry32) for scenarios that need randomness.
     */
    getCondition(elapsedSeconds: number, rng: () => number): NetworkCondition
}

function mbps(megabits: number): number {
    return (megabits * 1_000_000) / 8
}

function kbps(kilobits: number): number {
    return (kilobits * 1_000) / 8
}

/** Draw a number from [min, max). */
function range(rng: () => number, min: number, max: number): number {
    return min + rng() * (max - min)
}

/**
 * Generic phase schedule: a list of contiguous phases, each with a duration
 * and arbitrary payload. Phases repeat via modulo so scenarios of any length
 * are covered.
 */
interface Phase<T> {
    duration: number
    payload: T
}

interface PhaseSchedule<T> {
    phases: Phase<T>[]
    totalDuration: number
}

function makeSchedule<T>(phases: Phase<T>[]): PhaseSchedule<T> {
    return {
        phases,
        totalDuration: phases.reduce((acc, p) => acc + p.duration, 0),
    }
}

function phaseAt<T>(schedule: PhaseSchedule<T>, elapsed: number): T {
    const t = elapsed % schedule.totalDuration
    let cursor = 0
    for (const phase of schedule.phases) {
        cursor += phase.duration
        if (t < cursor) return phase.payload
    }
    // Fallback for floating point edge case at exact boundary.
    return schedule.phases[schedule.phases.length - 1].payload
}

/**
 * Cache schedules per rng instance so that randomized phase durations are
 * drawn once (from the rng's first few samples) and reused across all
 * `getCondition` calls within a scenario run.
 */
const wifiTo4gCache = new WeakMap<
    () => number,
    PhaseSchedule<{ bandwidth: number; latency: number }>
>()

function getWifiTo4gSchedule(rng: () => number) {
    let schedule = wifiTo4gCache.get(rng)
    if (!schedule) {
        // Three wifi/4g cycles with independent durations and bandwidths,
        // giving a varied but deterministic-per-seed profile.
        const phases: Phase<{ bandwidth: number; latency: number }>[] = []
        for (let i = 0; i < 3; i++) {
            phases.push({
                duration: range(rng, 8, 22),
                payload: {
                    bandwidth: mbps(range(rng, 5, 12)),
                    latency: range(rng, 10, 35),
                },
            })
            phases.push({
                duration: range(rng, 8, 22),
                payload: {
                    bandwidth: kbps(range(rng, 250, 600)),
                    latency: range(rng, 100, 250),
                },
            })
        }
        schedule = makeSchedule(phases)
        wifiTo4gCache.set(rng, schedule)
    }
    return schedule
}

const outageCache = new WeakMap<
    () => number,
    PhaseSchedule<{ stalled: boolean }>
>()

function getOutageSchedule(rng: () => number) {
    let schedule = outageCache.get(rng)
    if (!schedule) {
        // Alternating healthy / stalled windows. Outages are long (20–40s)
        // to guarantee the buffer drains and the engine must actually
        // recover from a stall — short outages would just be absorbed by
        // whatever buffer happened to be filled, making scores a coin flip.
        const phases: Phase<{ stalled: boolean }>[] = []
        for (let i = 0; i < 4; i++) {
            phases.push({
                duration: range(rng, 6, 10),
                payload: { stalled: false },
            })
            phases.push({
                duration: range(rng, 20, 40),
                payload: { stalled: true },
            })
        }
        schedule = makeSchedule(phases)
        outageCache.set(rng, schedule)
    }
    return schedule
}

const stableLowCondition: NetworkCondition = {
    downloadThroughput: kbps(500),
    uploadThroughput: kbps(250),
    latency: 80,
    offline: false,
}

export const scenarios: Scenario[] = [
    {
        name: 'force-rebuffer',
        description:
            'Sustained 40 kbps — well below any sensible audio rendition; guarantees rebuffers',
        optional: true,
        getCondition: () => ({
            downloadThroughput: kbps(40),
            uploadThroughput: kbps(40),
            latency: 200,
            offline: false,
        }),
    },
    {
        name: 'stable-high',
        description: 'Steady 10 Mbps, 20ms latency',
        getCondition: () => ({
            downloadThroughput: mbps(10),
            uploadThroughput: mbps(5),
            latency: 20,
            offline: false,
        }),
    },
    {
        name: 'stable-low',
        description: 'Steady 500 Kbps, 80ms latency',
        getCondition: () => stableLowCondition,
    },
    {
        name: 'wifi-to-4g',
        description:
            'Alternates between ~8 Mbps wifi and ~400 Kbps slow 4G with randomized phase durations',
        getCondition: (elapsed, rng) => {
            const schedule = getWifiTo4gSchedule(rng)
            const phase = phaseAt(schedule, elapsed)
            return {
                downloadThroughput: phase.bandwidth,
                uploadThroughput: phase.bandwidth / 2,
                latency: phase.latency,
                offline: false,
            }
        },
    },
    {
        name: 'outage',
        description:
            'Healthy windows punctuated by stalls (online but unresponsive) with randomized durations',
        timeoutSeconds: 180,
        getCondition: (elapsed, rng) => {
            const schedule = getOutageSchedule(rng)
            const phase = phaseAt(schedule, elapsed)
            return {
                downloadThroughput: mbps(1),
                uploadThroughput: mbps(1),
                latency: phase.stalled ? Number.MAX_SAFE_INTEGER : 30,
                offline: false,
            }
        },
    },
    {
        name: 'noisy-mobile',
        description:
            'Realistic mobile: 500 Kbps mean with ±50% noise, occasional dropouts and latency spikes',
        getCondition: (elapsed, rng) => {
            // Short outage window (~2% chance per second, 3s long).
            const inOutage = Math.floor(elapsed / 3) % 50 === 7
            if (inOutage) {
                return {
                    downloadThroughput: 0,
                    uploadThroughput: 0,
                    latency: 0,
                    offline: true,
                }
            }
            // Log-normal-ish noise around the mean for heavier downside tail.
            const mean = kbps(500)
            const noise = (rng() - 0.5) * 2 // [-1, 1]
            const multiplier = Math.exp(noise * 0.5) // ~[0.6, 1.65]
            const bw = Math.max(kbps(80), mean * multiplier)
            const latency = 50 + rng() * 150 + (rng() < 0.05 ? 400 : 0)
            return {
                downloadThroughput: bw,
                uploadThroughput: bw / 2,
                latency,
                offline: false,
            }
        },
    },
]
