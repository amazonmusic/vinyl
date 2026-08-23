/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    BrowserStackWorker,
    type BrowserStackWorkerDeps,
    type WorkerOptions,
    logger,
    LogLevel,
} from '@amazon/vinyl-build-utils'

/**
 * Builds a worker backed by a minimal mock of the BrowserStack REST client.
 * `whenCreateWorkerCalled(n)` resolves once the client has been asked to
 * create its nth worker, so tests can await a fallback restart deterministically
 * rather than guessing at timer delays.
 */
function createHarness() {
    let workerId = 0
    const waiters = new Map<number, () => void>()
    const createWorker = jasmine.createSpy('createWorker').and.callFake(() => {
        waiters.get(createWorker.calls.count())?.()
        return Promise.resolve({ id: ++workerId })
    })
    const getWorker = jasmine
        .createSpy('getWorker')
        .and.callFake((id: number) =>
            Promise.resolve({
                sessionId: `session-${id}`,
                browser_url: `https://example.test/${id}`,
                status: 'running',
                os: 'x',
                os_version: 'y',
            })
        )
    const getSession = jasmine
        .createSpy('getSession')
        .and.resolveTo({ status: 'running' })
    const deleteWorker = jasmine.createSpy('deleteWorker').and.resolveTo({})
    const deleteSession = jasmine.createSpy('deleteSession').and.resolveTo({})
    const updateSession = jasmine
        .createSpy('updateSession')
        .and.resolveTo({ status: 'failed' })
    const client = {
        createWorker,
        getWorker,
        getSession,
        deleteWorker,
        deleteSession,
        updateSession,
    }
    const deps = { client } as unknown as BrowserStackWorkerDeps
    const whenCreateWorkerCalled = (n: number): Promise<void> =>
        createWorker.calls.count() >= n
            ? Promise.resolve()
            : new Promise((resolve) => waiters.set(n, resolve))
    return { deps, client, whenCreateWorkerCalled }
}

const BASE_OPTIONS = {
    os: 'OS X',
    os_version: 'Sonoma',
    browser: 'safari',
    browser_version: 'latest',
    url: 'https://example.test/',
    name: 'macOS Safari',
    resolution: '1920x1080',
} satisfies WorkerOptions

// retries: 0 so a single capture timeout exhausts the retry budget; a tiny
// captureTimeout keeps the give-up path fast without a fake clock. A long
// pollInterval keeps the session poll from firing during the test.
const FAST_GIVE_UP = {
    retries: 0,
    captureTimeout: 0.01,
    pollInterval: 3600,
    logsDir: null,
} as const

describe('BrowserStackWorker', () => {
    let originalLogLevel: LogLevel
    let worker: BrowserStackWorker | null = null

    beforeAll(() => {
        originalLogLevel = logger.level
        // Silence the expected warn/error output from the give-up path.
        logger.level = LogLevel.ERROR + 1
    })

    afterAll(() => {
        logger.level = originalLogLevel
    })

    afterEach(async () => {
        // Clears the worker's timers so they don't leak into other specs.
        await worker?.terminate()
        worker = null
    })

    describe('fallbackBrowser', () => {
        it('swaps to the fallback browser when capture retries are exhausted', async () => {
            const { deps, client, whenCreateWorkerCalled } = createHarness()
            worker = new BrowserStackWorker(
                deps,
                {
                    ...BASE_OPTIONS,
                    fallbackBrowser: {
                        os: 'Windows',
                        os_version: '11',
                        browser: 'chrome',
                        browser_version: 'latest',
                    },
                },
                FAST_GIVE_UP
            )

            const secondCreate = whenCreateWorkerCalled(2)
            await worker.start()
            await secondCreate

            expect(client.createWorker).toHaveBeenCalledTimes(2)
            const first = client.createWorker.calls.argsFor(0)[0]
            const second = client.createWorker.calls.argsFor(1)[0]
            // First attempt runs the primary browser under its original name.
            expect(first.browser).toBe('safari')
            expect(first.name).toBe('macOS Safari')
            // Fallback attempt swaps the browser, keeps the rest of the options,
            // and relabels to the fallback platform marked as a fallback.
            expect(second.os).toBe('Windows')
            expect(second.browser).toBe('chrome')
            expect(second.resolution).toBe('1920x1080')
            expect(second.name).toBe('Windows 11 chrome latest [fallback]')
            expect(worker.state.error).toBeNull()
        })

        it('never leaks fallbackBrowser into the create-worker request', async () => {
            const { deps, client, whenCreateWorkerCalled } = createHarness()
            worker = new BrowserStackWorker(
                deps,
                {
                    ...BASE_OPTIONS,
                    fallbackBrowser: { os: 'Windows', os_version: '11' },
                },
                FAST_GIVE_UP
            )

            const secondCreate = whenCreateWorkerCalled(2)
            await worker.start()
            await secondCreate

            for (const [options] of client.createWorker.calls.allArgs()) {
                expect('fallbackBrowser' in options).toBeFalse()
            }
        })

        it('drops the previous combination so a stale device does not bleed through', async () => {
            const { deps, client, whenCreateWorkerCalled } = createHarness()
            worker = new BrowserStackWorker(
                deps,
                {
                    os: 'ios',
                    os_version: '17',
                    device: 'iPhone 15',
                    url: 'https://example.test/',
                    name: 'iOS Safari',
                    // Fallback to a desktop combination that has no device.
                    fallbackBrowser: {
                        os: 'OS X',
                        os_version: 'Sonoma',
                        browser: 'safari',
                    },
                },
                FAST_GIVE_UP
            )

            const secondCreate = whenCreateWorkerCalled(2)
            await worker.start()
            await secondCreate

            const second = client.createWorker.calls.argsFor(1)[0]
            expect(second.os).toBe('OS X')
            expect(second.browser).toBe('safari')
            expect('device' in second).toBeFalse()
        })

        it('errors when no fallback browser is configured', async () => {
            const { deps, client } = createHarness()
            worker = new BrowserStackWorker(deps, BASE_OPTIONS, FAST_GIVE_UP)

            const errored = new Promise<void>((resolve) => {
                worker!.onUpdate = () => {
                    if (worker!.state.error) resolve()
                }
            })
            await worker.start()
            await errored

            expect(client.createWorker).toHaveBeenCalledTimes(1)
            expect(worker.state.error?.message).toContain(
                'Did not capture test progress'
            )
            expect(worker.completed).toBeTrue()
        })
    })
})
