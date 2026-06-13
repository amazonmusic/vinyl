/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsx } from '@amazon/vinyl-tsx'
import { data } from '@amazon/vinyl-observable'
import { playerState } from '../player'
import { Icon } from './icons'
import type { TextTrackInfo } from '@amazon/vinyl'

export function CaptionsControl() {
    const {
        player,
        textTracks$,
        activeTextTrack$,
        captionsEnabled$,
        preferredLanguage$,
    } = playerState
    const menuOpen$ = data(false)

    const visible$ = textTracks$.map((tracks) => tracks.length > 0)

    const closeMenu = () => (menuOpen$.value = false)

    const activateTrack = (info: TextTrackInfo) => {
        player.setActiveTextTrack(info.id)
        captionsEnabled$.value = true
        preferredLanguage$.value = info.language
    }

    const deactivate = () => {
        player.setActiveTextTrack(null)
        captionsEnabled$.value = false
    }

    const onCcClick = () => {
        const tracks = textTracks$.value
        const active = activeTextTrack$.value
        if (tracks.length > 1) {
            menuOpen$.value = !menuOpen$.value
        } else if (active) {
            deactivate()
        } else if (tracks.length === 1) {
            activateTrack(tracks[0])
        }
    }

    const selectTrack = (id: string | null) => {
        if (id == null) {
            deactivate()
        } else {
            const target = textTracks$.value.find((t) => t.id === id)
            if (target) activateTrack(target)
        }
        closeMenu()
    }

    return (
        <div className="captionsControl" visible={visible$}>
            <button
                className="transportBtn"
                classList={[activeTextTrack$.map((t) => (t ? 'active' : null))]}
                title="Captions"
                aria-label="Toggle captions"
                onclick={onCcClick}
            >
                <Icon name="closed_caption" />
            </button>
            <div
                className="captionsMenu"
                visible={menuOpen$}
                onConnect={(el) => {
                    const rebuild = (tracks: readonly TextTrackInfo[]) => {
                        el.replaceChildren(
                            renderItem('Off', null, selectTrack),
                            ...tracks.map((t) =>
                                renderItem(trackLabel(t), t.id, selectTrack)
                            )
                        )
                        applySelection(el, activeTextTrack$.value?.id ?? null)
                    }
                    const unTracks = textTracks$.onData(rebuild)
                    rebuild(textTracks$.value)
                    const unActive = activeTextTrack$.onData((t) => {
                        applySelection(el, t?.id ?? null)
                    })
                    const onDocClick = (e: MouseEvent) => {
                        if (!el.contains(e.target as Node)) closeMenu()
                    }
                    // Defer so the click that opened the menu doesn't close it.
                    const timerId = setTimeout(
                        () => document.addEventListener('click', onDocClick),
                        0
                    )
                    return () => {
                        clearTimeout(timerId)
                        document.removeEventListener('click', onDocClick)
                        unTracks()
                        unActive()
                    }
                }}
            />
        </div>
    )
}

function renderItem(
    label: string,
    id: string | null,
    onSelect: (id: string | null) => void
): HTMLElement {
    const btn = (
        <button
            className="captionsMenuItem"
            onclick={() => onSelect(id)}
            data-track-id={id ?? '__off__'}
        >
            {label}
        </button>
    )
    return btn
}

function applySelection(menu: HTMLElement, activeId: string | null): void {
    const key = activeId ?? '__off__'
    for (const child of Array.from(menu.children)) {
        const el = child as HTMLElement
        el.classList.toggle('selected', el.dataset.trackId === key)
    }
}

function trackLabel(t: TextTrackInfo): string {
    if (t.label && t.language) return `${t.label} (${t.language})`
    return t.label || t.language || t.id
}
