/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
    BenchmarkRunResults,
    RunResultsComparison,
} from '@amazon/vinyl-util/browserTestUtil'
import {
    compareResults,
    expectNothing,
    setTestTimeout,
} from '@amazon/vinyl-util/browserTestUtil'

export function setupBenchmark(): void {
    setTestTimeout(180)
    afterEach(expectNothing)
}

const comparisons: RunResultsComparison[] = []

/**
 * Adds a benchmark comparison to be displayed at the end of the test.
 * @param comparison
 */
export function addComparison(comparison: RunResultsComparison) {
    comparisons.push(comparison)
}

/**
 * Adds a list of benchmark results to be compared with each other.
 * The results will be logged then for browser environments displayed at the end of the suite.
 *
 * @param name The comparison suite name.
 * @param results
 */
export function addBenchmarks(name: string, ...results: BenchmarkRunResults[]) {
    const comparison = compareResults(name, ...results)
    comparison.logToTable()
    comparisons.push(comparison)
}

if (typeof document !== 'undefined') {
    jasmine.getEnv().addReporter({
        jasmineDone: () => {
            console.log('Tests complete')
            const jasmineContainer = document.getElementsByClassName(
                'jasmine_html-reporter'
            )[0]
            jasmineContainer.parentElement?.removeChild(jasmineContainer)
            const container = createEl('div', document.body)
            container.id = 'benchmarkResults'
            const sortedComparisons = [...comparisons].sort((a, b) =>
                a.name > b.name ? 1 : -1
            )
            for (const comparison of sortedComparisons) {
                toTableHtml(comparison, container)
            }
        },
    })
}

function toTableHtml(
    comparison: RunResultsComparison,
    parent?: HTMLElement
): HTMLDivElement {
    const container = createEl('div', parent)
    container.className = 'benchmarkComparison'
    const title = createEl('h2', container)
    title.innerText = comparison.name
    const table = createEl('table', container)
    const head = createEl('thead', table)
    const headRow = createEl('tr', head)
    const name = createEl('th', headRow)
    name.innerText = 'Name'
    const median = createEl('th', headRow)
    median.innerText = 'Mean ops/s'
    const samples = createEl('th', headRow)
    samples.innerText = 'Samples'
    const compare = createEl('th', headRow)
    compare.innerText = '% Comparison'

    const body = createEl('tbody', table)
    comparison.results.forEach((result) => {
        const row = createEl('tr', body)
        createEl('th', row).innerText = result.name
        createEl('td', row).innerText = result.meanOpsStr
        createEl('td', row).innerText = result.totalSamples.toLocaleString()
        createEl('td', row).innerText = comparison.runComparisonToString(result)
    })
    return container
}

function createEl<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    parent?: HTMLElement,
    options?: ElementCreationOptions
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName, options)
    if (parent) parent.appendChild(element)
    return element
}
