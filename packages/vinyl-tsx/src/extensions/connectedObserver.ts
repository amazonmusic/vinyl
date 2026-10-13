/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { walkDomDepthFirst } from '../domUtil'
import type { Maybe, Unsubscribe } from '@amazon/vinyl-util'

/**
 * Where {@link onConnect} keeps a node's callbacks, so the observer can call them without an event
 * dispatch. A registered symbol, so every copy of this library on a page shares it.
 */
const CONNECTION_CALLBACKS: unique symbol = Symbol.for(
    '@amazon/vinyl-tsx/connectionCallbacks'
)

interface ConnectionCallbacks {
    readonly connect: Set<() => void>
    readonly disconnect: Set<() => void>
}

type ObservedNode = Node & { [CONNECTION_CALLBACKS]?: ConnectionCallbacks }

function callbacksOf(node: Node): ConnectionCallbacks {
    const observed = node as ObservedNode
    let callbacks = observed[CONNECTION_CALLBACKS]
    if (!callbacks) {
        callbacks = { connect: new Set(), disconnect: new Set() }
        observed[CONNECTION_CALLBACKS] = callbacks
    }
    return callbacks
}

function notify(node: Node, type: keyof ConnectionCallbacks): void {
    const callbacks = (node as ObservedNode)[CONNECTION_CALLBACKS]?.[type]
    if (callbacks?.size) for (const callback of [...callbacks]) callback()
}

export interface ConnectedObserverOptions {
    /**
     * Whether to dispatch a `connect` / `disconnect` DOM event on every node of an added or removed
     * subtree, for listeners added with `addEventListener` (default true). {@link onConnect}
     * callbacks run either way. Without the events, mounting or removing a large tree skips one
     * event dispatch per node, which otherwise dominates the observer's cost.
     */
    readonly events?: boolean
}

/**
 * Dispatches a 'connected' event on nodes attached to the dom, dispatches 'disconnected' when removed.
 * Allows nodes to observe connected changes without creating a memory leak.
 */
export function initializeConnectedObserver(
    options: ConnectedObserverOptions = {}
): Unsubscribe {
    const events = options.events ?? true
    const observer = new MutationObserver((mutations) => {
        const removed = new Set<Node>()
        const added = new Set<Node>()

        // First pass: flatten removed and added nodes so we can detect nodes re-ordered.
        for (const mutation of mutations) {
            mutation.removedNodes.forEach((node) => removed.add(node))
            mutation.addedNodes.forEach((node) => added.add(node))
        }

        // Second pass: handle added/removed, skipping reorders
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (removed.has(node)) continue
                walkDomDepthFirst(node, (iNode) => {
                    notify(iNode, 'connect')
                    if (events) {
                        iNode.dispatchEvent(
                            new CustomEvent('connect', { bubbles: false })
                        )
                    }
                })
            }

            for (const node of mutation.removedNodes) {
                if (added.has(node)) continue
                walkDomDepthFirst(node, (iNode) => {
                    notify(iNode, 'disconnect')
                    if (events) {
                        iNode.dispatchEvent(
                            new CustomEvent('disconnect', { bubbles: false })
                        )
                    }
                })
            }
        }
    })

    observer.observe(document, { childList: true, subtree: true })

    return () => {
        observer.disconnect()
    }
}

/**
 * Invokes a callback when the given target is connected to the DOM.
 * If the callback returns a function, that function will be invoked when disconnected.
 *
 * @param target
 * @param callback
 */
export function onConnect<T extends Node>(
    target: T,
    callback: (node: T) => Maybe<Unsubscribe> | void
): Unsubscribe {
    let sub: Maybe<Unsubscribe> | void = null
    let connected = false
    const onConnect = () => {
        if (connected) return
        connected = true
        sub = callback(target)
    }
    const onDisconnect = () => {
        connected = false
        sub?.()
        sub = null
    }
    const callbacks = callbacksOf(target)
    callbacks.connect.add(onConnect)
    callbacks.disconnect.add(onDisconnect)
    // Still listening for the events, for an observer from an older copy of this library.
    target.addEventListener('connect', onConnect)
    target.addEventListener('disconnect', onDisconnect)
    if (target.isConnected) onConnect()
    return () => {
        callbacks.connect.delete(onConnect)
        callbacks.disconnect.delete(onDisconnect)
        target.removeEventListener('connect', onConnect)
        target.removeEventListener('disconnect', onDisconnect)
        onDisconnect()
    }
}
