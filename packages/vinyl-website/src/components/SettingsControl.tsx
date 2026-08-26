/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsx } from '@amazon/vinyl-tsx'
import { data } from '@amazon/vinyl-observable'
import {
    playerState,
    setMaxVideoHeight,
    setPlaybackRate,
    setPreferDescriptiveAudio,
    setPreferredAudioLanguage,
    setPreferredTextLanguage,
} from '../player'
import { Icon, type IconName } from './icons'
import { isAudioDescription, type MediaQualityMetadata } from '@amazon/vinyl'

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
        media,
        textTracks$,
        playbackRate$,
        qualitiesUnfiltered$,
        maxVideoHeight$,
        preferredAudioLanguage$,
        preferredTextLanguage$,
        preferDescriptiveAudio$,
        hasVideo$,
    } = playerState

    const menuOpen$ = data(false)
    const view$ = data<View>('main')

    // Picture-in-picture state, tracked from the media element so the toggle
    // reflects reality even when PiP is dismissed from the browser UI.
    const inPip$ = data(document.pictureInPictureElement === media)

    const closeMenu = () => (menuOpen$.value = false)

    const togglePip = () => {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => {})
        } else {
            media.requestPictureInPicture().catch(() => {})
        }
    }

    const gearButton = (
        <button
            className="transportBtn"
            title="Settings"
            aria-label="Settings"
            aria-haspopup="menu"
            aria-expanded="false"
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
    ) as HTMLButtonElement

    return (
        <div className="settingsControl">
            {gearButton}
            <div
                className="settingsMenu"
                role="menu"
                aria-label="Settings"
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
                        if (captionLanguages().length > 0) {
                            rows.push(
                                mainRow(
                                    'closed_caption',
                                    'Subtitles/CC',
                                    captionLanguageLabel(
                                        preferredTextLanguage$.value
                                    ),
                                    () => (view$.value = 'captions')
                                )
                            )
                        }
                        rows.push(
                            mainRow(
                                'speed',
                                'Playback speed',
                                rateLabel(playbackRate$.value),
                                () => (view$.value = 'speed')
                            )
                        )
                        if (hasVideo$.value) {
                            rows.push(
                                mainRow(
                                    'high_quality',
                                    'Quality',
                                    heightLabel(maxVideoHeight$.value),
                                    () => (view$.value = 'resolution')
                                )
                            )
                        }
                        // Reachable when there is a real choice of audio
                        // languages, or when a descriptive-audio rendition
                        // offers a toggle even on a single-language stream.
                        if (
                            audioLanguages().length > 1 ||
                            hasAudioDescription()
                        ) {
                            rows.push(
                                mainRow(
                                    'language',
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
                                    'picture_in_picture_alt',
                                    'Picture in picture',
                                    inPip$.value,
                                    togglePip
                                )
                            )
                        }
                        return rows
                    }

                    const buildCaptionsView = (): HTMLElement[] => {
                        const current = preferredTextLanguage$.value
                        return [
                            header('Subtitles/CC'),
                            optionRow('Off', current == null, () => {
                                setPreferredTextLanguage(null)
                                view$.value = 'main'
                            }),
                            ...captionLanguages().map((lang) =>
                                optionRow(
                                    languageLabel(lang),
                                    lang === current,
                                    () => {
                                        setPreferredTextLanguage(lang)
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
                        const rows = [
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
                        if (hasAudioDescription()) {
                            rows.push(
                                toggleRow(
                                    'audio_description',
                                    'Audio description',
                                    preferDescriptiveAudio$.value,
                                    () =>
                                        setPreferDescriptiveAudio(
                                            !preferDescriptiveAudio$.value
                                        )
                                )
                            )
                        }
                        return rows
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

                    // Whether the stream offers an audio-description
                    // (described-video) rendition, so the toggle only appears
                    // when it can do something.
                    const hasAudioDescription = (): boolean =>
                        qualitiesUnfiltered$.value.some(
                            (q) =>
                                q.contentType === 'audio' &&
                                isAudioDescription(q)
                        )

                    // Distinct caption language tags from the discovered text
                    // tracks (forced-only tracks are excluded — the user picks a
                    // language and the player chooses the full track for it).
                    const captionLanguages = (): string[] => [
                        ...new Set(
                            textTracks$.value
                                .filter(
                                    (t) =>
                                        !t.forced &&
                                        t.language != null &&
                                        t.language !== ''
                                )
                                .map((t) => t.language as string)
                        ),
                    ]

                    const header = (title: string): HTMLElement => (
                        <button
                            className="settingsHeader"
                            role="menuitem"
                            tabIndex={0}
                            aria-label={`${title}, back`}
                            onclick={() => (view$.value = 'main')}
                        >
                            <Icon name="arrow_back" />
                            <span>{title}</span>
                        </button>
                    )

                    const mainRow = (
                        icon: IconName,
                        label: string,
                        value: string,
                        onClick: () => void
                    ): HTMLElement => (
                        <button
                            className="settingsRow"
                            role="menuitem"
                            tabIndex={0}
                            aria-label={`${label}, ${value}`}
                            onclick={onClick}
                        >
                            <span className="settingsRowIcon">
                                <Icon name={icon} />
                            </span>
                            <span className="settingsLabel">{label}</span>
                            <span className="settingsValue">
                                {value}
                                <Icon name="chevron_right" />
                            </span>
                        </button>
                    )

                    const toggleRow = (
                        icon: IconName,
                        label: string,
                        on: boolean,
                        onClick: () => void
                    ): HTMLElement => {
                        const row = (
                            <button
                                className="settingsRow"
                                role="menuitemcheckbox"
                                tabIndex={0}
                                aria-checked={on ? 'true' : 'false'}
                                aria-label={label}
                                onclick={onClick}
                            >
                                <span className="settingsRowIcon">
                                    <Icon name={icon} />
                                </span>
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
                                role="menuitemradio"
                                tabIndex={0}
                                aria-checked={selected ? 'true' : 'false'}
                                aria-label={label}
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
                        preferredTextLanguage$.onData(render),
                        playbackRate$.onData(render),
                        qualitiesUnfiltered$.onData(render),
                        maxVideoHeight$.onData(render),
                        preferredAudioLanguage$.onData(render),
                        preferDescriptiveAudio$.onData(render),
                        hasVideo$.onData(render),
                        inPip$.onData(render),
                    ]
                    render()

                    // Keyboard and focus management (ARIA menu pattern):
                    // arrows roam items within the current panel, Escape closes
                    // and returns focus to the gear button.
                    const menuItems = (): HTMLElement[] => [
                        ...el.querySelectorAll<HTMLElement>(
                            '[role^="menuitem"]'
                        ),
                    ]
                    const focusFirstItem = () => menuItems()[0]?.focus()
                    const onMenuKeydown = (e: KeyboardEvent) => {
                        if (e.key === 'Escape') {
                            closeMenu()
                            gearButton.focus()
                            return
                        }
                        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
                        e.preventDefault()
                        const items = menuItems()
                        if (items.length === 0) return
                        const index = items.indexOf(
                            document.activeElement as HTMLElement
                        )
                        const delta = e.key === 'ArrowDown' ? 1 : -1
                        items[
                            (index + delta + items.length) % items.length
                        ].focus()
                    }
                    el.addEventListener('keydown', onMenuKeydown)

                    // Move focus to the top of a freshly rendered panel when
                    // drilling in or back out (render runs first, via the sub
                    // above), but not on incidental content re-renders.
                    const unViewFocus = view$.onData(() => {
                        if (menuOpen$.value) focusFirstItem()
                    })

                    // Keep the PiP toggle in sync with the media element.
                    const onEnterPip = () => (inPip$.value = true)
                    const onLeavePip = () => (inPip$.value = false)
                    media.addEventListener('enterpictureinpicture', onEnterPip)
                    media.addEventListener('leavepictureinpicture', onLeavePip)

                    // Close (and reset to the main panel) on an outside click.
                    // The listener is attached only while the menu is open, its
                    // attach deferred one tick so the opening click does not
                    // immediately close it (mirrors CaptionsControl).
                    //
                    // Use the event's composed path rather than
                    // `contains(e.target)`: clicking a row synchronously
                    // re-renders the menu (`el.replaceChildren`), detaching the
                    // clicked button before the click bubbles here, which would
                    // make a `contains(e.target)` check see it as an outside
                    // click and close the menu mid-drill-in. `composedPath()` is
                    // captured at dispatch time and is immune to that mutation.
                    const onDocClick = (e: MouseEvent) => {
                        const root = el.parentElement
                        if (root && !e.composedPath().includes(root)) {
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
                        gearButton.setAttribute('aria-expanded', String(open))
                        detachDocClick()
                        if (open) {
                            focusFirstItem()
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
                        unViewFocus()
                        el.removeEventListener('keydown', onMenuKeydown)
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

function captionLanguageLabel(lang: string | null): string {
    return lang == null ? 'Off' : languageLabel(lang)
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
