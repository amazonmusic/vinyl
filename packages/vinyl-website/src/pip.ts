/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { data } from '@amazon/vinyl-observable'
import { initializeConnectedObserver } from '@amazon/vinyl-tsx'
import { Browser, hasBrowser } from '@amazon/vinyl-util'

// Picture-in-picture for the demo's video.
//
// In Chromium the video stage — video, HTML captions and ad overlay — moves into
// a Document Picture-in-Picture window as is: Chromium's video-only PiP window
// shows no captions at all. Elsewhere (Firefox, Safari) the video element itself
// goes into PiP, and the caption renderer hands captions to the browser to paint
// (see HtmlTextTrackRenderer). Firefox has Document PiP too, but its autoplay
// policy checks the PiP window's own user activation, which it has none of
// until clicked: the play() after an ad switches tracks is rejected there.
//
// The browser's own PiP affordances (Firefox's hover toggle, Chrome's auto-PiP)
// are hidden with `disablePictureInPicture`; the settings menu offers PiP
// instead.

/** How the video is in picture-in-picture, if it is. */
export type PipMode = 'none' | 'element' | 'document'

interface DocumentPictureInPicture {
    requestWindow(options?: {
        width?: number
        height?: number
    }): Promise<Window>
}

/**
 * Document Picture-in-Picture, where it's used: Chromium only (see the note
 * above for Firefox).
 */
function documentPip(): DocumentPictureInPicture | null {
    if (!hasBrowser(Browser.CHROMIUM)) return null
    return (
        (window as { documentPictureInPicture?: DocumentPictureInPicture })
            .documentPictureInPicture ?? null
    )
}

export const pipMode$ = data<PipMode>('none')

/**
 * How long the stage's controls (and the cursor) stay after the last
 * interaction, in fullscreen and in a Document Picture-in-Picture window.
 */
export const HIDE_CONTROLS_MS = 3000

/** The interactions that show the controls. */
const INTERACTION_EVENTS = ['pointermove', 'pointerdown', 'keydown'] as const

/** The Document Picture-in-Picture window's initial width, in CSS pixels. */
const PIP_WIDTH = 480

let media: HTMLVideoElement | null = null
// The element whose children make up the video stage (see registerPipStage).
let stage: HTMLElement | null = null
let pipWindow: Window | null = null

/** Sets up picture-in-picture for `video`. */
export function initializePip(video: HTMLVideoElement): void {
    media = video
    video.disablePictureInPicture = true
    video.addEventListener('enterpictureinpicture', () => {
        pipMode$.value = 'element'
    })
    video.addEventListener('leavepictureinpicture', () => {
        // Re-disabling while in PiP would close the window, so only now.
        video.disablePictureInPicture = true
        if (pipMode$.value === 'element') pipMode$.value = 'none'
    })
}

/**
 * Registers the element holding the video stage (the video, caption overlay
 * and ad overlay), moved into a Document Picture-in-Picture window.
 */
export function registerPipStage(element: HTMLElement | null): void {
    stage = element
}

/** Whether picture-in-picture is available. */
export function pipSupported(): boolean {
    return (
        documentPip() != null ||
        ('pictureInPictureEnabled' in document &&
            document.pictureInPictureEnabled)
    )
}

/** Enters picture-in-picture, or leaves it. */
export function togglePip(): void {
    if (pipWindow) {
        pipWindow.close()
    } else if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {})
    } else if (documentPip() && stage) {
        openDocumentPip(documentPip()!, stage).catch(() => {})
    } else {
        requestElementPip().catch(() => {})
    }
}

/**
 * Enters element picture-in-picture. A disabled element rejects
 * `requestPictureInPicture()`, so the flag is lifted just for this request.
 */
function requestElementPip(): Promise<unknown> {
    const video = media
    if (!video) return Promise.reject(new Error('no media'))
    video.disablePictureInPicture = false
    return video.requestPictureInPicture().catch((error: unknown) => {
        if (document.pictureInPictureElement !== video) {
            video.disablePictureInPicture = true
        }
        throw error
    })
}

/** Copies the page's styles (and theme) into the PiP window's document. */
function copyStyles(target: Document): void {
    for (const sheet of Array.from(document.styleSheets)) {
        const owner = sheet.ownerNode
        if (owner instanceof HTMLLinkElement) {
            const link = target.createElement('link')
            link.rel = 'stylesheet'
            link.href = owner.href
            target.head.append(link)
            continue
        }
        try {
            const style = target.createElement('style')
            style.textContent = Array.from(
                sheet.cssRules,
                (r) => r.cssText
            ).join('\n')
            target.head.append(style)
        } catch {
            // A cross-origin sheet without a link owner; skip it.
        }
    }
    const theme = document.documentElement.getAttribute('data-theme')
    if (theme) target.documentElement.setAttribute('data-theme', theme)
}

async function openDocumentPip(
    api: DocumentPictureInPicture,
    from: HTMLElement
): Promise<void> {
    // Size the window to the video's aspect ratio (16:9 until it's known).
    const video = media
    const aspect =
        video && video.videoWidth > 0 && video.videoHeight > 0
            ? video.videoWidth / video.videoHeight
            : 16 / 9
    const width = PIP_WIDTH
    const win = await api.requestWindow({
        width,
        height: Math.round(width / aspect),
    })
    const doc = win.document
    copyStyles(doc)
    doc.title = document.title
    const host = doc.createElement('div')
    host.className = 'transportVideo pipWindowStage'
    doc.body.style.margin = '0'
    doc.body.append(host)
    // As on the fullscreen stage: interaction shows the controls (and cursor),
    // which hide again after HIDE_CONTROLS_MS without any.
    let hideTimer: ReturnType<typeof setTimeout> | undefined
    const showControls = () => {
        host.classList.remove('controlsHidden')
        clearTimeout(hideTimer)
        hideTimer = setTimeout(
            () => host.classList.add('controlsHidden'),
            HIDE_CONTROLS_MS
        )
    }
    showControls()
    for (const type of INTERACTION_EVENTS) {
        doc.addEventListener(type, showControls)
    }
    // Keep the moved nodes' onConnect bindings (ad overlay, etc.) live.
    const stopObserving = initializeConnectedObserver({ root: doc })
    host.append(...Array.from(from.childNodes))
    pipWindow = win
    pipMode$.value = 'document'
    win.addEventListener(
        'pagehide',
        () => {
            from.append(...Array.from(host.childNodes))
            stopObserving()
            clearTimeout(hideTimer)
            pipWindow = null
            pipMode$.value = 'none'
        },
        { once: true }
    )
}
