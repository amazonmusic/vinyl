/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsx } from '@amazon/vinyl-tsx'
import { data } from '@amazon/vinyl-observable'
import {
    captionPreferenceOf,
    playerState,
    setMaxVideoHeight,
    setPlaybackRate,
    setPreferredAudioLanguage,
} from '../player'
import { Icon } from './icons'
import type { MediaQualityMetadata, TextTrackInfo } from '@amazon/vinyl'

/** Which panel of the settings menu is currently shown. */
type View = 'main' | 'captions' | 'speed' | 'resolution' | 'audio'

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const

/**
 * A Shaka-style settings menu: a gear button that opens an overflow menu whose
 * rows (captions, playback speed, max resolution, audio language) drill into
 * option sub-panels, plus a picture-in-picture toggle.
 */
export function SettingsControl() {
    const {
        player,
        media,
        textTracks$,
        activeTextTrack$,
        captionsEnabled$,
        playbackRate$,
        qualitiesUnfiltered$,
        maxVideoHeight$,
        preferredAudioLanguage$,
        hasVideo$,
    } = playerState

    const menuOpen$ = data(false)
    const view$ = data<View>('main')

    // Picture-in-picture state, tracked from the media element so the toggle
    // reflects reality even when PiP is dismissed from the browser UI.
    const inPip$ = data(document.pictureInPictureElement === media)

    const closeMenu = () => (menuOpen$.value = false)

    // --- captions selection (relocated from CaptionsControl) ---
    const activateTrack = (info: TextTrackInfo) => {
        player.setActiveTextTrack(info.id)
        captionsEnabled$.value = true
        playerState.preferredTextTrack$.value = captionPreferenceOf(info)
    }
    const selectTextTrack = (id: string | null) => {
        if (id == null) {
            player.setActiveTextTrack(null)
            captionsEnabled$.value = false
        } else {
            const target = textTracks$.value.find((t) => t.id === id)
            if (target) activateTrack(target)
        }
    }

    const togglePip = () => {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => {})
        } else {
            media.requestPictureInPicture().catch(() => {})
        }
    }

    return (
        <div className="settingsControl">
            <button
                className="transportBtn"
                title="Settings"
                aria-label="Settings"
                onclick={() => {
                    if (menuOpen$.value) {
                        closeMenu()
                    } else {
                        view$.value = 'main'
                        menuOpen$.value = true
                    }
                }}
            >
                <Icon name="settings" />
            </button>
            <div
                className="settingsMenu"
                visible={menuOpen$}
                onConnect={(el) => {
                    const render = () => el.replaceChildren(...buildView())

                    const buildView = (): HTMLElement[] => {
                        switch (view$.value) {
                            case 'captions':
                                return buildCaptionsView()
                            case 'speed':
                                return buildSpeedView()
                            case 'resolution':
                                return buildResolutionView()
                            case 'audio':
                                return buildAudioView()
                            default:
                                return buildMainView()
                        }
                    }

                    const buildMainView = (): HTMLElement[] => {
                        const rows: HTMLElement[] = []
                        const tracks = textTracks$.value
                        if (tracks.length > 0) {
                            rows.push(
                                mainRow(
                                    'Subtitles/CC',
                                    captionValueLabel(activeTextTrack$.value),
                                    () => (view$.value = 'captions')
                                )
                            )
                        }
                        rows.push(
                            mainRow(
                                'Playback speed',
                                rateLabel(playbackRate$.value),
                                () => (view$.value = 'speed')
                            )
                        )
                        if (hasVideo$.value) {
                            rows.push(
                                mainRow(
                                    'Quality',
                                    heightLabel(maxVideoHeight$.value),
                                    () => (view$.value = 'resolution')
                                )
                            )
                        }
                        if (audioLanguages().length > 1) {
                            rows.push(
                                mainRow(
                                    'Audio language',
                                    languageLabel(
                                        preferredAudioLanguage$.value
                                    ),
                                    () => (view$.value = 'audio')
                                )
                            )
                        }
                        if (
                            hasVideo$.value &&
                            document.pictureInPictureEnabled
                        ) {
                            rows.push(
                                toggleRow(
                                    'Picture in picture',
                                    inPip$.value,
                                    togglePip
                                )
                            )
                        }
                        return rows
                    }

                    const buildCaptionsView = (): HTMLElement[] => {
                        const activeId = activeTextTrack$.value?.id ?? null
                        return [
                            header('Subtitles/CC'),
                            optionRow('Off', activeId == null, () => {
                                selectTextTrack(null)
                                view$.value = 'main'
                            }),
                            ...textTracks$.value.map((t) =>
                                optionRow(
                                    trackLabel(t),
                                    t.id === activeId,
                                    () => {
                                        selectTextTrack(t.id)
                                        view$.value = 'main'
                                    }
                                )
                            ),
                        ]
                    }

                    const buildSpeedView = (): HTMLElement[] => {
                        const current = playbackRate$.value
                        return [
                            header('Playback speed'),
                            ...PLAYBACK_RATES.map((r) =>
                                optionRow(rateLabel(r), r === current, () => {
                                    setPlaybackRate(r)
                                    view$.value = 'main'
                                })
                            ),
                        ]
                    }

                    const buildResolutionView = (): HTMLElement[] => {
                        const current = maxVideoHeight$.value
                        const heights = videoHeights()
                        return [
                            header('Quality'),
                            optionRow('Auto', current == null, () => {
                                setMaxVideoHeight(null)
                                view$.value = 'main'
                            }),
                            ...heights.map((h) =>
                                optionRow(heightLabel(h), h === current, () => {
                                    setMaxVideoHeight(h)
                                    view$.value = 'main'
                                })
                            ),
                        ]
                    }

                    const buildAudioView = (): HTMLElement[] => {
                        const current = preferredAudioLanguage$.value
                        return [
                            header('Audio language'),
                            optionRow('Auto', current == null, () => {
                                setPreferredAudioLanguage(null)
                                view$.value = 'main'
                            }),
                            ...audioLanguages().map((lang) =>
                                optionRow(
                                    languageLabel(lang),
                                    lang === current,
                                    () => {
                                        setPreferredAudioLanguage(lang)
                                        view$.value = 'main'
                                    }
                                )
                            ),
                        ]
                    }

                    // Distinct video heights (descending) drawn from the
                    // unfiltered qualities, so the cap options do not shrink as
                    // the cap itself filters the active quality list.
                    const videoHeights = (): number[] =>
                        [
                            ...new Set(
                                qualitiesUnfiltered$.value
                                    .filter(
                                        (
                                            q
                                        ): q is MediaQualityMetadata & {
                                            height: number
                                        } =>
                                            q.contentType === 'video' &&
                                            q.height != null
                                    )
                                    .map((q) => q.height)
                            ),
                        ].sort((a, b) => b - a)

                    // Distinct audio language tags from the unfiltered qualities.
                    const audioLanguages = (): string[] => [
                        ...new Set(
                            qualitiesUnfiltered$.value
                                .filter(
                                    (
                                        q
                                    ): q is MediaQualityMetadata & {
                                        lang: string
                                    } =>
                                        q.contentType === 'audio' &&
                                        q.lang != null &&
                                        q.lang !== ''
                                )
                                .map((q) => q.lang)
                        ),
                    ]

                    const header = (title: string): HTMLElement => (
                        <button
                            className="settingsHeader"
                            onclick={() => (view$.value = 'main')}
                        >
                            <Icon name="arrow_back" />
                            <span>{title}</span>
                        </button>
                    )

                    const mainRow = (
                        label: string,
                        value: string,
                        onClick: () => void
                    ): HTMLElement => (
                        <button className="settingsRow" onclick={onClick}>
                            <span className="settingsLabel">{label}</span>
                            <span className="settingsValue">
                                {value}
                                <Icon name="chevron_right" />
                            </span>
                        </button>
                    )

                    const toggleRow = (
                        label: string,
                        on: boolean,
                        onClick: () => void
                    ): HTMLElement => {
                        const row = (
                            <button className="settingsRow" onclick={onClick}>
                                <span className="settingsLabel">{label}</span>
                                <span className="settingsValue">
                                    {on ? 'On' : 'Off'}
                                </span>
                            </button>
                        )
                        if (on) row.classList.add('selected')
                        return row
                    }

                    const optionRow = (
                        label: string,
                        selected: boolean,
                        onClick: () => void
                    ): HTMLElement => {
                        const row = (
                            <button
                                className="settingsOption"
                                onclick={onClick}
                            >
                                <span className="settingsCheck">
                                    {selected ? <Icon name="check" /> : ''}
                                </span>
                                <span>{label}</span>
                            </button>
                        )
                        if (selected) row.classList.add('selected')
                        return row
                    }

                    // Re-render on any change that affects the menu contents.
                    const subs = [
                        view$.onData(render),
                        textTracks$.onData(render),
                        activeTextTrack$.onData(render),
                        playbackRate$.onData(render),
                        qualitiesUnfiltered$.onData(render),
                        maxVideoHeight$.onData(render),
                        preferredAudioLanguage$.onData(render),
                        hasVideo$.onData(render),
                        inPip$.onData(render),
                    ]
                    render()

                    // Keep the PiP toggle in sync with the media element.
                    const onEnterPip = () => (inPip$.value = true)
                    const onLeavePip = () => (inPip$.value = false)
                    media.addEventListener('enterpictureinpicture', onEnterPip)
                    media.addEventListener('leavepictureinpicture', onLeavePip)

                    // Close (and reset to the main panel) on an outside click.
                    // The listener is attached only while the menu is open, its
                    // attach deferred one tick so the opening click does not
                    // immediately close it (mirrors CaptionsControl).
                    const onDocClick = (e: MouseEvent) => {
                        if (!el.parentElement?.contains(e.target as Node)) {
                            closeMenu()
                        }
                    }
                    let timerId: ReturnType<typeof setTimeout> | null = null
                    const detachDocClick = () => {
                        if (timerId != null) {
                            clearTimeout(timerId)
                            timerId = null
                        }
                        document.removeEventListener('click', onDocClick)
                    }
                    const unMenuOpen = menuOpen$.onData((open) => {
                        detachDocClick()
                        if (open) {
                            timerId = setTimeout(() => {
                                timerId = null
                                document.addEventListener('click', onDocClick)
                            }, 0)
                        } else {
                            // Reset to the main panel for the next open.
                            view$.value = 'main'
                        }
                    })

                    return () => {
                        detachDocClick()
                        unMenuOpen()
                        for (const un of subs) un()
                        media.removeEventListener(
                            'enterpictureinpicture',
                            onEnterPip
                        )
                        media.removeEventListener(
                            'leavepictureinpicture',
                            onLeavePip
                        )
                    }
                }}
            />
        </div>
    )
}

function captionValueLabel(active: TextTrackInfo | null): string {
    return active ? trackLabel(active) : 'Off'
}

function rateLabel(rate: number): string {
    return rate === 1 ? 'Normal' : `${rate}x`
}

function heightLabel(height: number | null): string {
    return height == null ? 'Auto' : `${height}p`
}

function languageLabel(lang: string | null): string {
    if (lang == null) return 'Auto'
    try {
        const names = new Intl.DisplayNames([navigator.language], {
            type: 'language',
        })
        return names.of(lang) ?? lang
    } catch {
        return lang
    }
}

function trackLabel(t: TextTrackInfo): string {
    if (t.label && t.language) return `${t.label} (${t.language})`
    return t.label || t.language || t.id
}
