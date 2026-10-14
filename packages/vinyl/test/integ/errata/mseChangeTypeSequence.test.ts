/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Browser, hasBrowser } from '@amazon/vinyl-util'

/**
 * The WebKit bug for changeType() in "sequence" mode (see docs/ERRATA.md).
 */
const WEBKIT_CHANGE_TYPE_SEQUENCE_BUG =
    'https://bugs.webkit.org/show_bug.cgi?id=327788'

interface ChangeTypeSequenceResult {
    readonly supported: boolean
    readonly contiguous?: boolean
    readonly before?: readonly (readonly [number, number])[]
    readonly after?: readonly (readonly [number, number])[]
    readonly timestampOffset?: number
}

declare global {
    interface Window {
        runChangeTypeSequenceRepro?: () => Promise<ChangeTypeSequenceResult>
    }
}

/**
 * Loads the test bed shared with testResources/errata/mse-changetype-sequence.html.
 */
async function loadTestBed(): Promise<() => Promise<ChangeTypeSequenceResult>> {
    if (!window.runChangeTypeSequenceRepro) {
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'errata/mse-changetype-sequence.js'
            script.onload = () => resolve()
            script.onerror = () =>
                reject(new Error(`failed to load ${script.src}`))
            document.head.append(script)
        })
    }
    return window.runChangeTypeSequenceRepro!
}

/**
 * Browser errata canaries: each reproduces a browser bug that Vinyl works around, without Vinyl. A spec is pending
 * while the bug reproduces where it's known, and fails where it isn't.
 */
describe('errata', () => {
    it('continues the buffered media after changeType() in sequence mode', async () => {
        const result = await (await loadTestBed())()
        if (!result.supported)
            pending('changeType() or its codecs are not supported')
        if (!result.contiguous && hasBrowser(Browser.WEBKIT)) {
            pending(
                `WebKit appends at the media time after changeType(): ${WEBKIT_CHANGE_TYPE_SEQUENCE_BUG} ${JSON.stringify(result)}`
            )
        }
        expect(result.after)
            .withContext(JSON.stringify(result))
            .toEqual([[result.before![0][0], result.before![0][1] + 2]])
    })
})
