/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Unsubscribe } from '@amazon/vinyl-util'
import type { BenchmarkRunResults } from '@amazon/vinyl-util/browserTestUtil'
import { benchmark } from '@amazon/vinyl-util/browserTestUtil'
import {
    initializeConnectedObserver,
    onConnect,
    walkDomDepthFirst,
} from '@amazon/vinyl-tsx'
import { addBenchmarks, setupBenchmark } from '../setup'

describe('connectedObserver', () => {
    setupBenchmark()

    const observers: Record<string, () => Unsubscribe> = {
        'no observer': () => () => {},
        'events on': () => initializeConnectedObserver(),
        'events off': () => initializeConnectedObserver({ events: false }),
    }

    let connections = 0

    /**
     * A grid of cards, 7 nodes each. With listeners, a card and its title text (2 of 7 nodes)
     * observe their connection, the way jsx hooks and ActiveText do.
     */
    function createPage(cards: number, listeners: boolean): HTMLElement {
        const page = document.createElement('div')
        let row: HTMLElement = page
        for (let i = 0; i < cards; i++) {
            if (i % 10 === 0) row = append(page, 'div')
            const card = append(row, 'div')
            append(card, 'div')
            const meta = append(card, 'div')
            const title = document.createTextNode(`Title ${i}`)
            append(meta, 'span').appendChild(title)
            append(meta, 'span').appendChild(
                document.createTextNode(`Subtitle ${i}`)
            )
            if (listeners) {
                observe(card)
                observe(title)
            }
        }
        return page
    }

    function append(parent: Node, tagName: string): HTMLElement {
        return parent.appendChild(document.createElement(tagName))
    }

    function observe(node: Node) {
        onConnect(node, () => {
            connections++
            return () => connections--
        })
    }

    function countNodes(root: Node): number {
        let count = 0
        walkDomDepthFirst(root, () => count++)
        return count
    }

    /**
     * Mutation observer callbacks run in a microtask queued by the first mutation, so they have
     * run once the executor resumes from an await.
     */
    function flushMutations(): Promise<void> {
        return Promise.resolve()
    }

    async function compareObservers(
        name: string,
        executor: (container: HTMLElement) => Promise<void>
    ) {
        const results: BenchmarkRunResults[] = []
        for (const [observerName, initialize] of Object.entries(observers)) {
            const container = document.body.appendChild(
                document.createElement('div')
            )
            const unsubscribe = initialize()
            try {
                results.push(
                    await benchmark(observerName, () => executor(container))
                )
            } finally {
                unsubscribe()
                container.remove()
            }
        }
        addBenchmarks(name, ...results)
    }

    ;[1000, 5000].forEach((size) => {
        const cards = Math.round(size / 7)

        describe(`${size} nodes`, () => {
            const page = createPage(cards, true)
            const nodes = countNodes(page)
            const label = `${nodes.toLocaleString()} nodes, ${Math.round(
                ((cards * 2) / nodes) * 100
            )}% with listeners`

            it('mount and unmount', async () => {
                await compareObservers(
                    `mount and unmount ${label}`,
                    async (container) => {
                        container.appendChild(page)
                        await flushMutations()
                        page.remove()
                        await flushMutations()
                    }
                )
            })

            it('page swap', async () => {
                const pages = [page, createPage(cards, true)]
                let next = 0
                await compareObservers(
                    `page swap ${label}`,
                    async (container) => {
                        if (container.firstChild) {
                            container.replaceChild(
                                pages[next],
                                container.firstChild
                            )
                        } else {
                            container.appendChild(pages[next])
                        }
                        next = 1 - next
                        await flushMutations()
                    }
                )
            })

            it('mount and unmount without listeners', async () => {
                const emptyPage = createPage(cards, false)
                await compareObservers(
                    `mount and unmount ${nodes.toLocaleString()} nodes, no listeners`,
                    async (container) => {
                        container.appendChild(emptyPage)
                        await flushMutations()
                        emptyPage.remove()
                        await flushMutations()
                    }
                )
            })
        })
    })
})
