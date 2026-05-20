/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export type Task<T = void> = () => Promise<T> | T

/**
 * A TaskQueue runs actions in a sequence.
 */
export class TaskQueue {
    /**
     * Set to handle when a task rejects.
     */
    onError: (error: any) => void = () => {}

    private _running = 0

    /**
     * How many simultaneous tasks may be run at a time.
     */
    simultaneous = 1

    private pending: Task[] = []

    /**
     * How many tasks are currently running.
     */
    get running(): number {
        return this._running
    }

    /**
     * Enqueues the given task, returning a Promise that settles when the task is complete.
     */
    enqueue<T>(task: Task<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.pending.push(() => {
                this._running++
                Promise.resolve(task())
                    .then(resolve)
                    .catch((error) => {
                        reject(error as Error)
                        this.onError(error)
                    })
                    .finally(() => {
                        this._running--
                        this.checkQueue()
                    })
            })
            this.checkQueue()
        })
    }

    /**
     * Checks if the queue has any remaining actions and if there is additional capacity to execute.
     * @private
     */
    private checkQueue() {
        if (this.pending.length === 0 || this._running >= this.simultaneous)
            return
        Promise.resolve(this.pending.shift()!()).catch(() => {})
    }
}
