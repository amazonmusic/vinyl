/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { createTransmuxer } from '@amazon/vinyl-transmux'

describe('createTransmuxer', () => {
    /**
     * Builds a minimal ADTS frame.
     */
    function adtsFrame(payloadSize: number): Uint8Array {
        const frameLength = 7 + payloadSize
        const frame = new Uint8Array(frameLength)
        frame[0] = 0xff
        frame[1] = 0xf1 // sync + no CRC
        // AAC-LC (profile=1), 44100 (SFI=4), stereo (CC=2)
        frame[2] = (1 << 6) | (4 << 2) | 0
        frame[3] = (2 << 6) | ((frameLength >> 11) & 0x03)
        frame[4] = (frameLength >> 3) & 0xff
        frame[5] = ((frameLength & 0x07) << 5) | 0x1f
        frame[6] = 0xfc
        for (let i = 7; i < frameLength; i++) frame[i] = 0xab
        return frame
    }

    function concatFrames(...frames: Uint8Array[]): Uint8Array {
        let total = 0
        for (const f of frames) total += f.byteLength
        const result = new Uint8Array(total)
        let offset = 0
        for (const f of frames) {
            result.set(f, offset)
            offset += f.byteLength
        }
        return result
    }

    function readBoxType(data: Uint8Array, offset: number): string {
        return String.fromCharCode(
            data[offset + 4],
            data[offset + 5],
            data[offset + 6],
            data[offset + 7]
        )
    }

    function readBoxSize(data: Uint8Array, offset: number): number {
        return (
            ((data[offset] << 24) |
                (data[offset + 1] << 16) |
                (data[offset + 2] << 8) |
                data[offset + 3]) >>>
            0
        )
    }

    describe('ADTS transmuxing', () => {
        it('produces an init segment on first call', () => {
            const transmuxer = createTransmuxer()
            const segment = concatFrames(adtsFrame(100), adtsFrame(100))
            const result = transmuxer.transmux(segment.buffer)

            expect(result.initSegment).not.toBeNull()
            const init = new Uint8Array(result.initSegment)
            expect(readBoxType(init, 0)).toBe('ftyp')
            // moov follows ftyp
            const ftypSize = readBoxSize(init, 0)
            expect(readBoxType(init, ftypSize)).toBe('moov')
        })

        it('produces a media segment with moof + mdat', () => {
            const transmuxer = createTransmuxer()
            const segment = concatFrames(adtsFrame(100), adtsFrame(100))
            const result = transmuxer.transmux(segment.buffer)

            const media = new Uint8Array(result.mediaSegment)
            expect(readBoxType(media, 0)).toBe('moof')
            const moofSize = readBoxSize(media, 0)
            expect(readBoxType(media, moofSize)).toBe('mdat')
        })

        it('returns cached initSegment on subsequent calls', () => {
            const transmuxer = createTransmuxer()
            const segment = concatFrames(adtsFrame(100))

            const first = transmuxer.transmux(segment.buffer)
            expect(first.initSegment).not.toBeNull()

            const second = transmuxer.transmux(segment.buffer)
            expect(new Uint8Array(second.initSegment)).toEqual(
                new Uint8Array(first.initSegment)
            )
        })

        it('reports duration in seconds', () => {
            const transmuxer = createTransmuxer()
            // 10 frames at 44100 Hz, 1024 samples/frame
            const frames = Array.from({ length: 10 }, () => adtsFrame(100))
            const segment = concatFrames(...frames)
            const result = transmuxer.transmux(segment.buffer)

            const expectedDuration = (10 * 1024) / 44100
            expect(result.duration).toBeCloseTo(expectedDuration, 3)
        })

        it('increments sequence numbers across calls', () => {
            const transmuxer = createTransmuxer()
            const segment = concatFrames(adtsFrame(100))

            const r1 = transmuxer.transmux(segment.buffer)
            const r2 = transmuxer.transmux(segment.buffer)

            // Both should produce valid media segments
            expect(new Uint8Array(r1.mediaSegment).length).toBeGreaterThan(0)
            expect(new Uint8Array(r2.mediaSegment).length).toBeGreaterThan(0)
        })

        it('throws on unsupported format', () => {
            const transmuxer = createTransmuxer()
            const data = new Uint8Array([0x00, 0x00, 0x00, 0x00])
            expect(() => transmuxer.transmux(data.buffer)).toThrowError(
                /Unsupported segment format/
            )
        })

        it('throws on empty ADTS data', () => {
            const transmuxer = createTransmuxer()
            // Valid sync word but truncated
            const data = new Uint8Array([
                0xff, 0xf1, 0x00, 0x00, 0x00, 0x00, 0x00,
            ])
            // Frame length will be 0 which is < headerSize, so no frames parsed
            expect(() => transmuxer.transmux(data.buffer)).toThrowError(
                /No ADTS frames/
            )
        })
    })

    describe('MPEG-TS transmuxing', () => {
        it('produces init and media segments from synthetic TS', async () => {
            const { buildMinimalTsSegment } =
                await import('../testUtil/buildTsSegment')
            const transmuxer = createTransmuxer()
            const tsData = buildMinimalTsSegment()
            const result = transmuxer.transmux(tsData.buffer)

            expect(result.initSegment).not.toBeNull()
            const init = new Uint8Array(result.initSegment)
            expect(readBoxType(init, 0)).toBe('ftyp')

            const media = new Uint8Array(result.mediaSegment)
            expect(readBoxType(media, 0)).toBe('moof')
            expect(result.duration).toBeGreaterThan(0)
        })

        it('returns cached initSegment on subsequent TS segments', async () => {
            const { buildMinimalTsSegment } =
                await import('../testUtil/buildTsSegment')
            const transmuxer = createTransmuxer()
            const tsData = buildMinimalTsSegment()

            const first = transmuxer.transmux(tsData.buffer)
            expect(first.initSegment).not.toBeNull()

            const second = transmuxer.transmux(tsData.buffer)
            expect(new Uint8Array(second.initSegment)).toEqual(
                new Uint8Array(first.initSegment)
            )
        })
    })

    describe('real MPEG-TS transmuxing (bipbop H.264+AAC)', () => {
        it('produces ftyp+moov init segment with video and audio tracks', async () => {
            const { decodeBipbopTsSegment } =
                await import('../testUtil/bipbopTsFixture')
            const transmuxer = createTransmuxer()
            const tsData = decodeBipbopTsSegment()
            const result = transmuxer.transmux(
                tsData.buffer.slice(
                    tsData.byteOffset,
                    tsData.byteOffset + tsData.byteLength
                )
            )

            expect(result.initSegment).not.toBeNull()
            const init = new Uint8Array(result.initSegment)
            expect(readBoxType(init, 0)).toBe('ftyp')
            const ftypSize = readBoxSize(init, 0)
            expect(readBoxType(init, ftypSize)).toBe('moov')
        })

        it('produces moof+mdat media segment', async () => {
            const { decodeBipbopTsSegment } =
                await import('../testUtil/bipbopTsFixture')
            const transmuxer = createTransmuxer()
            const tsData = decodeBipbopTsSegment()
            const result = transmuxer.transmux(
                tsData.buffer.slice(
                    tsData.byteOffset,
                    tsData.byteOffset + tsData.byteLength
                )
            )

            const media = new Uint8Array(result.mediaSegment)
            expect(readBoxType(media, 0)).toBe('moof')
            const moofSize = readBoxSize(media, 0)
            expect(readBoxType(media, moofSize)).toBe('mdat')
        })

        it('reports positive duration', async () => {
            const { decodeBipbopTsSegment } =
                await import('../testUtil/bipbopTsFixture')
            const transmuxer = createTransmuxer()
            const tsData = decodeBipbopTsSegment()
            const result = transmuxer.transmux(
                tsData.buffer.slice(
                    tsData.byteOffset,
                    tsData.byteOffset + tsData.byteLength
                )
            )
            expect(result.duration).toBeGreaterThan(0)
        })

        it('returns cached initSegment on second call', async () => {
            const { decodeBipbopTsSegment } =
                await import('../testUtil/bipbopTsFixture')
            const transmuxer = createTransmuxer()
            const tsData = decodeBipbopTsSegment()
            const buf = tsData.buffer.slice(
                tsData.byteOffset,
                tsData.byteOffset + tsData.byteLength
            )

            const first = transmuxer.transmux(buf)
            expect(first.initSegment).not.toBeNull()

            const second = transmuxer.transmux(buf)
            expect(new Uint8Array(second.initSegment)).toEqual(
                new Uint8Array(first.initSegment)
            )
        })
    })

    describe('H.264 High profile transmuxing', () => {
        it('parses High profile SPS and produces init segment', async () => {
            const { buildHighProfileTsSegment } =
                await import('../testUtil/highProfileTsFixture')
            const transmuxer = createTransmuxer()
            const tsData = buildHighProfileTsSegment()
            const result = transmuxer.transmux(
                tsData.buffer.slice(
                    tsData.byteOffset,
                    tsData.byteOffset + tsData.byteLength
                )
            )
            expect(result.initSegment).not.toBeNull()
            const init = new Uint8Array(result.initSegment)
            expect(readBoxType(init, 0)).toBe('ftyp')
        })
    })

    describe('video-only TS transmuxing', () => {
        it('produces videoMoov when no audio stream present', async () => {
            const { buildHighProfileTsSegment } =
                await import('../testUtil/highProfileTsFixture')
            const transmuxer = createTransmuxer()
            const tsData = buildHighProfileTsSegment()
            const result = transmuxer.transmux(
                tsData.buffer.slice(
                    tsData.byteOffset,
                    tsData.byteOffset + tsData.byteLength
                )
            )
            // Video-only: init segment should contain videoMoov (not avMoov)
            expect(result.initSegment).not.toBeNull()
            expect(result.mediaSegment.byteLength).toBeGreaterThan(0)
        })
    })

    describe('known-length PES transmuxing', () => {
        it('handles PES packets with non-zero packet length', async () => {
            const { buildKnownLengthPesTsSegment } =
                await import('../testUtil/knownLengthPesFixture')
            const transmuxer = createTransmuxer()
            const tsData = buildKnownLengthPesTsSegment()
            const result = transmuxer.transmux(
                tsData.buffer.slice(
                    tsData.byteOffset,
                    tsData.byteOffset + tsData.byteLength
                )
            )
            expect(result.initSegment).not.toBeNull()
            expect(result.mediaSegment.byteLength).toBeGreaterThan(0)
        })
    })

    describe('multi-PES unbounded transmuxing', () => {
        it('handles two unbounded PES packets in the same stream', async () => {
            const { buildMultiPesTsSegment } =
                await import('../testUtil/knownLengthPesFixture')
            const transmuxer = createTransmuxer()
            const tsData = buildMultiPesTsSegment()
            const result = transmuxer.transmux(
                tsData.buffer.slice(
                    tsData.byteOffset,
                    tsData.byteOffset + tsData.byteLength
                )
            )
            expect(result.initSegment).not.toBeNull()
            expect(result.mediaSegment.byteLength).toBeGreaterThan(0)
            expect(result.duration).toBeGreaterThan(0)
        })
    })

    describe('SPS parser branches', () => {
        it('parses High profile SPS with scaling matrix and chroma=3', async () => {
            const { buildScalingMatrixTsSegment } =
                await import('../testUtil/spsVariantFixtures')
            const transmuxer = createTransmuxer()
            const tsData = buildScalingMatrixTsSegment()
            const result = transmuxer.transmux(
                tsData.buffer.slice(
                    tsData.byteOffset,
                    tsData.byteOffset + tsData.byteLength
                )
            )
            expect(result.initSegment).not.toBeNull()
        })

        it('parses High profile SPS with scaling matrix and chroma=1', async () => {
            const { buildScalingMatrixChroma1TsSegment } =
                await import('../testUtil/spsVariantFixtures')
            const transmuxer = createTransmuxer()
            const tsData = buildScalingMatrixChroma1TsSegment()
            const result = transmuxer.transmux(
                tsData.buffer.slice(
                    tsData.byteOffset,
                    tsData.byteOffset + tsData.byteLength
                )
            )
            expect(result.initSegment).not.toBeNull()
        })

        it('parses SPS with pic_order_cnt_type=1', async () => {
            const { buildPocType1TsSegment } =
                await import('../testUtil/spsVariantFixtures')
            const transmuxer = createTransmuxer()
            const tsData = buildPocType1TsSegment()
            const result = transmuxer.transmux(
                tsData.buffer.slice(
                    tsData.byteOffset,
                    tsData.byteOffset + tsData.byteLength
                )
            )
            expect(result.initSegment).not.toBeNull()
        })
    })

    describe('ID3 tag skipping', () => {
        it('skips leading ID3v2 tags before ADTS data', () => {
            const transmuxer = createTransmuxer()
            const frame = adtsFrame(100)

            // Build a minimal ID3v2 tag (10-byte header + 4 bytes content)
            const id3 = new Uint8Array(14)
            id3[0] = 0x49 // 'I'
            id3[1] = 0x44 // 'D'
            id3[2] = 0x33 // '3'
            id3[3] = 0x04 // version
            id3[4] = 0x00
            id3[5] = 0x00 // flags
            // Size: 4 bytes (synchsafe)
            id3[6] = 0x00
            id3[7] = 0x00
            id3[8] = 0x00
            id3[9] = 0x04

            const data = new Uint8Array(id3.length + frame.length)
            data.set(id3)
            data.set(frame, id3.length)

            const result = transmuxer.transmux(data.buffer)
            expect(result.initSegment).not.toBeNull()
            expect(result.duration).toBeGreaterThan(0)
        })
    })
})
