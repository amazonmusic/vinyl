/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { annotatePureComments } from '@amazon/vinyl-build-utils'

describe('pureExportsPlugin', () => {
    it('adds PURE annotation to global scoped call and new expressions', () => {
        const input = `
            export const validators = {
                foo: someValidator(),
                bar: new SomeClass()
            }
        `
        const output = annotatePureComments(input)
        expect(output).toContain('/* @__PURE__ */ someValidator()')
        expect(output).toContain('/* @__PURE__ */ new SomeClass()')
    })

    it('does not annotate expressions inside functions', () => {
        const input = `
            function makeThing() {
                return {
                    nested: new Map(),
                    also: someCall()
                }
            }
        `
        const output = annotatePureComments(input)

        expect(output).not.toContain('/* @__PURE__ */ new Map()')
        expect(output).not.toContain('/* @__PURE__ */ someCall()')
    })

    it('does not annotate expressions inside object methods', () => {
        const input = `
            const obj = {
                method() {
                    return {
                        x: someCall()
                    }
                }
            }
        `
        const output = annotatePureComments(input)
        expect(output).not.toContain('/* @__PURE__ */ someCall()')
    })
})
