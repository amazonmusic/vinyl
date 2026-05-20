/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    adtsSampleRate,
    buildAudioSpecificConfig,
    parseAdtsFrames,
} from '@amazon/vinyl-transmux'

describe('adts', () => {
    /**
     * Builds a minimal ADTS frame header (7 bytes, no CRC).
     * Sync word 0xFFF, protection absent = 1 (no CRC).
     */
    function adtsHeader(
        frameLength: number,
        opts: {
            audioObjectType?: number
            samplingFrequencyIndex?: number
            channelConfiguration?: number
            hasCrc?: boolean
        } = {}
    ): Uint8Array {
        const aot = (opts.audioObjectType ?? 2) - 1 // profile = AOT - 1
        const sfi = opts.samplingFrequencyIndex ?? 4 // 44100
        const cc = opts.channelConfiguration ?? 2
        const hasCrc = opts.hasCrc ?? false
        const headerSize = hasCrc ? 9 : 7

        const header = new Uint8Array(headerSize)
        header[0] = 0xff
        header[1] = hasCrc ? 0xf0 : 0xf1 // sync + protection absent
        header[2] = (aot << 6) | (sfi << 2) | ((cc >> 2) & 0x01)
        header[3] = ((cc & 0x03) << 6) | ((frameLength >> 11) & 0x03)
        header[4] = (frameLength >> 3) & 0xff
        header[5] = ((frameLength & 0x07) << 5) | 0x1f
        header[6] = 0xfc
        return header
    }

    function adtsFrame(
        payloadSize: number,
        opts: Parameters<typeof adtsHeader>[1] = {}
    ): Uint8Array {
        const headerSize = opts.hasCrc ? 9 : 7
        const frameLength = headerSize + payloadSize
        const header = adtsHeader(frameLength, opts)
        const frame = new Uint8Array(frameLength)
        frame.set(header)
        // Fill payload with non-zero data
        for (let i = headerSize; i < frameLength; i++) frame[i] = 0xab
        return frame
    }

    describe('adtsSampleRate', () => {
        it('returns 44100 for index 4', () => {
            expect(adtsSampleRate(4)).toBe(44100)
        })

        it('returns 48000 for index 3', () => {
            expect(adtsSampleRate(3)).toBe(48000)
        })

        it('returns 0 for out-of-range index', () => {
            expect(adtsSampleRate(99)).toBe(0)
        })
    })

    describe('parseAdtsFrames', () => {
        it('parses a single frame', () => {
            const data = adtsFrame(100)
            const frames = parseAdtsFrames(data)
            expect(frames.length).toBe(1)
            expect(frames[0].offset).toBe(0)
            expect(frames[0].frameLength).toBe(107)
            expect(frames[0].headerSize).toBe(7)
            expect(frames[0].audioObjectType).toBe(2)
            expect(frames[0].samplingFrequencyIndex).toBe(4)
            expect(frames[0].channelConfiguration).toBe(2)
        })

        it('parses multiple consecutive frames', () => {
            const f1 = adtsFrame(50)
            const f2 = adtsFrame(80)
            const data = new Uint8Array(f1.length + f2.length)
            data.set(f1)
            data.set(f2, f1.length)

            const frames = parseAdtsFrames(data)
            expect(frames.length).toBe(2)
            expect(frames[0].offset).toBe(0)
            expect(frames[1].offset).toBe(f1.length)
        })

        it('returns empty array for non-ADTS data', () => {
            const data = new Uint8Array([0x00, 0x00, 0x00, 0x00])
            expect(parseAdtsFrames(data)).toEqual([])
        })

        it('handles CRC-protected frames (9-byte header)', () => {
            const data = adtsFrame(100, { hasCrc: true })
            const frames = parseAdtsFrames(data)
            expect(frames.length).toBe(1)
            expect(frames[0].headerSize).toBe(9)
        })

        it('stops on truncated frame', () => {
            const full = adtsFrame(100)
            const truncated = full.subarray(0, 50)
            const frames = parseAdtsFrames(truncated)
            expect(frames.length).toBe(0)
        })

        it('skips non-sync bytes before a valid frame', () => {
            const frame = adtsFrame(50)
            const data = new Uint8Array(3 + frame.length)
            data[0] = 0x00
            data[1] = 0x00
            data[2] = 0x00
            data.set(frame, 3)

            const frames = parseAdtsFrames(data)
            expect(frames.length).toBe(1)
            expect(frames[0].offset).toBe(3)
        })
    })

    describe('buildAudioSpecificConfig', () => {
        it('builds a 2-byte config for AAC-LC stereo 44100', () => {
            const frame = parseAdtsFrames(adtsFrame(100))[0]
            const config = buildAudioSpecificConfig(frame)
            expect(config.length).toBe(2)
            // AAC-LC (AOT=2), 44100 (SFI=4), stereo (CC=2)
            // Byte 0: 00010 0100 => 0x12
            // Byte 1: 0 010 000 0 => 0x10 (shifted)
            expect(config[0]).toBe(0x12)
            expect(config[1]).toBe(0x10)
        })
    })
})
