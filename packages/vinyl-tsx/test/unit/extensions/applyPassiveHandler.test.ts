/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { passiveEventHandlers } from '@amazon/vinyl-tsx'
import { installDomPolyfill } from '../domPolyfill'

import createSpy = jasmine.createSpy

describe('applyPassiveHandler', () => {
    const dom = installDomPolyfill()

    it('registers ontouchstart as passive listener', () => {
        const el = dom.createElement('div')
        const handler = createSpy('handler')

        passiveEventHandlers.ontouchstart(el, handler)
        expect(el.addEventListener).toHaveBeenCalledWith(
            'touchstart',
            handler,
            {
                passive: true,
            }
        )
    })

    it('registers ontouchmove as passive listener', () => {
        const el = dom.createElement('div')
        const handler = createSpy('handler')

        passiveEventHandlers.ontouchmove(el, handler)
        expect(el.addEventListener).toHaveBeenCalledWith('touchmove', handler, {
            passive: true,
        })
    })

    it('registers onwheel as passive listener', () => {
        const el = dom.createElement('div')
        const handler = createSpy('handler')

        passiveEventHandlers.onwheel(el, handler)
        expect(el.addEventListener).toHaveBeenCalledWith('wheel', handler, {
            passive: true,
        })
    })
})
