/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    concatBuffers,
    demuxTsSegment,
    getPayloadOffset,
    parsePat,
    parsePesPts,
    parsePmt,
    parseTsPacketHeader,
    stripPesHeader,
    TS_PACKET_SIZE,
    TS_SYNC_BYTE,
} from '@amazon/vinyl-transmux'

describe('mpegts', () => {
    describe('parseTsPacketHeader', () => {
        it('parses PID from bytes 1-2', () => {
            const pkt = new Uint8Array(TS_PACKET_SIZE)
            pkt[0] = TS_SYNC_BYTE
            pkt[1] = 0x01 // PID high bits
            pkt[2] = 0x00 // PID low bits = 0x100
            pkt[3] = 0x10 // adaptation=01, cc=0
            const header = parseTsPacketHeader(pkt, 0)
            expect(header.pid).toBe(0x100)
        })

        it('parses payload unit start indicator', () => {
            const pkt = new Uint8Array(TS_PACKET_SIZE)
            pkt[0] = TS_SYNC_BYTE
            pkt[1] = 0x40 // PUSI set
            pkt[3] = 0x10
            expect(
                parseTsPacketHeader(pkt, 0).payloadUnitStartIndicator
            ).toBeTrue()

            pkt[1] = 0x00
            expect(
                parseTsPacketHeader(pkt, 0).payloadUnitStartIndicator
            ).toBeFalse()
        })

        it('parses adaptation field control', () => {
            const pkt = new Uint8Array(TS_PACKET_SIZE)
            pkt[0] = TS_SYNC_BYTE
            pkt[3] = 0x30 // adaptation=11
            expect(parseTsPacketHeader(pkt, 0).adaptationFieldControl).toBe(3)
        })

        it('parses continuity counter', () => {
            const pkt = new Uint8Array(TS_PACKET_SIZE)
            pkt[0] = TS_SYNC_BYTE
            pkt[3] = 0x1a // cc=10
            expect(parseTsPacketHeader(pkt, 0).continuityCounter).toBe(10)
        })
    })

    describe('getPayloadOffset', () => {
        it('returns offset+4 when no adaptation field', () => {
            const pkt = new Uint8Array(TS_PACKET_SIZE)
            expect(getPayloadOffset(pkt, 0, 1)).toBe(4)
        })

        it('skips adaptation field when present', () => {
            const pkt = new Uint8Array(TS_PACKET_SIZE)
            pkt[4] = 7 // adaptation field length
            expect(getPayloadOffset(pkt, 0, 3)).toBe(12) // 4 + 1 + 7
        })
    })

    describe('parsePat', () => {
        it('extracts PMT PID from PAT payload', () => {
            // Minimal PAT: pointer(1) + table header(8) + program(4)
            const data = new Uint8Array(13)
            data[0] = 0 // pointer field
            // table_id=0, section_syntax_indicator, section_length
            data[1] = 0x00
            data[2] = 0xb0
            data[3] = 0x09
            // transport_stream_id, version, section_number, last_section_number
            data[4] = 0x00
            data[5] = 0x01
            data[6] = 0xc1
            data[7] = 0x00
            data[8] = 0x00
            // program_number = 1
            data[9] = 0x00
            data[10] = 0x01
            // PMT PID = 0x100
            data[11] = 0x01
            data[12] = 0x00
            expect(parsePat(data, 0)).toBe(0x100)
        })
    })

    describe('parsePmt', () => {
        it('extracts elementary stream entries', () => {
            // Minimal PMT
            const data = new Uint8Array(22)
            data[0] = 0 // pointer field
            data[1] = 0x02 // table_id
            data[2] = 0xb0
            data[3] = 17 // section_length
            // transport_stream_id, version, section, last_section
            data[4] = 0x00
            data[5] = 0x01
            data[6] = 0xc1
            data[7] = 0x00
            data[8] = 0x00
            // PCR_PID
            data[9] = 0xe1
            data[10] = 0x00
            // program_info_length = 0
            data[11] = 0xf0
            data[12] = 0x00
            // Stream entry: AAC (0x0f), PID=0x101
            data[13] = 0x0f // stream_type
            data[14] = 0xe1 // PID high
            data[15] = 0x01 // PID low
            data[16] = 0xf0
            data[17] = 0x00 // ES info length = 0
            // CRC (4 bytes, ignored by parser)

            const entries = parsePmt(data, 0)
            expect(entries.length).toBe(1)
            expect(entries[0].streamType).toBe(0x0f)
            expect(entries[0].pid).toBe(0x101)
        })
    })

    describe('stripPesHeader', () => {
        it('strips PES header and returns payload', () => {
            const data = new Uint8Array(15)
            data[0] = 0x00
            data[1] = 0x00
            data[2] = 0x01
            data[3] = 0xc0 // stream_id
            data[4] = 0x00
            data[5] = 0x09 // PES packet length
            data[6] = 0x80
            data[7] = 0x00 // no PTS/DTS
            data[8] = 0x00 // PES header data length = 0
            // payload
            data[9] = 0xaa
            data[10] = 0xbb
            const payload = stripPesHeader(data)
            expect(payload[0]).toBe(0xaa)
            expect(payload[1]).toBe(0xbb)
        })

        it('returns data as-is when no PES start code', () => {
            const data = new Uint8Array([0xaa, 0xbb, 0xcc])
            expect(stripPesHeader(data)).toBe(data)
        })
    })

    describe('parsePesPts', () => {
        it('returns -1 when no PES start code', () => {
            const data = new Uint8Array([0xaa, 0xbb, 0xcc])
            expect(parsePesPts(data)).toBe(-1)
        })

        it('returns -1 when PTS flag is not set', () => {
            const data = new Uint8Array(14)
            data[0] = 0x00
            data[1] = 0x00
            data[2] = 0x01
            data[3] = 0xc0
            data[7] = 0x00 // no PTS flag
            expect(parsePesPts(data)).toBe(-1)
        })

        it('extracts PTS from PES header', () => {
            const data = new Uint8Array(14)
            data[0] = 0x00
            data[1] = 0x00
            data[2] = 0x01
            data[3] = 0xc0
            data[7] = 0x80 // PTS present
            data[8] = 5 // header data length
            // PTS = 0 (all marker bits set, value bits 0)
            data[9] = 0x21 // 0010 0001
            data[10] = 0x00
            data[11] = 0x01
            data[12] = 0x00
            data[13] = 0x01
            expect(parsePesPts(data)).toBe(0)
        })
    })

    describe('concatBuffers', () => {
        it('concatenates multiple buffers', () => {
            const a = new Uint8Array([1, 2])
            const b = new Uint8Array([3, 4, 5])
            const result = concatBuffers([a, b])
            expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
        })

        it('returns empty array for empty input', () => {
            expect(concatBuffers([])).toEqual(new Uint8Array(0))
        })
    })

    describe('demuxTsSegment', () => {
        it('returns empty array for empty input', () => {
            expect(demuxTsSegment(new Uint8Array(0))).toEqual([])
        })

        it('skips packets without sync byte', () => {
            const data = new Uint8Array(TS_PACKET_SIZE)
            data[0] = 0x00 // not sync byte
            expect(demuxTsSegment(data)).toEqual([])
        })

        it('skips packets with adaptation-only (no payload)', () => {
            const data = new Uint8Array(TS_PACKET_SIZE)
            data[0] = TS_SYNC_BYTE
            data[3] = 0x20 // adaptation_field_control = 2 (adaptation only, no payload)
            expect(demuxTsSegment(data)).toEqual([])
        })

        it('skips streams with no data packets', async () => {
            const {
                buildPatPacket,
                buildPmtPacket,
                buildPesPacket,
                buildAdtsFrame,
                concatPackets,
            } = await import('../testUtil/tsPacketBuilder')
            const data = concatPackets([
                buildPatPacket(0x100),
                buildPmtPacket(0x100, [
                    { pid: 0x101, streamType: 0x0f }, // AAC
                    { pid: 0x102, streamType: 0x1b }, // H.264 — no data packets
                ]),
                buildPesPacket({
                    pid: 0x101,
                    streamId: 0xc0,
                    payload: buildAdtsFrame(50),
                    pts: 0,
                }),
            ])
            const streams = demuxTsSegment(data)
            // Only the audio stream should be returned
            expect(streams.length).toBe(1)
            expect(streams[0].pid).toBe(0x101)
        })
    })
})
