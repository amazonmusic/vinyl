/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

;(window as any).global = globalThis

if (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    !HTMLVideoElement.prototype.requestFullscreen &&
    (HTMLVideoElement.prototype as any).webkitEnterFullscreen
) {
    HTMLVideoElement.prototype.requestFullscreen = function () {
        ;(this as any).webkitEnterFullscreen()
        return Promise.resolve()
    }
}
