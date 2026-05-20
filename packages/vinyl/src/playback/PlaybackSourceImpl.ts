/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CrossOrigin, PlaybackSource } from './PlaybackSource'

export interface PlaybackSourceImplDeps {
    readonly media: HTMLMediaElement
}

export class PlaybackSourceImpl implements PlaybackSource {
    protected readonly media: HTMLMediaElement

    constructor(deps: PlaybackSourceImplDeps) {
        this.media = deps.media
    }

    get crossOrigin(): CrossOrigin {
        return this.media.crossOrigin as CrossOrigin
    }

    set crossOrigin(value: CrossOrigin) {
        this.media.crossOrigin = value
    }

    get currentSrc(): string {
        return this.media.currentSrc
    }

    load(): void {
        this.media.load()
    }

    get src(): string {
        return this.media.src
    }

    set src(value: string | null) {
        if (!value) this.media.removeAttribute('src')
        else this.media.src = value
    }

    get srcObject(): MediaStream | null {
        return this.media.srcObject as MediaStream | null
    }

    set srcObject(value: MediaStream | null) {
        this.media.srcObject = value
    }

    get disableRemotePlayback(): boolean {
        return this.media.disableRemotePlayback
    }

    set disableRemotePlayback(value: boolean) {
        this.media.disableRemotePlayback = value
    }
}
