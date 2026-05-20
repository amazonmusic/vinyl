/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LinkedNode } from '@amazon/vinyl-util'
import { LinkedList } from '@amazon/vinyl-util'
import any = jasmine.any
import objectContaining = jasmine.objectContaining

describe('LinkedList', () => {
    describe('head', () => {
        it('returns the head node of the list', () => {
            const list = new LinkedList<number>()
            expect(list.head).toBeNull()
            list.push(1)
            expect(list.head?.value).toBe(1)
        })
    })

    describe('tail', () => {
        it('returns the tail node of the list', () => {
            const list = new LinkedList<number>()
            expect(list.tail).toBeNull()
            list.push(1)
            expect(list.tail?.value).toBe(1)
        })
    })
    describe('empty', () => {
        it('returns true when the list has no elements', () => {
            const list = new LinkedList<number>()
            expect(list.empty).toBeTrue()
            const r = list.push(1)
            expect(list.empty).toBeFalse()
            list.remove(r)
            expect(list.empty).toBeTrue()
        })
    })

    describe('push', () => {
        it('adds an element to the tail of the list', () => {
            const list = new LinkedList<number>()
            list.push(1)
            list.push(2)
            list.push(3)
            list.push(4)
            const actual: number[] = []
            list.forEach((n) => {
                actual.push(n)
            })
            expect(actual).toEqual([1, 2, 3, 4])
        })
    })

    describe('pushAll', () => {
        it('adds elements to the tail of the list', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4)
            expectListEquals(list, [1, 2, 3, 4])
            list.pushAll(5, 6, 7, 8)
            expectListEquals(list, [1, 2, 3, 4, 5, 6, 7, 8])
            list.pushAll(9, 10)
            expectListEquals(list, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        })
    })

    describe('pushNode', () => {
        it('moves the given node to the end of the list', () => {
            const list = new LinkedList<number>()
            const a = list.push(1)
            const b = list.push(2)
            const c = list.push(3)
            list.pushNode(a)
            expect(a.previous).toBe(c)
            expect(a.next).toBeNull()
            expect(list.tail).toBe(a)
            expect(a.removed).toBeFalse()
            list.remove(b)
            list.pushNode(b)
            expect(b.next).toBeNull()
            expect(list.tail).toBe(b)
            expect(b.removed).toBeFalse()
            expect(list.head).toBe(c)
        })

        it('updates all pointers', () => {
            const list = new LinkedList<number>()
            list.push(1)
            const b = list.push(2)
            const c = list.push(3)
            list.push(4)
            list.push(5)
            list.pushNode(c)
            list.pushNode(b)
            expectListEquals(list, [1, 4, 5, 3, 2])
        })

        it('does nothing if the node is already at the tail', () => {
            const list = new LinkedList<number>()
            const a = list.push(1)
            list.pushNode(a)
            expect(list.tail).toBe(a)
            expect(list.head).toBe(a)
        })
    })

    describe('pop', () => {
        it('removes the tail of the list', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4)
            list.pop()
            expectListEquals(list, [1, 2, 3])
            list.pop()
            expectListEquals(list, [1, 2])
            list.pop()
            expectListEquals(list, [1])
            list.pop()
            expectListEquals(list, [])
            list.pop()
            expectListEquals(list, [])
        })
    })

    describe('unshift', () => {
        it('prepends an element to the head of the list', () => {
            const list = new LinkedList<number>()
            list.unshift(1)
            list.unshift(2)
            list.unshift(3)
            list.unshift(4)
            const actual: number[] = []
            list.forEach((n) => {
                actual.push(n)
            })
            expect(actual).toEqual([4, 3, 2, 1])
        })
    })

    describe('unshiftAll', () => {
        it('prepends elements to the head of the list', () => {
            const list = new LinkedList<number>()
            list.unshiftAll(9)
            expectListEquals(list, [9])
            list.unshiftAll(7, 8)
            expectListEquals(list, [7, 8, 9])
            list.unshiftAll(4, 5, 6)
            expectListEquals(list, [4, 5, 6, 7, 8, 9])
            list.unshiftAll(1, 2, 3)
            expectListEquals(list, [1, 2, 3, 4, 5, 6, 7, 8, 9])
        })
    })

    describe('unshiftNode', () => {
        it('moves the given node to the head of the list', () => {
            const list = new LinkedList<number>()
            const a = list.push(1)
            const b = list.push(2)
            const c = list.push(3)
            list.unshiftNode(c)
            expect(c.next).toBe(a)
            expect(c.previous).toBeNull()
            expect(list.head).toBe(c)
            expect(a.removed).toBeFalse()
            list.remove(b)
            list.unshiftNode(b)
            expect(list.head).toBe(b)
            expect(b.removed).toBeFalse()
            expect(list.tail).toBe(a)
        })

        it('updates all pointers', () => {
            const list = new LinkedList<number>()
            list.unshift(1)
            const b = list.unshift(2)
            const c = list.unshift(3)
            list.unshift(4)
            list.unshift(5)
            list.unshiftNode(c)
            list.unshiftNode(b)
            expectListEquals(list, [2, 3, 5, 4, 1])
        })

        it('does nothing if the node is already at the head', () => {
            const list = new LinkedList<number>()
            const a = list.push(1)
            list.unshiftNode(a)
            expect(list.tail).toBe(a)
            expect(list.head).toBe(a)
        })
    })

    describe('shift', () => {
        it('removes the head of the list', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4)
            list.shift()
            expectListEquals(list, [2, 3, 4])
            list.shift()
            expectListEquals(list, [3, 4])
            list.shift()
            expectListEquals(list, [4])
            list.shift()
            expectListEquals(list, [])
            list.shift()
            expectListEquals(list, [])
        })
    })

    describe('remove', () => {
        it('removes the specified node', () => {
            const list = new LinkedList<number>()
            const n1 = list.push(1)
            const n2 = list.push(2)
            const n3 = list.push(3)
            const n4 = list.push(4)
            list.remove(n3)
            expectListEquals(list, [1, 2, 4])
            list.remove(n4)
            expectListEquals(list, [1, 2])
            list.remove(n1)
            expectListEquals(list, [2])
            list.remove(n2)
            expectListEquals(list, [])
            list.remove(n3)
            expectListEquals(list, [])
        })
    })

    describe('insertNodeBefore', () => {
        it('moves an existing node to before the pointer', () => {
            const list = new LinkedList<number>()
            const n1 = list.push(1)
            const n2 = list.push(2)
            const n3 = list.push(3)
            const n4 = list.push(4)
            list.insertNodeBefore(n4, n1)
            expectListEquals(list, [4, 1, 2, 3])
            list.insertNodeBefore(n4, n1)
            expectListEquals(list, [4, 1, 2, 3])
            list.insertNodeBefore(n3, n1)
            expectListEquals(list, [4, 3, 1, 2])
            list.insertNodeBefore(n2, n1)
            expectListEquals(list, [4, 3, 2, 1])
        })

        it('inserts a node to before the pointer', () => {
            const list = new LinkedList<number>()
            const n1 = list.push(1)
            const n2 = list.push(2)
            const n3 = list.push(3)
            const n4 = list.push(4)
            list.remove(n4)
            list.insertNodeBefore(n4, n1)
            expectListEquals(list, [4, 1, 2, 3])
            list.remove(n4)
            expectListEquals(list, [1, 2, 3])
            list.insertNodeBefore(n4, n1)
            expectListEquals(list, [4, 1, 2, 3])
            list.remove(n3)
            list.insertNodeBefore(n3, n1)
            expectListEquals(list, [4, 3, 1, 2])
            list.remove(n2)
            list.insertNodeBefore(n2, n1)
            expectListEquals(list, [4, 3, 2, 1])
        })
    })

    describe('insertNodeAfter', () => {
        it('moves an existing node to after the pointer', () => {
            const list = new LinkedList<number>()
            const n4 = list.push(4)
            const n3 = list.push(3)
            const n2 = list.push(2)
            const n1 = list.push(1)
            list.insertNodeAfter(n4, n1)
            expectListEquals(list, [3, 2, 1, 4])
            list.insertNodeAfter(n4, n1)
            expectListEquals(list, [3, 2, 1, 4])
            list.insertNodeAfter(n3, n1)
            expectListEquals(list, [2, 1, 3, 4])
            list.insertNodeAfter(n2, n1)
            expectListEquals(list, [1, 2, 3, 4])
        })

        it('adds a node to after the pointer', () => {
            const list = new LinkedList<number>()
            const n4 = list.push(4)
            const n3 = list.push(3)
            const n2 = list.push(2)
            const n1 = list.push(1)
            list.remove(n4)
            list.insertNodeAfter(n4, n1)
            expectListEquals(list, [3, 2, 1, 4])
            list.remove(n4)
            expectListEquals(list, [3, 2, 1])
            list.insertNodeAfter(n4, n1)
            expectListEquals(list, [3, 2, 1, 4])
            list.remove(n3)
            list.insertNodeAfter(n3, n1)
            expectListEquals(list, [2, 1, 3, 4])
            list.remove(n2)
            list.insertNodeAfter(n2, n1)
            expectListEquals(list, [1, 2, 3, 4])
        })
    })

    describe('forEach', () => {
        it('stops iteration after clear', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4, 5)
            const actual: number[] = []
            list.forEach((n) => {
                actual.push(n)
                if (n === 3) list.clear()
            })
            expect(actual).toEqual([1, 2, 3])
        })

        it('skips removed elements', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3)
            const four = list.push(4)
            const five = list.push(5)
            const six = list.push(6)
            list.pushAll(7, 8, 9)
            const zero = list.unshift(0)
            const actual: number[] = []
            list.forEach((n) => {
                actual.push(n)
                if (n === 4) {
                    list.remove(four)
                    list.remove(five)
                    list.remove(six)
                    list.remove(zero)
                }
            })
            expect(actual).toEqual([0, 1, 2, 3, 4, 7, 8, 9])
        })

        it('ends at tail position', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2)
            const actual: number[] = []
            list.forEach((n) => {
                actual.push(n)
                if (n === 1) {
                    list.pushAll(3, 4)
                }
            })
            expect(actual).toEqual([1, 2, 3, 4])
        })
    })

    describe('some', () => {
        it('iterates until true is returned', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4)
            const actual: number[] = []
            const found = list.some((n) => {
                actual.push(n)
                return n >= 3
            })
            expect(actual).toEqual([1, 2, 3])
            expect(found).toBeTrue()
        })

        it('returns false if predicate is never true', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4)
            const found = list.some(() => false)
            expect(found).toBeFalse()
        })

        it('skips removed elements', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4)
            const actual: number[] = []
            list.some((it) => {
                if (it === 1) list.clear()
                actual.push(it)
                return false
            })
            expect(actual).toEqual([1])
        })
    })

    describe('find', () => {
        it('returns the first node that matches the predicate', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 3, 4)
            const node = list.find((v) => v === 3)
            expect(node?.value).toBe(3)
            expect(node?.previous?.value).toBe(2)
        })

        it('returns null if predicate is never matched', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 3, 4)
            const node = list.find(() => false)
            expect(node).toBeNull()
        })

        it('skips removed elements', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4, 5)
            const node = list.find((it) => {
                if (it === 2) list.clear()
                return it === 3
            })
            expect(node).toBeNull()
        })
    })

    describe('findLast', () => {
        it('returns the last node that matches the predicate', () => {
            const list = new LinkedList<number>()
            list.pushAll(4, 3, 3, 2, 1)
            const node = list.findLast((v) => v === 3)
            expect(node?.value).toBe(3)
            expect(node?.next?.value).toBe(2)
        })

        it('returns null if predicate is never matched', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 3, 4)
            const node = list.findLast(() => false)
            expect(node).toBeNull()
        })

        it('skips removed elements', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4, 5, 6)
            const node = list.findLast((it) => {
                if (it === 5) list.clear()
                return it === 4
            })
            expect(node).toBeNull()
        })
    })

    describe('clear', () => {
        it('removes all elements', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4)
            list.clear()
            expect(list.empty).toBeTrue()
        })
    })

    describe('Symbol.iterator', () => {
        it('creates a new iterable iterator', () => {
            const list = new LinkedList<number>()
            expect(list[Symbol.iterator]()).toEqual(
                objectContaining({
                    [Symbol.iterator]: any(Function),
                    next: any(Function),
                })
            )
        })

        it('allows nested iteration', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4)
            let i = 1
            for (const iValue of list) {
                expect(iValue).toBe(i++)
                let j = 1
                for (const jValue of list) {
                    expect(jValue).toBe(j++)
                    let k = 1
                    for (const kValue of list) {
                        expect(kValue).toBe(k++)
                    }
                }
            }
        })
    })

    describe('createIterator', () => {
        it('iterates from the given start and end pointers using the next increment', () => {
            const list = new LinkedList<number>()
            list.pushAll(0, 1, 2, 3, 4, 5)
            const it = list.createIterator(
                list.head!.next,
                list.tail,
                (node) => node.next
            )
            expect(Array.from(it)).toEqual([1, 2, 3, 4])
        })

        it('skips removed elements', () => {
            const list = new LinkedList<number>()
            list.pushAll(0, 1, 2, 3, 4, 5)
            const it = list.createIterator(list.head, null, (node) => {
                if (node.value === 2) {
                    list.clear()
                }
                return node.next
            })
            expect(Array.from(it)).toEqual([0, 1, 2])
        })
    })

    describe('reversed', () => {
        it('creates a new iterable that iterates in reverse', () => {
            const list = new LinkedList<number>()
            list.pushAll(1, 2, 3, 4, 5, 6)
            expect(Array.from(list.reversed())).toEqual([6, 5, 4, 3, 2, 1])
            list.pop()
            expect(Array.from(list.reversed())).toEqual([5, 4, 3, 2, 1])
        })
    })
})

/**
 * Expects that the linked list when iterating from head to tail has the elements of the array,
 * and that reversed from tail to head are the reversed elements of the array.
 * This ensures that all pointers are correct.
 *
 * @param list
 * @param array
 */
function expectListEquals<T>(list: LinkedList<T>, array: readonly T[]) {
    let current: LinkedNode<T> | null = list.head
    let i = 0
    while (current) {
        if (i >= array.length)
            fail(`Expected next pointer to be null at length: ${i}`)
        if (i > 0)
            expect(current.previous?.value)
                .withContext(
                    `The node at index ${i} previous value did not match`
                )
                .toEqual(array[i - 1])
        expect(current.value)
            .withContext(`The node at index ${i} value did not match`)
            .toEqual(array[i])
        current = current.next
        i++
    }
    expect(list.tail?.value)
        .withContext('Tail did not match')
        .toEqual(array[array.length - 1])
}
