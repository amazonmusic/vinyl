/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A doubly-linked node.
 *
 * If a node is to move from one list to another, it must be removed first.
 */
export interface LinkedNode<T> {
    previous: LinkedNode<T> | null
    value: T
    removed: boolean
    next: LinkedNode<T> | null
}

/**
 * A standard doubly-linked list implementation.
 */
export class LinkedList<T> implements Iterable<T> {
    private _head: LinkedNode<T> | null = null
    private _tail: LinkedNode<T> | null = null

    /**
     * Returns the current head.
     */
    get head(): LinkedNode<T> | null {
        return this._head
    }

    /**
     * Returns the current tail.
     */
    get tail(): LinkedNode<T> | null {
        return this._tail
    }

    /**
     * Returns true if the list is empty.
     */
    get empty(): boolean {
        return this._head === null
    }

    /**
     * Creates a new node for the given value, adding it to the end of the list.
     *
     * @param value
     * @return Returns the newly created node.
     */
    push(value: T): LinkedNode<T> {
        const node: LinkedNode<T> = {
            previous: this._tail,
            value,
            removed: false,
            next: null,
        }
        this.pushNode(node)
        return node
    }

    /**
     * Appends all given values to the end of this list.
     *
     * @param values
     */
    pushAll(...values: T[]) {
        for (const value of values) {
            this.push(value)
        }
    }

    /**
     * Appends the given node to the tail of this list.
     * If the node is already at the tail, it will no-op.
     * If the node is in this list, it will be removed.
     *
     * @param node The node to add or move to the tail of this list.
     */
    pushNode(node: LinkedNode<T>) {
        if (this._tail === node) return
        this.remove(node)
        node.removed = false
        node.next = null
        node.previous = this._tail
        if (this._tail) this._tail.next = node
        this._tail = node
        if (!this._head) this._head = node
    }

    /**
     * Removes the last node (the tail), returning it.
     * If this list is empty, null is returned.
     */
    pop(): LinkedNode<T> | null {
        const node = this._tail
        if (!node) return null
        this.remove(node)
        return node
    }

    /**
     * Creates a new node, adding it to the front of the list.
     *
     * @param value The value to box in a linked node.
     * @return Returns the new node.
     */
    unshift(value: T): LinkedNode<T> {
        const node: LinkedNode<T> = {
            previous: null,
            value,
            removed: true,
            next: this._head,
        }
        this.unshiftNode(node)
        return node
    }

    /**
     * Prepends all the given values to the head of this list.
     * The values will maintain their order.
     *
     * E.g.
     * ```
     * list.unshiftAll(8, 9, 10)   // 8, 9, 10
     * list.unshiftAll(4, 5, 6, 7) // 4, 5, 6, 7, 8, 9, 10
     * list.unshiftAll(1, 2, 3)    // 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
     * ```
     *
     * @param values The values to box in linked nodes.
     */
    unshiftAll(...values: T[]) {
        for (let i = values.length - 1; i >= 0; i--) {
            this.unshift(values[i])
        }
    }

    /**
     * Prepends the given node to the head of this list.
     * - If the node is already at the head, it will no-op.
     * - If the node is in this list, it will be removed.
     *
     * @param node The node to add or move to the head of this list.
     */
    unshiftNode(node: LinkedNode<T>) {
        if (this._head === node) return
        this.remove(node)
        node.removed = false
        node.previous = null
        node.next = this._head
        if (this._head) this._head.previous = node
        this._head = node
        if (!this._tail) this._tail = node
    }

    /**
     * Removes the first node (the head), returning it.
     * - If this list is empty, null is returned.
     */
    shift(): LinkedNode<T> | null {
        const node = this._head
        if (!node) return null
        this.remove(node)
        return node
    }

    /**
     * Removes the given linked node.
     *
     * @param node
     */
    remove(node: LinkedNode<T>): void {
        if (node.removed) return
        node.removed = true
        if (node.previous) node.previous.next = node.next
        if (node.next) node.next.previous = node.previous
        if (this._head === node) this._head = node.next
        if (this._tail === node) this._tail = node.previous
    }

    /**
     * Inserts the given node before pointer node.
     *
     * @param node The node to insert before pointer. If this node is currently in this list, it
     * will first be removed.
     * @param pointer The pointer node.
     */
    insertNodeBefore(node: LinkedNode<T>, pointer: LinkedNode<T>) {
        if (!node.removed && node.next === pointer) return
        this.remove(node)
        node.removed = false
        if (pointer.previous) {
            pointer.previous.next = node
            node.previous = pointer.previous
        } else {
            this._head = node
            node.previous = null
        }
        node.next = pointer
        pointer.previous = node
    }

    /**
     * Inserts the given node after pointer node.
     *
     * @param node The node to insert after pointer. If this node is currently in this list, it
     * will first be removed.
     * @param pointer The pointer node.
     */
    insertNodeAfter(node: LinkedNode<T>, pointer: LinkedNode<T>) {
        if (!node.removed && node.previous === pointer) return
        this.remove(node)
        node.removed = false
        if (pointer.next) {
            pointer.next.previous = node
            node.next = pointer.next
        } else {
            this._tail = node
            node.next = null
        }
        node.previous = pointer
        pointer.next = node
    }

    /**
     * Iterates over every element, invoking the given callback.
     *
     * @param callback
     */
    forEach(callback: (element: T) => void): void {
        let current: LinkedNode<T> | null = this._head
        while (current) {
            if (!current.removed) callback(current.value)
            current = current.next
        }
    }

    /**
     * Similar to `Array.prototype.some`, returns true if at least one element passes the given
     * predicate.
     *
     * @param predicate
     */
    some(predicate: (element: T) => boolean): boolean {
        let current: LinkedNode<T> | null = this._head
        while (current) {
            if (!current.removed && predicate(current.value)) return true
            current = current.next
        }
        return false
    }

    /**
     * Returns the first node matching the given predicate.
     *
     * @param predicate A function where, when true is returned, returns the current node.
     */
    find(predicate: (element: T) => boolean): LinkedNode<T> | null {
        let current: LinkedNode<T> | null = this._head
        while (current) {
            if (!current.removed && predicate(current.value)) return current
            current = current.next
        }
        return null
    }

    /**
     * Returns the last node matching the given predicate.
     *
     * @param predicate A function where, when true is returned, returns the current node.
     */
    findLast(predicate: (element: T) => boolean): LinkedNode<T> | null {
        let current: LinkedNode<T> | null = this._tail
        while (current) {
            if (!current.removed && predicate(current.value)) return current
            current = current.previous
        }
        return null
    }

    /**
     * Clears this list.
     */
    clear(): void {
        let current = this._head
        while (current != null) {
            const next = current.next
            current.removed = true
            current = next
        }
        this._head = null
        this._tail = null
    }

    /**
     * Returns a new iterator, starting at the head.
     */
    [Symbol.iterator](): IterableIterator<T> {
        return this.createIterator(this._head, null, (node) => node.next)
    }

    /**
     * Returns a new reversed iterable where the iterator starts at the tail, moving backwards
     * to the head.
     */
    reversed(): IterableIterator<T> {
        return this.createIterator(this._tail, null, (node) => node.previous)
    }

    /**
     * Creates an iterable iterator, starting at the specified node, getting the next node from
     * the next() function.
     *
     * Note that using iterators is not as performant as {@link some} or {@link forEach}
     *
     * @param start The starting node. (inclusive)
     * @param end The ending node (exclusive).
     * @param next A method that is given the current node, and returns the next node.
     */
    createIterator(
        start: LinkedNode<T> | null,
        end: LinkedNode<T> | null,
        next: (current: LinkedNode<T>) => LinkedNode<T> | null
    ): IterableIterator<T> {
        let current: LinkedNode<T> | null = start
        return {
            [Symbol.iterator](): IterableIterator<T> {
                return this
            },

            next: (): IteratorResult<T> => {
                if (current === end || !current) {
                    return {
                        value: undefined,
                        done: true,
                    }
                }

                const result = {
                    value: current.value,
                    done: false,
                }
                current = next(current)
                while (current?.removed) {
                    current = next(current)
                }
                return result
            },
        }
    }
}
