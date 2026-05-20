/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { walkDomDepthFirst } from '../domUtil'
import type { Maybe, Unsubscribe } from '@amazon/vinyl-util'

/**
 * Dispatches a 'connected' event on nodes attached to the dom, dispatches 'disconnected' when removed.
 * Allows nodes to observe connected changes without creating a memory leak.
 */
export function initializeConnectedObserver(): Unsubscribe {
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
                    iNode.dispatchEvent(
                        new CustomEvent('connect', { bubbles: false })
                    )
                })
            }

            for (const node of mutation.removedNodes) {
                if (added.has(node)) continue
                walkDomDepthFirst(node, (iNode) => {
                    iNode.dispatchEvent(
                        new CustomEvent('disconnect', { bubbles: false })
                    )
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
    target.addEventListener('connect', onConnect)
    target.addEventListener('disconnect', onDisconnect)
    if (target.isConnected) onConnect()
    return () => {
        target.removeEventListener('connect', onConnect)
        target.removeEventListener('disconnect', onDisconnect)
        onDisconnect()
    }
}
