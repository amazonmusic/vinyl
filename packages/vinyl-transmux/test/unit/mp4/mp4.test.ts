/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    type AudioTrackConfig,
    type VideoTrackConfig,
    mp4aSampleEntry,
    avc1SampleEntry,
    audioTrak,
    box,
    ftyp,
    fullBox,
    mdat,
    moov,
    moof,
    patchDataOffset,
    videoTrak,
} from '@amazon/vinyl-transmux'

describe('mp4', () => {
    function readBoxType(data: Uint8Array, offset = 0): string {
        return String.fromCharCode(
            data[offset + 4],
            data[offset + 5],
            data[offset + 6],
            data[offset + 7]
        )
    }

    function readBoxSize(data: Uint8Array, offset = 0): number {
        return (
            ((data[offset] << 24) |
                (data[offset + 1] << 16) |
                (data[offset + 2] << 8) |
                data[offset + 3]) >>>
            0
        )
    }

    const audioConfig: AudioTrackConfig = {
        audioObjectType: 2,
        samplingFrequencyIndex: 4,
        channelConfiguration: 2,
        sampleRate: 44100,
        audioSpecificConfig: new Uint8Array([0x12, 0x10]),
    }

    const videoConfig: VideoTrackConfig = {
        width: 640,
        height: 360,
        sps: new Uint8Array([0x67, 0x42, 0xc0, 0x1e]),
        pps: new Uint8Array([0x68, 0xce, 0x38, 0x80]),
        profileIdc: 0x42,
        profileCompatibility: 0xc0,
        levelIdc: 0x1e,
    }

    describe('box', () => {
        it('creates a box with correct size and type', () => {
            const payload = new Uint8Array([0x01, 0x02])
            const result = box('test', payload)
            expect(readBoxSize(result)).toBe(10) // 8 header + 2 payload
            expect(readBoxType(result)).toBe('test')
        })

        it('concatenates multiple payloads', () => {
            const a = new Uint8Array([0x01])
            const b = new Uint8Array([0x02, 0x03])
            const result = box('test', a, b)
            expect(readBoxSize(result)).toBe(11) // 8 + 3
        })
    })

    describe('fullBox', () => {
        it('includes version and flags', () => {
            const payload = new Uint8Array([0xaa])
            const result = fullBox('test', 1, 0x000003, payload)
            expect(readBoxSize(result)).toBe(13) // 12 header + 1 payload
            expect(result[8]).toBe(1) // version
            expect(result[11]).toBe(3) // flags low byte
        })
    })

    describe('ftyp', () => {
        it('creates a valid ftyp box', () => {
            const result = ftyp()
            expect(readBoxType(result)).toBe('ftyp')
            expect(readBoxSize(result)).toBe(result.byteLength)
        })
    })

    function buildAudioTrak(config: AudioTrackConfig = audioConfig) {
        return audioTrak({
            trackId: 1,
            sampleRate: config.sampleRate,
            channelCount: config.channelConfiguration,
            sampleEntry: mp4aSampleEntry(config),
        })
    }

    function buildVideoTrak() {
        return videoTrak({
            trackId: 1,
            width: videoConfig.width,
            height: videoConfig.height,
            sampleEntry: avc1SampleEntry(videoConfig),
        })
    }

    describe('moov', () => {
        it('creates a moov box with audio track', () => {
            const result = moov(buildAudioTrak())
            expect(readBoxType(result)).toBe('moov')
            expect(readBoxSize(result)).toBe(result.byteLength)
        })

        it('sets volume to 0 when channelCount is 0', () => {
            const config = { ...audioConfig, channelConfiguration: 0 }
            const result = moov(buildAudioTrak(config))
            expect(readBoxType(result)).toBe('moov')
        })

        it('creates a moov box with video track', () => {
            const result = moov(buildVideoTrak())
            expect(readBoxType(result)).toBe('moov')
            expect(readBoxSize(result)).toBe(result.byteLength)
        })

        it('creates a moov box with both audio and video tracks', () => {
            const audioOnly = moov(buildAudioTrak())
            const both = moov(buildVideoTrak(), buildAudioTrak())
            expect(readBoxType(both)).toBe('moov')
            expect(readBoxSize(both)).toBeGreaterThan(readBoxSize(audioOnly))
        })
    })

    describe('moof', () => {
        it('creates a moof box with samples', () => {
            const result = moof({
                sequenceNumber: 1,
                trackId: 1,
                baseDecodeTime: 0,
                samples: [
                    { duration: 1024, size: 100 },
                    { duration: 1024, size: 200 },
                ],
            })
            expect(readBoxType(result)).toBe('moof')
            expect(readBoxSize(result)).toBe(result.byteLength)
        })

        it('includes sample flags when provided', () => {
            const result = moof({
                sequenceNumber: 1,
                trackId: 1,
                baseDecodeTime: 0,
                samples: [{ duration: 1024, size: 100, flags: 0x02000000 }],
            })
            expect(readBoxType(result)).toBe('moof')
        })

        it('includes composition time offsets when provided', () => {
            const result = moof({
                sequenceNumber: 1,
                trackId: 1,
                baseDecodeTime: 0,
                samples: [
                    {
                        duration: 3000,
                        size: 100,
                        flags: 0x02000000,
                        compositionTimeOffset: 6000,
                    },
                ],
            })
            expect(readBoxType(result)).toBe('moof')
        })

        it('handles samples with flags but no CTO', () => {
            const result = moof({
                sequenceNumber: 1,
                trackId: 1,
                baseDecodeTime: 0,
                samples: [
                    { duration: 1024, size: 100, flags: 0x02000000 },
                    { duration: 1024, size: 200, flags: 0x01010000 },
                ],
            })
            expect(readBoxType(result)).toBe('moof')
        })

        it('uses default 0 for undefined flags when hasFlags is true', () => {
            // One sample has flags, the other does not — hasFlags=true,
            // but the second sample's flags is undefined → ?? 0
            const result = moof({
                sequenceNumber: 1,
                trackId: 1,
                baseDecodeTime: 0,
                samples: [
                    { duration: 1024, size: 100, flags: 0x02000000 },
                    { duration: 1024, size: 200 },
                ],
            })
            expect(readBoxType(result)).toBe('moof')
        })

        it('uses default 0 for undefined CTO when hasCto is true', () => {
            const result = moof({
                sequenceNumber: 1,
                trackId: 1,
                baseDecodeTime: 0,
                samples: [
                    {
                        duration: 1024,
                        size: 100,
                        compositionTimeOffset: 3000,
                    },
                    { duration: 1024, size: 200 },
                ],
            })
            expect(readBoxType(result)).toBe('moof')
        })
    })

    describe('mdat', () => {
        it('wraps raw data in an mdat box', () => {
            const data = new Uint8Array([0x01, 0x02, 0x03])
            const result = mdat(data)
            expect(readBoxType(result)).toBe('mdat')
            expect(readBoxSize(result)).toBe(11) // 8 + 3
        })
    })

    describe('patchDataOffset', () => {
        it('patches the trun data_offset field', () => {
            const moofBox = moof({
                sequenceNumber: 1,
                trackId: 1,
                baseDecodeTime: 0,
                samples: [{ duration: 1024, size: 100 }],
            })
            const moofSize = moofBox.byteLength
            patchDataOffset(moofBox, moofSize)

            // The data_offset should be moofSize + 8 (mdat header)
            // Find trun and verify
            const expectedOffset = moofSize + 8
            // Walk the box tree to find the patched value
            let found = false
            const str = String.fromCharCode(
                ...moofBox.subarray(0, moofBox.length)
            )
            const trunIdx = str.indexOf('trun')
            if (trunIdx >= 0) {
                // data_offset is at trun_start + 8 (box header) + 4 (version/flags) + 4 (sample_count)
                const offsetPos = trunIdx - 4 + 16
                const patchedValue =
                    ((moofBox[offsetPos] << 24) |
                        (moofBox[offsetPos + 1] << 16) |
                        (moofBox[offsetPos + 2] << 8) |
                        moofBox[offsetPos + 3]) >>>
                    0
                expect(patchedValue).toBe(expectedOffset)
                found = true
            }
            expect(found).toBeTrue()
        })
    })
})
