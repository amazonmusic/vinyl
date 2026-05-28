/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { LinkedList, type LinkedNode } from '../collection/LinkedList'
import { createAbortSlot, type ReadonlyAbort } from './Abort'
import { withAbort } from './abortUtils'
import { type Comparator } from '../comparison/compare'
import type { Maybe, MaybePromise } from '../type'
import { AbortError } from '../../error/AbortError'

export type Task<T = void> = (abort: ReadonlyAbort) => MaybePromise<T>

/**
 * A TaskQueue runs actions in a sequence, with the ability to abort the queued tasks.
 */
export class TaskQueue<PriorityType = undefined> {
    private _simultaneous = 1
    private _running = 0

    /**
     * Use {@link createTaskQueue} to construct a new TaskQueue.
     */
    constructor(
        /**
         * A comparator for comparing two task priorities.
         */
        readonly comparator: Maybe<Comparator<PriorityType>>,

        /**
         * The default priority if not provided.
         * If comparator is nullish priority values will have no effect.
         */
        readonly defaultPriority: PriorityType
    ) {}

    get simultaneous(): number {
        return this._simultaneous
    }

    /**
     * How many simultaneous tasks may be run at a time.
     * Reducing this will not abort currently running tasks.
     */
    set simultaneous(value: number) {
        this._simultaneous = value
        this.checkQueue()
    }

    private pending = new LinkedList<{
        readonly priority: PriorityType
        readonly execute: () => void
    }>()

    private readonly abortSlot = createAbortSlot()

    /**
     * How many tasks are currently running.
     */
    get running(): number {
        return this._running
    }

    /**
     * Enqueues the given task, returning a Promise that settles when the task is complete.
     *
     * @param task A function that is optionally asynchronous.
     * @param priority The priority of the task. If not provided, `defaultPriority()` will be used.
     */
    enqueue<T>(
        task: Task<T>,
        priority: PriorityType = this.defaultPriority
    ): Promise<T> {
        const abort = this.abortSlot.value

        return new Promise<T>((resolve, reject) => {
            this.pending.push({
                priority,
                execute: () => {
                    if (abort.aborted()) {
                        reject(abort.reason!)
                        this.checkQueue()
                        return
                    }
                    this._running++
                    let result: MaybePromise<T>
                    try {
                        result = task(abort)
                    } catch (error: any) {
                        reject(error as Error)
                        this._running--
                        return
                    }
                    withAbort(Promise.resolve(result), abort)
                        .then(resolve)
                        .catch(reject)
                        .finally(() => {
                            this._running--
                            this.checkQueue()
                        })
                },
            })
            this.checkQueue()
        })
    }

    /**
     * If the queue has any remaining actions and if there is additional capacity to execute, picks the next
     * task with the highest priority according to this queue's comparator.
     * @private
     */
    private checkQueue() {
        while (!this.pending.empty && this._running < this.simultaneous) {
            let current = this.pending.head
            let highestPriorityNode: LinkedNode<{
                readonly priority: PriorityType
                readonly execute: () => void
            }> = current!

            if (this.comparator) {
                current = current!.next
                while (current != null) {
                    if (
                        this.comparator(
                            highestPriorityNode.value.priority,
                            current.value.priority
                        ) > 0
                    ) {
                        highestPriorityNode = current
                    }
                    current = current.next
                }
            }
            this.pending.remove(highestPriorityNode)
            highestPriorityNode.value.execute()
        }
    }

    /**
     * Aborts all enqueued operations.
     */
    abort(reason: Error = new AbortError()) {
        if (!this.running) return
        this.abortSlot.abort(reason)
    }
}

/**
 * Creates a TaskQueue without task prioritization.
 */
export function createTaskQueue(): TaskQueue

/**
 * Creates a TaskQueue with a priority comparator.
 *
 * @param comparator Compares two priority objects.
 * @param defaultPriority A default priority.
 */
export function createTaskQueue<PriorityType>(
    comparator: Comparator<PriorityType>,
    defaultPriority: PriorityType
): TaskQueue<PriorityType>

export function createTaskQueue(
    comparator?: Comparator<any>,
    defaultPriority?: any
): TaskQueue<any> {
    return new TaskQueue<any>(comparator, defaultPriority)
}
