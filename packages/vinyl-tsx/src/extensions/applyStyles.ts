/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AllowBindable } from '../jsx'
import { onConnect } from './connectedObserver'
import { toKebabCase } from '@amazon/vinyl-util'
import {
    isObservableValue,
    type MaybeObservableValue,
} from '@amazon/vinyl-observable'
import type { Maybe } from '@amazon/vinyl-util'

/**
 * The shape accepted by the `style` jsx prop. Allows the typed CSSStyleDeclaration
 * fields plus any CSS custom property key (must start with `--`).
 */
export type StyleProp = AllowBindable<Partial<CSSStyleDeclaration>> & {
    readonly [customProperty: `--${string}`]: MaybeObservableValue<
        Maybe<string>
    >
}

export function applyStyles(element: HTMLElement, style: StyleProp) {
    // noinspection SuspiciousTypeOfGuard
    if (typeof style === 'string') {
        // A Partial style declaration type does not prohibit a string type.
        throw new Error('expected style property to be type object')
    }
    for (const k in style) {
        const v = (style as Record<string, unknown>)[k]
        // Custom properties (starting with `--`) are passed through as-is so
        // they aren't kebab-cased a second time, and so they remain valid keys
        // for setProperty.
        const property = k.startsWith('--') ? k : toKebabCase(k)
        if (isObservableValue(v)) {
            onConnect(element, () => {
                return v.onData((value) => {
                    element.style.setProperty(
                        property,
                        (value ?? null) as string | null
                    )
                })
            })
        } else {
            element.style.setProperty(property, (v ?? null) as string | null)
        }
    }
}
