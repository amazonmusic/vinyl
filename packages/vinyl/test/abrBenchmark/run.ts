/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * ABR Benchmark Runner
 *
 * Launches Puppeteer with headless Chrome, serves the built harness page,
 * and runs each track through each network scenario, collecting scores.
 *
 * Prerequisites:
 *   npm install --no-save puppeteer commander
 *
 * Usage:
 *   npm run benchmark:abr -- [--scenario <name>] [--seed <number>] [--engine <vinyl|shaka>]
 */

import { execSync } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command, Option } from 'commander'
import { scenarios, type NetworkCondition, type Scenario } from './scenarios'
import { tracks } from './tracks'
import type { Track } from './playbackEngine'
import { calculateScore, type HarnessResult } from './scoring'
import type { AbrScoreResult, TimelineSample } from './abrScore'
import { createSeededRandom } from './seededRandom'
import {
    measureBundleLoadTimes,
    type BundleLoadTime,
    type EngineType,
} from './bundleLoadTime'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageDir = path.resolve(__dirname, '../..')
const bundleDir = path.join(packageDir, 'dist/abrBenchmark')
const resultsDir = path.join(__dirname, 'results')

interface CliOptions {
    scenarioFilter: string | null
    seed: number
    engineFilter: EngineType | null
    amend: boolean
    cont: boolean
}

function parseArgs(argv: string[]): CliOptions {
    const program = new Command()
    program
        .name('abr-benchmark')
        .option(
            '--scenario <name>',
            `run specific scenario (${scenarios.map((s) => s.name).join(', ')})`
        )
        .option('--seed <number>', 'random seed', (v) => parseInt(v, 10), 1)
        .addOption(
            new Option('--engine <type>', 'engine to run').choices([
                'vinyl',
                'shaka',
            ])
        )
        .option(
            '--amend',
            'merge runs into existing results.json instead of overwriting'
        )
        .option(
            '--continue',
            'resume, skipping (scenario, engine, track) combos already in results.json'
        )
        .parse(argv, { from: 'user' })

    const opts = program.opts()
    return {
        scenarioFilter: opts.scenario ?? null,
        seed: opts.seed,
        engineFilter: (opts.engine as EngineType | undefined) ?? null,
        amend: !!opts.amend,
        cont: !!opts.continue,
    }
}

interface NetworkChange {
    /** Seconds from scenario start at which this condition was applied. */
    time: number
    /** Bytes/second applied (0 when offline). */
    downloadThroughput: number
    /** Latency in ms applied. Very large values represent stall windows. */
    latency: number
    offline: boolean
}

interface TrackResult {
    track: Track
    scenario: string
    engine: EngineType
    score: AbrScoreResult
    timedOut: boolean
    /** Final elapsed seconds of the run. */
    endTime: number
    /** Playback event timeline from the harness. */
    timeline: Array<TimelineSample>
    /** Network conditions, one entry per change (including the initial one). */
    networkSeries: NetworkChange[]
}

interface BenchmarkResults {
    timestamp: string
    seed: number
    engines: EngineType[]
    bundleLoadTimes: BundleLoadTime[]
    results: TrackResult[]
    summary: {
        engineAverages: Record<string, number>
    }
}

function ensureBuild() {
    const bundlePath = path.join(bundleDir, 'abrBenchmark.js')
    if (!fs.existsSync(bundlePath)) {
        console.error(`Harness bundle not found at ${bundlePath}`)
        process.exit(1)
    }
}

function startLocalServer(): Promise<{ server: http.Server; port: number }> {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = req.url === '/' ? '/harness.html' : req.url!
            const filePath = path.join(bundleDir, path.basename(url))

            if (!fs.existsSync(filePath)) {
                res.writeHead(404)
                res.end(`Not found: ${url}`)
                return
            }

            const ext = path.extname(filePath)
            const contentType =
                ext === '.html'
                    ? 'text/html'
                    : ext === '.js'
                      ? 'application/javascript'
                      : ext === '.map'
                        ? 'application/json'
                        : 'application/octet-stream'

            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-store',
            })
            fs.createReadStream(filePath).pipe(res)
        })

        server.listen(0, '127.0.0.1', () => {
            const addr = server.address() as { port: number }
            resolve({ server, port: addr.port })
        })
    })
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
}

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000

async function applyCondition(
    page: any,
    cdpSession: any,
    condition: NetworkCondition
): Promise<void> {
    // Use both APIs belt-and-suspenders: Puppeteer's built-in, plus the raw
    // CDP call on our explicit session. They apply to the same underlying
    // emulation but the CDP version binds to our session deterministically.
    await page.emulateNetworkConditions({
        offline: condition.offline,
        download: condition.downloadThroughput,
        upload: condition.uploadThroughput,
        latency: condition.latency,
    })
    await cdpSession.send('Network.emulateNetworkConditions', {
        offline: condition.offline,
        downloadThroughput: condition.downloadThroughput,
        uploadThroughput: condition.uploadThroughput,
        latency: condition.latency,
    })
}

interface LiveState {
    playing: boolean
    started: boolean
    ended: boolean
    bandwidth: number | null
    maxBandwidth: number | null
    rebufferedSinceLast: boolean
}

/**
 * Maps a live state to a single progress-bar character.
 *  '·' waiting for initial playback
 *  'X' rebuffer during the last polling interval (even if already recovered)
 *  '▁▂▃▄▅▆▇█' quality blocks (low → high) scaled against max bandwidth
 *  '?' playing but quality unknown
 *  '=' ended
 */
function tickChar(s: LiveState): string {
    if (s.ended) return '='
    if (!s.started) return '·'
    if (!s.playing || s.rebufferedSinceLast) return 'X'
    if (!s.bandwidth || !s.maxBandwidth) return '?'
    const ratio = Math.min(1, s.bandwidth / s.maxBandwidth)
    const blocks = '▁▂▃▄▅▆▇█'
    const idx = Math.min(
        blocks.length - 1,
        Math.max(0, Math.floor(ratio * blocks.length))
    )
    return blocks[idx]
}

interface RunScenarioArgs {
    page: any
    cdpSession: any
    track: Track
    scenario: Scenario
    engineType: EngineType
    rng: () => number
}

async function runScenario({
    page,
    cdpSession,
    track,
    scenario,
    engineType,
    rng,
}: RunScenarioArgs): Promise<TrackResult> {
    console.log(`    [${engineType}] ${track.uri}`)

    // Set initial network conditions
    const initial = scenario.getCondition(0, rng)
    await applyCondition(page, cdpSession, initial)

    // Load and play
    await page.evaluate(
        (type: string, uri: string, engine: string) =>
            (globalThis as any).testHarness.loadAndPlay(type, uri, engine),
        track.type,
        track.uri,
        engineType
    )

    const timeoutMs =
        (scenario.timeoutSeconds ?? DEFAULT_TIMEOUT_MS / 1000) * 1000
    const startTime = Date.now()
    const networkSeries: NetworkChange[] = [
        {
            time: 0,
            downloadThroughput: initial.offline
                ? 0
                : initial.downloadThroughput,
            latency: initial.latency,
            offline: initial.offline,
        },
    ]
    let lastConditionKey = JSON.stringify(initial)
    let ended = false

    process.stdout.write('      |')
    // Drive network conditions once per second; only record on change.
    // Poll a lightweight live-state snapshot for CLI progress + end detection.
    while (Date.now() - startTime < timeoutMs) {
        await sleep(1000)

        const elapsed = (Date.now() - startTime) / 1000
        const condition = scenario.getCondition(elapsed, rng)
        const conditionKey = JSON.stringify(condition)

        if (conditionKey !== lastConditionKey) {
            await applyCondition(page, cdpSession, condition)
            lastConditionKey = conditionKey
            networkSeries.push({
                time: elapsed,
                downloadThroughput: condition.offline
                    ? 0
                    : condition.downloadThroughput,
                latency: condition.latency,
                offline: condition.offline,
            })
        }

        const live: LiveState = await page.evaluate(() =>
            (globalThis as any).testHarness.getLiveState()
        )
        process.stdout.write(tickChar(live))

        if (live.ended) {
            ended = true
            break
        }
    }
    process.stdout.write('|\n')

    const timedOut = !ended

    const harnessResult: HarnessResult = await page.evaluate(() =>
        (globalThis as any).testHarness.getResult()
    )

    await page.evaluate(() => {
        ;(globalThis as any).testHarness.stop()
    })

    // Clear network throttling
    await applyCondition(page, cdpSession, {
        offline: false,
        downloadThroughput: -1,
        uploadThroughput: -1,
        latency: 0,
    })

    const score = calculateScore(harnessResult)

    return {
        track,
        scenario: scenario.name,
        engine: engineType,
        score,
        timedOut,
        endTime: harnessResult.endTime,
        timeline: harnessResult.timeline,
        networkSeries,
    }
}

async function runAllScenarios(
    browser: any,
    port: number,
    filteredScenarios: Scenario[],
    engines: EngineType[],
    seed: number,
    doneKeys: Set<string>,
    onResult: (result: TrackResult) => void
): Promise<TrackResult[]> {
    const results: TrackResult[] = []

    for (const scenario of filteredScenarios) {
        console.log(`\nScenario: ${scenario.name} — ${scenario.description}`)
        console.log(
            '      Progress legend: ▁…█=quality (low→high), X=rebuffer, ·=startup, ==ended'
        )

        for (const engineType of engines) {
            for (const track of tracks) {
                const key = `${scenario.name}|${engineType}|${track.uri}`
                if (doneKeys.has(key)) {
                    console.log(
                        `    [${engineType}] ${track.uri} — skipped (already in results.json)`
                    )
                    continue
                }

                // Isolated browser context per run: guarantees no cache,
                // cookies, service workers, IndexedDB, or Cache Storage
                // leak between runs (Vinyl ↔ Shaka, or track ↔ track).
                const context = await browser.createBrowserContext()
                const page = await context.newPage()

                const cdpSession = await page.createCDPSession()
                await cdpSession.send('Network.enable')
                await cdpSession.send('Network.clearBrowserCache')
                await cdpSession.send('Network.clearBrowserCookies')

                await page.goto(`http://127.0.0.1:${port}/`, {
                    waitUntil: 'networkidle0',
                })

                await page.waitForFunction(
                    () => (globalThis as any).testHarness !== undefined,
                    { timeout: 15000 }
                )

                let result: TrackResult
                try {
                    result = await runScenario({
                        page,
                        cdpSession,
                        track,
                        scenario,
                        engineType,
                        rng: createSeededRandom(seed),
                    })
                } catch (err) {
                    console.error(`      Run failed: ${(err as Error).message}`)
                    // Emit a zero-score result so the combo still shows up in
                    // the results and downstream charts aren't missing series.
                    result = {
                        track,
                        scenario: scenario.name,
                        engine: engineType,
                        score: calculateScore({
                            initialDelaySeconds: 0,
                            maxBandwidth: null,
                            ended: false,
                            endTime: 0,
                            timeline: [],
                        }),
                        timedOut: true,
                        endTime: 0,
                        timeline: [],
                        networkSeries: [],
                    }
                }
                results.push(result)
                // Persist after every track so interrupts never lose progress.
                onResult(result)

                const s = result.score.breakdown
                const suffix = result.timedOut ? ' [TIMEOUT]' : ''
                console.log(
                    `      Score: ${(s.finalScore * 100).toFixed(2)}` +
                        ` (qual:${(s.quality * 100).toFixed(2)}` +
                        ` rebuf:${(s.rebuffer * 100).toFixed(2)}` +
                        ` stall:${(s.stall * 100).toFixed(2)}` +
                        ` startup:${(s.startup * 100).toFixed(2)})${suffix}`
                )

                await page.close().catch(() => {})
                await context.close().catch(() => {})
            }
        }
    }

    return results
}

function computeSummary(
    results: TrackResult[],
    engines: EngineType[]
): BenchmarkResults['summary'] {
    const engineAverages: Record<string, number> = {}

    // Scores are 0–1; round to 4 decimals to preserve display precision.
    const round4 = (x: number) => Math.round(x * 10000) / 10000

    for (const engine of engines) {
        const engineResults = results.filter((r) => r.engine === engine)
        engineAverages[engine] = round4(
            engineResults.reduce(
                (s, r) => s + r.score.breakdown.finalScore,
                0
            ) / engineResults.length
        )
    }

    return { engineAverages }
}

async function main() {
    const { scenarioFilter, seed, engineFilter, amend, cont } = parseArgs(
        process.argv.slice(2)
    )
    const engines: EngineType[] = engineFilter
        ? [engineFilter]
        : ['vinyl', 'shaka']

    console.log('ABR Benchmark Harness')
    console.log(`Seed: ${seed}`)
    console.log(`Engines: ${engines.join(', ')}`)
    if (amend) console.log('Mode: amend (merging into existing results.json)')
    if (cont)
        console.log('Mode: continue (skipping combos already in results.json)')

    // Build first
    console.log('Building...')
    const repoRoot = path.resolve(__dirname, '../../../..')
    execSync('npm run build:release', { stdio: 'inherit', cwd: repoRoot })
    execSync('tsx test/abrBenchmark/build.ts', {
        stdio: 'inherit',
        cwd: packageDir,
    })

    ensureBuild()
    fs.mkdirSync(resultsDir, { recursive: true })

    const { server, port } = await startLocalServer()
    console.log(`Server running on http://127.0.0.1:${port}`)

    let puppeteer: any
    try {
        puppeteer = await import('puppeteer')
    } catch {
        console.error(
            'Puppeteer is not installed. Run: npm install --no-save puppeteer commander'
        )
        server.close()
        process.exit(1)
    }

    const browser = await puppeteer.launch({
        headless: true,
        protocolTimeout: 3600000, // 60 minutes
        args: [
            '--autoplay-policy=no-user-gesture-required',
            '--disable-web-security',
            '--no-sandbox',
        ],
    })

    const filteredScenarios = scenarioFilter
        ? scenarios.filter((s) => s.name === scenarioFilter)
        : scenarios.filter((s) => !s.optional)

    if (filteredScenarios.length === 0) {
        console.error(
            `Unknown scenario: ${scenarioFilter}. Available: ${scenarios.map((s) => s.name).join(', ')}`
        )
        await browser.close()
        server.close()
        process.exit(1)
    }

    const outPath = path.join(resultsDir, 'results.json')
    const mergeMode = amend || cont

    // Load prior state when merging.
    let priorResults: TrackResult[] = []
    let priorEngines: EngineType[] = []
    let priorBundleLoadTimes: BundleLoadTime[] = []
    const doneKeys = new Set<string>()
    if (mergeMode && fs.existsSync(outPath)) {
        const prev: BenchmarkResults = JSON.parse(
            fs.readFileSync(outPath, 'utf-8')
        )
        priorResults = prev.results
        priorEngines = prev.engines
        priorBundleLoadTimes = prev.bundleLoadTimes
        if (cont) {
            for (const r of prev.results) {
                doneKeys.add(`${r.scenario}|${r.engine}|${r.track.uri}`)
            }
        }
    }

    const bundleLoadTimes = await measureBundleLoadTimes(engines, packageDir)

    const writeResults = (allNewResults: TrackResult[]) => {
        // Start from prior results, then replace entries for any (scenario, engine)
        // combos present in allNewResults (amend semantics), then append new.
        // Under --continue this is a no-op replacement since we skipped done combos.
        const replacedKeys = new Set(
            allNewResults.map((r) => `${r.scenario}|${r.engine}`)
        )
        const keptPrev = priorResults.filter(
            (r) => !replacedKeys.has(`${r.scenario}|${r.engine}`)
        )
        const mergedResults = [...keptPrev, ...allNewResults]
        const mergedEngines = [
            ...new Set<EngineType>([...priorEngines, ...engines]),
        ]
        const bundleByEngine = new Map(
            priorBundleLoadTimes.map((b) => [b.engine, b])
        )
        for (const b of bundleLoadTimes) bundleByEngine.set(b.engine, b)
        const mergedBundleLoadTimes = [...bundleByEngine.values()]

        const summary = computeSummary(mergedResults, mergedEngines)

        const output: BenchmarkResults = {
            timestamp: new Date().toISOString(),
            seed,
            engines: mergedEngines,
            bundleLoadTimes: mergedBundleLoadTimes,
            results: mergedResults,
            summary,
        }
        fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
        return { output, summary }
    }

    // If not merging, treat any prior file as fully replaced.
    if (!mergeMode) {
        priorResults = []
        priorEngines = []
        priorBundleLoadTimes = []
    }

    const accumulated: TrackResult[] = []
    try {
        await runAllScenarios(
            browser,
            port,
            filteredScenarios,
            engines,
            seed,
            doneKeys,
            (result) => {
                accumulated.push(result)
                writeResults(accumulated)
            }
        )
    } finally {
        await browser.close()
        server.close()
    }

    // Final write (also covers the case where nothing ran under --continue).
    const { summary } = writeResults(accumulated)
    console.log(`\nResults written to ${outPath}`)
    for (const [engine, avg] of Object.entries(summary.engineAverages)) {
        console.log(`  ${engine}: ${(avg * 100).toFixed(2)}`)
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
