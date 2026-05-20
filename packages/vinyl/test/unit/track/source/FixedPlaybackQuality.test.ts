/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createEmptyMediaQualityMetadata,
    FixedPlaybackQuality,
    type MediaQualityMetadata,
    PlaybackReadyState,
    type TrackEventMap,
} from '@amazon/vinyl'
import { MockPlaybackController } from '@amazon/vinyl/vinylTestUtil'

import type { EventSpy } from '@amazon/vinyl-util/testUtil'
import { createEventSpy } from '@amazon/vinyl-util/testUtil'

describe('FixedPlaybackQuality', () => {
    let fixedPlaybackQuality: FixedPlaybackQuality
    let playbackController: MockPlaybackController
    const fixedQuality: MediaQualityMetadata = {
        ...createEmptyMediaQualityMetadata(),
        contentType: 'audio',
    }
    let playbackQualityChange: EventSpy<TrackEventMap, 'playbackQualityChange'>
    let bufferingQualityChange: EventSpy<
        TrackEventMap,
        'bufferingQualityChange'
    >
    let streamingQualityChange: EventSpy<
        TrackEventMap,
        'streamingQualityChange'
    >

    beforeEach(() => {
        playbackController = new MockPlaybackController()
        fixedPlaybackQuality = new FixedPlaybackQuality(fixedQuality, {
            playbackController,
        })
        playbackQualityChange = createEventSpy(
            fixedPlaybackQuality,
            'playbackQualityChange'
        )
        bufferingQualityChange = createEventSpy(
            fixedPlaybackQuality,
            'bufferingQualityChange'
        )
        streamingQualityChange = createEventSpy(
            fixedPlaybackQuality,
            'streamingQualityChange'
        )
    })

    describe('contentTypes', () => {
        it('returns content type from fixed quality', () => {
            expect(fixedPlaybackQuality.contentTypes).toEqual(
                new Set(['audio'])
            )
        })

        it('updates when fixed quality changes', () => {
            fixedPlaybackQuality.fixedQuality = {
                ...createEmptyMediaQualityMetadata(),
                contentType: 'video',
            }
            expect(fixedPlaybackQuality.contentTypes).toEqual(
                new Set(['video'])
            )
        })

        it('returns empty set when content type is null', () => {
            fixedPlaybackQuality.fixedQuality = {
                ...createEmptyMediaQualityMetadata(),
                contentType: null,
            }
            expect(fixedPlaybackQuality.contentTypes).toEqual(new Set())
        })
    })

    describe('getStreamingQuality', () => {
        it('returns fixed quality for matching content type', () => {
            expect(fixedPlaybackQuality.getStreamingQuality('audio')).toBe(
                fixedQuality
            )
        })

        it('returns null for non-matching content type', () => {
            expect(fixedPlaybackQuality.getStreamingQuality('video')).toBeNull()
        })

        it('updates when fixed quality changes', () => {
            const fixedQuality2: MediaQualityMetadata = {
                ...createEmptyMediaQualityMetadata(),
                mimeType: 'audio/mp4',
                contentType: 'audio',
            }
            fixedPlaybackQuality.fixedQuality = fixedQuality2
            expect(fixedPlaybackQuality.getStreamingQuality('audio')).toBe(
                fixedQuality2
            )
        })

        it('returns null when content type is null', () => {
            fixedPlaybackQuality.fixedQuality = {
                ...createEmptyMediaQualityMetadata(),
                contentType: null,
            }
            expect(fixedPlaybackQuality.getStreamingQuality('audio')).toBeNull()
        })
    })

    describe('when activated', () => {
        beforeEach(() => {
            fixedPlaybackQuality.activate()
        })

        it('getBufferingQuality returns fixedQuality for matching content type', () => {
            expect(fixedPlaybackQuality.getBufferingQuality('audio')).toEqual(
                fixedQuality
            )
        })

        it('getBufferingQuality returns null for non-matching content type', () => {
            expect(fixedPlaybackQuality.getBufferingQuality('video')).toBeNull()
        })

        it('emits bufferingQualityChange event', () => {
            expect(bufferingQualityChange).toHaveBeenCalledOnceWith({
                previous: null,
                current: fixedQuality,
            })
        })

        it('no-ops when setting same buffering quality again', () => {
            bufferingQualityChange.calls.reset()
            // Change the fixed quality to the same value, which should trigger the setter with the same value
            fixedPlaybackQuality.fixedQuality = fixedQuality
            expect(bufferingQualityChange).not.toHaveBeenCalled()
        })
    })

    describe('when deactivated', () => {
        it('getBufferingQuality returns null', () => {
            expect(fixedPlaybackQuality.getBufferingQuality('audio')).toEqual(
                null
            )
            fixedPlaybackQuality.activate()
            expect(fixedPlaybackQuality.getBufferingQuality('audio')).toEqual(
                fixedQuality
            )
            fixedPlaybackQuality.deactivate()
            expect(fixedPlaybackQuality.getBufferingQuality('audio')).toEqual(
                null
            )
        })

        it('emits bufferingQualityChange event', () => {
            fixedPlaybackQuality.activate()
            bufferingQualityChange.calls.reset()
            fixedPlaybackQuality.deactivate()
            expect(bufferingQualityChange).toHaveBeenCalledOnceWith({
                previous: fixedQuality,
                current: null,
            })
        })
    })

    describe('when readyState is at least HAVE_CURRENT_DATA', () => {
        beforeEach(() => {
            playbackController.readyState = PlaybackReadyState.HAVE_CURRENT_DATA
        })

        describe('then activated', () => {
            beforeEach(() => {
                fixedPlaybackQuality.activate()
            })

            describe('getPlaybackQuality', () => {
                it('returns fixedQuality for matching content type', () => {
                    expect(
                        fixedPlaybackQuality.getPlaybackQuality('audio')
                    ).toEqual(fixedQuality)
                })

                it('returns null for non-matching content type', () => {
                    expect(
                        fixedPlaybackQuality.getPlaybackQuality('video')
                    ).toBeNull()
                })
            })

            describe('playbackQualityChange', () => {
                it('is emitted', () => {
                    expect(playbackQualityChange).toHaveBeenCalledOnceWith({
                        previous: null,
                        current: fixedQuality,
                    })
                })

                it('no-ops when setting same playback quality again', () => {
                    playbackQualityChange.calls.reset()
                    // Trigger the same ready state change again
                    playbackController.dispatch('readyStateChange', {
                        previous: PlaybackReadyState.HAVE_CURRENT_DATA,
                        current: PlaybackReadyState.HAVE_CURRENT_DATA,
                    })
                    expect(playbackQualityChange).not.toHaveBeenCalled()
                })
            })

            describe('then deactivated', () => {
                beforeEach(() => {
                    playbackQualityChange.calls.reset()
                    fixedPlaybackQuality.deactivate()
                })

                describe('playbackQualityChange', () => {
                    it('is emitted', () => {
                        expect(playbackQualityChange).toHaveBeenCalledOnceWith({
                            previous: fixedQuality,
                            current: null,
                        })
                    })
                })

                describe('getPlaybackQuality', () => {
                    it('returns null', () => {
                        expect(
                            fixedPlaybackQuality.getPlaybackQuality('audio')
                        ).toBeNull()
                    })
                })
            })
        })
    })

    describe('when readyState is not at least HAVE_CURRENT_DATA', () => {
        beforeEach(() => {
            playbackController.readyState = PlaybackReadyState.HAVE_METADATA
        })

        describe('and readyState changes to at least HAVE_CURRENT_DATA', () => {
            beforeEach(() => {
                playbackController.readyState =
                    PlaybackReadyState.HAVE_CURRENT_DATA
                playbackController.dispatch('readyStateChange', {
                    previous: PlaybackReadyState.HAVE_METADATA,
                    current: PlaybackReadyState.HAVE_CURRENT_DATA,
                })
            })

            it('getPlaybackQuality returns null for all content types', () => {
                expect(
                    fixedPlaybackQuality.getPlaybackQuality('audio')
                ).toBeNull()
                expect(
                    fixedPlaybackQuality.getPlaybackQuality('video')
                ).toBeNull()
            })
        })

        describe('then activated', () => {
            beforeEach(() => {
                fixedPlaybackQuality.activate()
            })

            it('getPlaybackQuality returns null for all content types', () => {
                expect(
                    fixedPlaybackQuality.getPlaybackQuality('audio')
                ).toBeNull()
                expect(
                    fixedPlaybackQuality.getPlaybackQuality('video')
                ).toBeNull()
            })

            describe('and readyState changes to at least HAVE_CURRENT_DATA', () => {
                beforeEach(() => {
                    playbackController.readyState =
                        PlaybackReadyState.HAVE_CURRENT_DATA
                    playbackController.dispatch('readyStateChange', {
                        previous: PlaybackReadyState.HAVE_METADATA,
                        current: PlaybackReadyState.HAVE_CURRENT_DATA,
                    })
                })

                it('getPlaybackQuality returns fixedQuality for matching content type', () => {
                    expect(
                        fixedPlaybackQuality.getPlaybackQuality('audio')
                    ).toBe(fixedQuality)
                    expect(
                        fixedPlaybackQuality.getPlaybackQuality('video')
                    ).toBeNull()
                })

                it('emits playbackQualityChange', () => {
                    expect(playbackQualityChange).toHaveBeenCalledOnceWith({
                        previous: null,
                        current: fixedQuality,
                    })
                })

                describe('and readyState changes to HAVE_NOTHING', () => {
                    beforeEach(() => {
                        playbackController.readyState =
                            PlaybackReadyState.HAVE_NOTHING
                        playbackController.dispatch('readyStateChange', {
                            previous: PlaybackReadyState.HAVE_CURRENT_DATA,
                            current: PlaybackReadyState.HAVE_NOTHING,
                        })
                    })

                    describe('getPlaybackQuality', () => {
                        it('returns null for all content types', () => {
                            expect(
                                fixedPlaybackQuality.getPlaybackQuality('audio')
                            ).toBeNull()
                            expect(
                                fixedPlaybackQuality.getPlaybackQuality('video')
                            ).toBeNull()
                        })
                    })
                })

                describe('then deactivated', () => {
                    beforeEach(() => {
                        playbackQualityChange.calls.reset()
                        fixedPlaybackQuality.deactivate()
                    })

                    it('emits playbackQualityChange', () => {
                        expect(playbackQualityChange).toHaveBeenCalledOnceWith({
                            previous: fixedQuality,
                            current: null,
                        })
                    })

                    describe('then deactivated again', () => {
                        beforeEach(() => {
                            playbackQualityChange.calls.reset()
                            fixedPlaybackQuality.deactivate()
                        })

                        it('does nothing', () => {
                            expect(playbackQualityChange).not.toHaveBeenCalled()
                        })
                    })
                })

                describe('and readyState changes to still at least HAVE_CURRENT_DATA', () => {
                    beforeEach(() => {
                        playbackQualityChange.calls.reset()
                        playbackController.readyState =
                            PlaybackReadyState.HAVE_FUTURE_DATA
                        playbackController.dispatch('readyStateChange', {
                            previous: PlaybackReadyState.HAVE_CURRENT_DATA,
                            current: PlaybackReadyState.HAVE_FUTURE_DATA,
                        })
                    })

                    it('does not emit playbackQualityChange', () => {
                        expect(playbackQualityChange).not.toHaveBeenCalled()
                        expect(
                            fixedPlaybackQuality.getPlaybackQuality('audio')
                        ).toEqual(fixedQuality)
                    })
                })
            })
        })
    })

    describe('when not activated', () => {
        it('getPlaybackQuality returns null for all content types', () => {
            expect(fixedPlaybackQuality.getPlaybackQuality('audio')).toBeNull()
            expect(fixedPlaybackQuality.getPlaybackQuality('video')).toBeNull()
        })
    })

    describe('isActive', () => {
        it('returns true if active', () => {
            expect(fixedPlaybackQuality.active).toBeFalse()
            fixedPlaybackQuality.activate()
            expect(fixedPlaybackQuality.active).toBeTrue()
            fixedPlaybackQuality.activate()
            expect(fixedPlaybackQuality.active).toBeTrue()
            fixedPlaybackQuality.deactivate()
            expect(fixedPlaybackQuality.active).toBeFalse()
            fixedPlaybackQuality.deactivate()
            expect(fixedPlaybackQuality.active).toBeFalse()
        })
    })

    describe('fixedQuality', () => {
        describe('when set', () => {
            it('emits streamingQualityChange event', () => {
                const newQuality: MediaQualityMetadata = {
                    ...createEmptyMediaQualityMetadata(),
                    decoderId: '2',
                    contentType: 'video',
                }
                streamingQualityChange.calls.reset()
                fixedPlaybackQuality.fixedQuality = newQuality
                expect(streamingQualityChange).toHaveBeenCalledOnceWith({
                    previous: fixedQuality,
                    current: newQuality,
                })
            })

            it('no-ops if set to same value', () => {
                streamingQualityChange.calls.reset()
                fixedPlaybackQuality.fixedQuality = fixedQuality
                expect(streamingQualityChange).toHaveBeenCalledOnceWith({
                    previous: fixedQuality,
                    current: fixedQuality,
                })
            })

            describe('and activated', () => {
                beforeEach(() => {
                    fixedPlaybackQuality.activate()
                })

                it('changes bufferingQuality', () => {
                    const newQuality: MediaQualityMetadata = {
                        ...createEmptyMediaQualityMetadata(),
                        decoderId: '2',
                        contentType: 'audio',
                    }
                    bufferingQualityChange.calls.reset()
                    fixedPlaybackQuality.fixedQuality = newQuality
                    expect(
                        fixedPlaybackQuality.getBufferingQuality('audio')
                    ).toBe(newQuality)
                    expect(bufferingQualityChange).toHaveBeenCalledOnceWith({
                        previous: fixedQuality,
                        current: newQuality,
                    })
                    expect(playbackQualityChange).not.toHaveBeenCalled()
                })

                describe('and readyState is at least HAVE_CURRENT_DATA', () => {
                    beforeEach(() => {
                        playbackController.readyState =
                            PlaybackReadyState.HAVE_CURRENT_DATA
                        playbackController.dispatch('readyStateChange', {
                            previous: null,
                            current: PlaybackReadyState.HAVE_CURRENT_DATA,
                        })
                    })

                    it('sets playbackQuality', () => {
                        const newQuality: MediaQualityMetadata = {
                            ...createEmptyMediaQualityMetadata(),
                            decoderId: '2',
                            contentType: 'audio',
                        }
                        playbackQualityChange.calls.reset()
                        fixedPlaybackQuality.fixedQuality = newQuality
                        expect(fixedPlaybackQuality.fixedQuality).toBe(
                            newQuality
                        )
                        expect(
                            fixedPlaybackQuality.getPlaybackQuality('audio')
                        ).toBe(newQuality)
                        expect(playbackQualityChange).toHaveBeenCalledOnceWith({
                            previous: fixedQuality,
                            current: newQuality,
                        })
                    })
                })
            })

            describe('and not activated', () => {
                it('does not change buffering or playback quality', () => {
                    fixedPlaybackQuality.fixedQuality = {
                        ...createEmptyMediaQualityMetadata(),
                        decoderId: '2',
                        contentType: 'audio',
                    }
                    expect(
                        fixedPlaybackQuality.getBufferingQuality('audio')
                    ).toBeNull()
                    expect(
                        fixedPlaybackQuality.getPlaybackQuality('audio')
                    ).toBeNull()
                })
            })
        })
    })
})
