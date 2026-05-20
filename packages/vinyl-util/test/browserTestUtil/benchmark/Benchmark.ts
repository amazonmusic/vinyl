/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

//-------------------------------------------------------------------------
// A Benchmarking utility for testing and comparing performance.
//-------------------------------------------------------------------------

/**
 * Gets the current high resolution timestamp, platform dependent.
 */
let now: () => number
if (
    typeof window !== 'undefined' &&
    typeof window.performance !== 'undefined' &&
    typeof window.performance.now !== 'undefined'
) {
    now = () => window.performance.now()
} else if (
    typeof self !== 'undefined' &&
    typeof self.performance !== 'undefined' &&
    typeof self.performance.now !== 'undefined'
) {
    now = () => self.performance.now()
} else {
    now = () => Date.now()
}

export interface BenchMarkOptions {
    /**
     * The amount of time to run the executor before beginning measurement (in seconds).
     */
    readonly warmupTime: number

    /**
     * When time has elapsed past this duration during a cycle (in seconds), there will be no
     * operations.
     * The cycle will end when `maxCycleDuration` has been reached.
     */
    readonly maxCycleDuration: number

    /**
     * The number of trials to run.
     */
    readonly cycles: number
}

export interface CycleResults {
    /**
     * The number of seconds the cycle ran.
     */
    readonly duration: number

    /**
     * The number of completed executions.
     */
    readonly ops: number
}

export class BenchmarkRunResults {
    readonly cycleResults: number[] = []

    private _totalSamples = 0
    get totalSamples(): number {
        return this._totalSamples
    }

    get cycleResultsNoOutliers(): number[] {
        const sD = this.standardDeviation
        const avg = average(this.cycleResults)
        return this.cycleResults.filter((e) => {
            const zScore = (avg - e) / sD
            return Math.abs(zScore) < 3
        })
    }

    /**
     * Returns the mean ops per second minus outliers of greater than 3 standard deviations.
     */
    get meanOpsPerSec(): number {
        return average(this.cycleResultsNoOutliers)
    }

    get standardDeviation(): number {
        return standardDeviation(this.cycleResults)
    }

    get variance(): number {
        return this.standardDeviation / this.meanOpsPerSec
    }

    /**
     * Returns the mean ops / s ± variance % as a string.
     */
    get meanOpsStr(): string {
        const mean = this.meanOpsPerSec.toLocaleString(undefined, {
            maximumSignificantDigits: 4,
        })
        const variance = this.variance.toLocaleString(undefined, {
            style: 'percent',
        })
        return `${mean} ±${variance}`
    }

    constructor(readonly name: string) {}

    add(cycle: CycleResults) {
        const opsPerSecond = cycle.ops / cycle.duration
        let index = this.cycleResults.findIndex((value) => opsPerSecond < value)
        if (index < 0) index = this.cycleResults.length
        this.cycleResults.splice(index, 0, opsPerSecond)
        this._totalSamples += cycle.ops
    }

    toString(): string {
        if (!this.cycleResults.length) return 'No results'
        return `${this.name}: ${this.meanOpsStr} ops/sec`
    }
}

export class RunResultsComparison {
    /**
     * Sorted by median ops/s from slowest to fastest.
     */
    readonly results: BenchmarkRunResults[]

    constructor(
        readonly name: string,
        results: BenchmarkRunResults[]
    ) {
        this.results = results.sort((a, b) => {
            return a.meanOpsPerSec - b.meanOpsPerSec
        })
    }

    logToTable(): void {
        const r = this.results.map((run) => {
            const variance = run.variance.toLocaleString(undefined, {
                style: 'percent',
            })
            const mean = run.meanOpsPerSec.toLocaleString(undefined, {
                maximumSignificantDigits: 4,
            })

            return {
                Name: run.name,
                Mean: `${mean} ±${variance}`,
                Samples: run.totalSamples,
                Compare: this.runComparisonToString(run),
            }
        })
        // Use the names as the index.
        const table = r.reduce<any>((acc, { Name, ...x }) => {
            acc[Name] = x
            return acc
        }, {})
        console.log('\n' + this.name)
        console.table(table)
    }

    runComparisonToString(run: BenchmarkRunResults): string {
        const baseline = this.results[0]?.meanOpsPerSec ?? 0
        const fasterPercent = run.meanOpsPerSec / baseline - 1
        return fasterPercent < 0.01
            ? '-'
            : fasterPercent.toLocaleString(undefined, {
                  style: 'percent',
              }) + ' faster'
    }
}

export function compareResults(
    name: string,
    ...results: BenchmarkRunResults[]
): RunResultsComparison {
    return new RunResultsComparison(name, results)
}

const defaultBenchmarkOptions: BenchMarkOptions = {
    warmupTime: 0.5,
    maxCycleDuration: 0.5,
    cycles: 9,
} as const

export class Benchmark {
    private static semaphore: Promise<any> = nextFrame()

    private readonly options: BenchMarkOptions

    /**
     * Constructs a new Benchmark.
     *
     * @param name The name of the benchmark, to be used when logging.
     * @param executor The method to execute and measure. If this method returns a promise, the
     * promise will be awaited. The executor should either always return a promise, or never.
     * @param options Optional configuration for the benchmark.
     */
    constructor(
        readonly name: string,
        readonly executor: () => any,
        options?: Partial<BenchMarkOptions>
    ) {
        this.options = { ...defaultBenchmarkOptions, ...options }
    }

    async run(): Promise<BenchmarkRunResults> {
        const opts = this.options
        // Wait for any currently running work to complete.
        await Benchmark.semaphore

        const warmupTimeMs = opts.warmupTime * 1000
        const cycleStart = now()
        let isAsync = false
        do {
            const result = this.executor()
            // If the executor returns a promise, it is considered an async test and the benchmark
            // should await its result.
            isAsync = isAsync || (result && typeof result.then === 'function')
            if (isAsync) await result
        } while (now() - cycleStart < warmupTimeMs)
        const resultsPromise: Promise<BenchmarkRunResults> = (async () => {
            const results = new BenchmarkRunResults(this.name)
            for (let i = 0; i < opts.cycles; i++) {
                const cycleResults = await this.runCycle(isAsync)
                results.add(cycleResults)
                await nextFrame()
            }
            return results
        })()
        Benchmark.semaphore = resultsPromise
        return await resultsPromise
    }

    /**
     * Runs one cycle. A cycle will repeat the executor approximately `options.maxCycleDuration`
     * seconds.
     *
     * @param isAsync
     * @return Returns the duration (in seconds) and number of operations the cycle repeated.
     */
    private async runCycle(isAsync: boolean): Promise<CycleResults> {
        const cycleMs = this.options.maxCycleDuration * 1000
        let ops = 0
        const cycleStart = now()
        do {
            const result = this.executor()
            if (isAsync) await result
            ops++
        } while (now() - cycleStart < cycleMs)
        const duration = (now() - cycleStart) / 1000
        return {
            duration,
            ops,
        }
    }
}

/**
 * Creates and runs a benchmark, logging the result.
 *
 * @param name
 * @param executor
 * @param options
 */
export function benchmark(
    name: string,
    executor: () => any,
    options?: Partial<BenchMarkOptions>
): Promise<BenchmarkRunResults> {
    const benchmark = new Benchmark(name, executor, options)
    return benchmark.run().then((results) => {
        console.log(results.toString())
        return results
    })
}

/**
 * To avoid killing the browser's frame.
 */
function nextFrame(): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve)
    })
}

/**
 * Returns the standard deviation of the given values.
 *
 * @param values
 */
function standardDeviation(values: readonly number[]): number {
    const avg = average(values)
    const squareDiffs = values.map((value) => {
        const diff = value - avg
        return diff * diff
    })
    const avgSquareDiff = average(squareDiffs)
    return Math.sqrt(avgSquareDiff)
}

/**
 * Returns the mean/average of the given values.
 *
 * @param values
 */
function average(values: readonly number[]): number {
    const sum = values.reduce((acc, value) => acc + value, 0)
    return sum / values.length
}
