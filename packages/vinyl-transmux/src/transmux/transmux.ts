/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Transmuxer that converts MPEG-TS / raw ADTS AAC segments into fMP4
 * fragments consumable by MSE SourceBuffer.
 *
 * The transmuxer produces two outputs:
 * 1. An initialization segment (ftyp + moov) — append once per track.
 * 2. Media segments (moof + mdat) — append per HLS segment.
 *
 * @module
 */

import {
    type AdtsFrame,
    adtsSampleRate,
    buildAudioSpecificConfig,
    parseAdtsFrames,
} from '../aac/adts'
import {
    type AudioTrackConfig,
    type VideoTrackConfig,
    mp4aSampleEntry,
    avc1SampleEntry,
} from './sampleEntry'
import {
    type SampleEntry,
    audioTrak,
    ftyp,
    mdat,
    moov,
    moof,
    patchDataOffset,
    videoTrak,
    MPEG_TIMESCALE,
} from '../mp4/mp4'
import {
    STREAM_TYPE_AAC,
    STREAM_TYPE_H264,
    concatBuffers,
    demuxTsSegment,
    parsePesPts,
} from '../mpegts/mpegts'

export interface TransmuxResult {
    /** The initialization segment (ftyp + moov). Always present. */
    readonly initSegment: ArrayBuffer
    /** The media segment (moof + mdat). */
    readonly mediaSegment: ArrayBuffer
    /** Duration of this segment in seconds. */
    readonly duration: number
}

interface TrackState {
    initSegment: Uint8Array | null
    sequenceNumber: number
    audioConfig: AudioTrackConfig | null
    videoConfig: VideoTrackConfig | null
    audioDecodeTime: number
    videoDecodeTime: number
}

/**
 * Creates a stateful transmuxer instance. Call `transmux()` for each HLS
 * segment in order. The init segment is always returned (cached after first
 * call).
 */
export function createTransmuxer() {
    const state: TrackState = {
        initSegment: null,
        sequenceNumber: 1,
        audioConfig: null,
        videoConfig: null,
        audioDecodeTime: 0,
        videoDecodeTime: 0,
    }

    return { transmux: (data: ArrayBuffer) => transmux(state, data) }
}

/**
 * Builds the ftyp + moov init segment and stores it in state.
 */
function buildInitSegment(state: TrackState, moovBox: Uint8Array): void {
    const ftypBox = ftyp()
    const init = new Uint8Array(ftypBox.byteLength + moovBox.byteLength)
    init.set(ftypBox, 0)
    init.set(moovBox, ftypBox.byteLength)
    state.initSegment = init
}

/** Returns the cached init segment as an ArrayBuffer. */
function getInitSegment(state: TrackState): ArrayBuffer {
    const init = state.initSegment!
    return init.buffer.slice(
        init.byteOffset,
        init.byteOffset + init.byteLength
    ) as ArrayBuffer
}

function transmux(state: TrackState, data: ArrayBuffer): TransmuxResult {
    let segment: Uint8Array = new Uint8Array(data)

    // Skip ID3 tags that may precede the audio/video data.
    // ID3 tags are common in HLS for carrying timestamps.
    segment = skipId3Tags(segment)

    // Detect format: MPEG-TS starts with 0x47, ADTS starts with 0xFFF
    const isMpegTs = segment[0] === 0x47
    const isAdts = segment[0] === 0xff && (segment[1] & 0xf0) === 0xf0

    if (isMpegTs) {
        return transmuxMpegTs(state, segment)
    } else if (isAdts) {
        return transmuxAdts(state, segment)
    }

    throw new Error('Unsupported segment format: expected MPEG-TS or ADTS')
}

/**
 * Skips any leading ID3v2 tags. Each tag has a 10-byte header where bytes
 * 6-9 encode the size as a synchsafe integer.
 */
function skipId3Tags(data: Uint8Array): Uint8Array {
    let offset = 0
    while (
        offset + 10 <= data.length &&
        data[offset] === 0x49 && // 'I'
        data[offset + 1] === 0x44 && // 'D'
        data[offset + 2] === 0x33 // '3'
    ) {
        const size =
            ((data[offset + 6] & 0x7f) << 21) |
            ((data[offset + 7] & 0x7f) << 14) |
            ((data[offset + 8] & 0x7f) << 7) |
            (data[offset + 9] & 0x7f)
        offset += 10 + size
    }
    return offset > 0 ? data.subarray(offset) : data
}

function transmuxAdts(state: TrackState, data: Uint8Array): TransmuxResult {
    const frames = parseAdtsFrames(data)
    if (frames.length === 0) {
        throw new Error('No ADTS frames found in segment')
    }

    const firstFrame = frames[0]

    if (!state.audioConfig) {
        const sampleRate = adtsSampleRate(firstFrame.samplingFrequencyIndex)
        state.audioConfig = {
            audioObjectType: firstFrame.audioObjectType,
            samplingFrequencyIndex: firstFrame.samplingFrequencyIndex,
            channelConfiguration: firstFrame.channelConfiguration,
            sampleRate,
            audioSpecificConfig: buildAudioSpecificConfig(firstFrame),
        }
        buildInitSegment(
            state,
            moov(
                audioTrak({
                    trackId: 1,
                    sampleRate: state.audioConfig.sampleRate,
                    channelCount: state.audioConfig.channelConfiguration,
                    sampleEntry: mp4aSampleEntry(state.audioConfig),
                })
            )
        )
    }

    const sampleRate = state.audioConfig.sampleRate
    const samplesPerFrame = 1024 // AAC-LC always uses 1024 samples per frame

    // Build sample table and raw frame data
    const samples: SampleEntry[] = []
    const frameDataParts: Uint8Array[] = []

    for (const frame of frames) {
        const rawData = data.subarray(
            frame.offset + frame.headerSize,
            frame.offset + frame.frameLength
        )
        samples.push({
            duration: samplesPerFrame,
            size: rawData.byteLength,
        })
        frameDataParts.push(rawData)
    }

    const rawMediaData = concatBuffers(frameDataParts)
    const duration = (frames.length * samplesPerFrame) / sampleRate

    const moofBox = moof({
        sequenceNumber: state.sequenceNumber++,
        trackId: 1,
        baseDecodeTime: state.audioDecodeTime,
        samples,
    })
    state.audioDecodeTime += frames.length * samplesPerFrame
    patchDataOffset(moofBox, moofBox.byteLength)
    const mdatBox = mdat(rawMediaData)

    const mediaSegment = new Uint8Array(moofBox.byteLength + mdatBox.byteLength)
    mediaSegment.set(moofBox, 0)
    mediaSegment.set(mdatBox, moofBox.byteLength)

    return {
        initSegment: getInitSegment(state),
        mediaSegment: mediaSegment.buffer.slice(
            mediaSegment.byteOffset,
            mediaSegment.byteOffset + mediaSegment.byteLength
        ),
        duration,
    }
}

function transmuxMpegTs(state: TrackState, data: Uint8Array): TransmuxResult {
    const streams = demuxTsSegment(data)

    const audioStream = streams.find((s) => s.streamType === STREAM_TYPE_AAC)
    const videoStream = streams.find((s) => s.streamType === STREAM_TYPE_H264)

    // Process audio
    let audioFrames: AdtsFrame[] = []
    let audioRawData: Uint8Array | null = null
    let audioConfig = state.audioConfig

    if (audioStream) {
        const pesData = concatBuffers(audioStream.data)
        const esData = extractElementaryStream(pesData)
        audioFrames = parseAdtsFrames(esData)

        if (audioFrames.length > 0 && !audioConfig) {
            const firstFrame = audioFrames[0]
            const sampleRate = adtsSampleRate(firstFrame.samplingFrequencyIndex)
            audioConfig = {
                audioObjectType: firstFrame.audioObjectType,
                samplingFrequencyIndex: firstFrame.samplingFrequencyIndex,
                channelConfiguration: firstFrame.channelConfiguration,
                sampleRate,
                audioSpecificConfig: buildAudioSpecificConfig(firstFrame),
            }
            state.audioConfig = audioConfig
        }

        // Strip ADTS headers from frames
        const parts: Uint8Array[] = []
        for (const frame of audioFrames) {
            parts.push(
                esData.subarray(
                    frame.offset + frame.headerSize,
                    frame.offset + frame.frameLength
                )
            )
        }
        audioRawData = concatBuffers(parts)
    }

    // Process video
    let videoNalus: Uint8Array[] = []
    let videoConfig = state.videoConfig
    let videoFrameDuration = 3754 // default ~23.976fps at 90kHz
    const videoPtsList: number[] = []

    if (videoStream) {
        const pesData = concatBuffers(videoStream.data)

        // Extract PTS timestamps from PES headers to compute frame duration and CTOs
        let pesOff = 0
        while (pesOff + 9 < pesData.length) {
            if (
                pesData[pesOff] === 0 &&
                pesData[pesOff + 1] === 0 &&
                pesData[pesOff + 2] === 1 &&
                pesData[pesOff + 3] >= 0xbc
            ) {
                const pts = parsePesPts(pesData.subarray(pesOff))
                if (pts >= 0) videoPtsList.push(pts)
                const pLen = (pesData[pesOff + 4] << 8) | pesData[pesOff + 5]
                if (pLen > 0) {
                    pesOff += 6 + pLen
                } else {
                    const hdrLen = pesData[pesOff + 8]
                    pesOff += 9 + hdrLen
                }
            } else {
                pesOff++
            }
        }
        if (videoPtsList.length >= 2) {
            // Compute frame duration from sorted PTS deltas
            const sorted = [...videoPtsList].sort((a, b) => a - b)
            const deltas: number[] = []
            for (let i = 1; i < sorted.length; i++)
                deltas.push(sorted[i] - sorted[i - 1])
            deltas.sort((a, b) => a - b)
            videoFrameDuration = deltas[deltas.length >> 1] || 3754
        }

        const esData = extractElementaryStream(pesData)
        videoNalus = extractH264Nalus(esData)

        if (!videoConfig) {
            const sps = videoNalus.find((n) => (n[0] & 0x1f) === 7)
            const pps = videoNalus.find((n) => (n[0] & 0x1f) === 8)
            if (sps && pps) {
                const { width, height } = parseSpsInfo(sps)
                videoConfig = {
                    width,
                    height,
                    sps,
                    pps,
                    profileIdc: sps[1],
                    profileCompatibility: sps[2],
                    levelIdc: sps[3],
                }
                state.videoConfig = videoConfig
            }
        }
    }

    // Generate init segment if needed
    if (!state.initSegment && (audioConfig || videoConfig)) {
        const traks: Uint8Array[] = []
        if (videoConfig) {
            traks.push(
                videoTrak({
                    trackId: traks.length + 1,
                    width: videoConfig.width,
                    height: videoConfig.height,
                    sampleEntry: avc1SampleEntry(videoConfig),
                })
            )
        }
        if (audioConfig) {
            traks.push(
                audioTrak({
                    trackId: traks.length + 1,
                    sampleRate: audioConfig.sampleRate,
                    channelCount: audioConfig.channelConfiguration,
                    sampleEntry: mp4aSampleEntry(audioConfig),
                })
            )
        }
        buildInitSegment(state, moov(...traks))
    }

    // Build media segment - for now handle audio track (trackId=1 for video, 2 for audio in muxed)
    const fragments: Uint8Array[] = []
    let duration = 0

    if (videoConfig && videoNalus.length > 0) {
        const trackId = 1

        // Group NAL units into access units. Each IDR or non-IDR slice
        // starts a new access unit. SPS/PPS are prepended to the next IDR.
        const accessUnits: { nalus: Uint8Array[]; isIdr: boolean }[] = []
        let pendingParams: Uint8Array[] = []

        for (const nalu of videoNalus) {
            const naluType = nalu[0] & 0x1f
            if (naluType === 7 || naluType === 8) {
                // SPS or PPS - buffer for next IDR
                pendingParams.push(nalu)
            } else if (naluType === 6) {
                // SEI - attach to next slice's access unit
                pendingParams.push(nalu)
            } else if (naluType === 5) {
                // IDR slice - include SPS/PPS/SEI before it
                accessUnits.push({
                    nalus: [...pendingParams, nalu],
                    isIdr: true,
                })
                pendingParams = []
            } else if (naluType === 1) {
                // Non-IDR slice - include any pending SEI
                accessUnits.push({
                    nalus:
                        pendingParams.length > 0
                            ? [...pendingParams, nalu]
                            : [nalu],
                    isIdr: false,
                })
                pendingParams = []
            }
            // Skip other NAL types (SEI, AUD, etc.)
        }

        if (accessUnits.length > 0) {
            const naluParts: Uint8Array[] = []
            const samples: SampleEntry[] = []
            const frameDuration = videoFrameDuration

            // Compute composition time offsets from PTS.
            // DTS increases linearly; CTO = PTS - DTS.
            const basePts =
                videoPtsList.length > 0 ? Math.min(...videoPtsList) : 0
            const baseDts = basePts // first DTS = first PTS for simplicity

            for (let auIdx = 0; auIdx < accessUnits.length; auIdx++) {
                const au = accessUnits[auIdx]
                // Concatenate all NAL units in this access unit with length prefixes
                let auSize = 0
                const auParts: Uint8Array[] = []
                for (const nalu of au.nalus) {
                    const lengthPrefixed = new Uint8Array(4 + nalu.byteLength)
                    lengthPrefixed[0] = (nalu.byteLength >> 24) & 0xff
                    lengthPrefixed[1] = (nalu.byteLength >> 16) & 0xff
                    lengthPrefixed[2] = (nalu.byteLength >> 8) & 0xff
                    lengthPrefixed[3] = nalu.byteLength & 0xff
                    lengthPrefixed.set(nalu, 4)
                    auParts.push(lengthPrefixed)
                    auSize += lengthPrefixed.byteLength
                }
                naluParts.push(...auParts)

                samples.push({
                    duration: frameDuration,
                    size: auSize,
                    // is_leading=0, depends_on: IDR=2(no), non-IDR=1(yes),
                    // is_depended_on=0, has_redundancy=0
                    flags: au.isIdr ? 0x02000000 : 0x01010000,
                    compositionTimeOffset:
                        auIdx < videoPtsList.length
                            ? videoPtsList[auIdx] -
                              (baseDts + auIdx * frameDuration)
                            : 0,
                })
            }

            const rawData = concatBuffers(naluParts)
            const moofBox = moof({
                sequenceNumber: state.sequenceNumber++,
                trackId,
                baseDecodeTime: state.videoDecodeTime,
                samples,
            })
            state.videoDecodeTime += accessUnits.length * frameDuration
            patchDataOffset(moofBox, moofBox.byteLength)
            const mdatBox = mdat(rawData)
            fragments.push(moofBox, mdatBox)
            duration = (accessUnits.length * frameDuration) / MPEG_TIMESCALE
        }
    }

    if (audioConfig && audioRawData && audioFrames.length > 0) {
        const trackId = videoConfig ? 2 : 1
        const samplesPerFrame = 1024
        const samples: SampleEntry[] = []
        const parts: Uint8Array[] = []
        let offset = 0

        for (const frame of audioFrames) {
            const size = frame.frameLength - frame.headerSize
            parts.push(audioRawData.subarray(offset, offset + size))
            samples.push({
                duration: samplesPerFrame,
                size,
            })
            offset += size
        }

        const rawData = concatBuffers(parts)
        const moofBox = moof({
            sequenceNumber: state.sequenceNumber++,
            trackId,
            baseDecodeTime: state.audioDecodeTime,
            samples,
        })
        state.audioDecodeTime += audioFrames.length * samplesPerFrame
        patchDataOffset(moofBox, moofBox.byteLength)
        const mdatBox = mdat(rawData)
        fragments.push(moofBox, mdatBox)

        const audioDuration =
            (audioFrames.length * samplesPerFrame) / audioConfig.sampleRate
        if (audioDuration > duration) duration = audioDuration
    }

    const mediaSegment = concatBuffers(fragments)

    return {
        initSegment: getInitSegment(state),
        mediaSegment: mediaSegment.buffer.slice(
            mediaSegment.byteOffset,
            mediaSegment.byteOffset + mediaSegment.byteLength
        ) as ArrayBuffer,
        duration,
    }
}

/**
 * Extracts the elementary stream from concatenated PES packet data.
 * Handles multiple PES packets within the buffer.
 */
function extractElementaryStream(pesData: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = []
    let offset = 0

    while (offset < pesData.length) {
        if (
            offset + 9 <= pesData.length &&
            pesData[offset] === 0 &&
            pesData[offset + 1] === 0 &&
            pesData[offset + 2] === 1 &&
            pesData[offset + 3] >= 0xbc // PES stream IDs start at 0xBC
        ) {
            const headerDataLength = pesData[offset + 8]
            const payloadStart = offset + 9 + headerDataLength
            const pesPacketLength =
                (pesData[offset + 4] << 8) | pesData[offset + 5]

            if (pesPacketLength > 0) {
                const pesEnd = Math.min(
                    offset + 6 + pesPacketLength,
                    pesData.length
                )
                if (payloadStart < pesEnd) {
                    parts.push(pesData.subarray(payloadStart, pesEnd))
                }
                offset = pesEnd
            } else {
                // Unknown length — scan for next PES header (00 00 01 + stream_id >= 0xBC)
                let nextPes = payloadStart
                while (nextPes + 3 < pesData.length) {
                    if (
                        pesData[nextPes] === 0 &&
                        pesData[nextPes + 1] === 0 &&
                        pesData[nextPes + 2] === 1 &&
                        pesData[nextPes + 3] >= 0xbc
                    ) {
                        break
                    }
                    nextPes++
                }
                if (nextPes + 3 >= pesData.length) nextPes = pesData.length
                if (payloadStart < nextPes) {
                    parts.push(pesData.subarray(payloadStart, nextPes))
                }
                offset = nextPes
            }
        } else {
            offset++
        }
    }

    return concatBuffers(parts)
}

/**
 * Extracts H.264 NAL units from an Annex B byte stream.
 * Properly handles 3-byte and 4-byte start codes and trims trailing zeros
 * that may result from TS packet padding.
 */
function extractH264Nalus(data: Uint8Array): Uint8Array[] {
    const nalus: Uint8Array[] = []

    // Find all start code positions
    const startPositions: { offset: number; scLen: number }[] = []
    let i = 0
    while (i < data.length - 2) {
        if (data[i] === 0 && data[i + 1] === 0) {
            if (i + 3 < data.length && data[i + 2] === 0 && data[i + 3] === 1) {
                startPositions.push({ offset: i, scLen: 4 })
                i += 4
            } else if (data[i + 2] === 1) {
                startPositions.push({ offset: i, scLen: 3 })
                i += 3
            } else {
                i++
            }
        } else {
            i++
        }
    }

    for (let j = 0; j < startPositions.length; j++) {
        const naluStart = startPositions[j].offset + startPositions[j].scLen
        const naluEnd =
            j + 1 < startPositions.length
                ? startPositions[j + 1].offset
                : data.length

        // Trim trailing zeros (TS packet padding)
        let trimmedEnd = naluEnd
        while (trimmedEnd > naluStart + 1 && data[trimmedEnd - 1] === 0) {
            trimmedEnd--
        }

        if (trimmedEnd > naluStart) {
            nalus.push(data.subarray(naluStart, trimmedEnd))
        }
    }

    return nalus
}

interface SpsInfo {
    readonly width: number
    readonly height: number
}

/**
 * H.264 profiles that include the high-profile SPS extensions
 * (chroma format, bit depth, scaling matrices).
 */
const HIGH_PROFILE_IDCS = new Set([
    100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134,
])

/**
 * Minimal H.264 SPS parser using exp-golomb decoding.
 * Extracts pic_width_in_mbs_minus1 and pic_height_in_map_units_minus1.
 */
function parseSpsInfo(sps: Uint8Array): SpsInfo {
    // SPS NAL unit: skip NAL header byte
    let bitOffset = 8 // skip nal_unit_type byte

    function readBit(): number {
        const byteIndex = bitOffset >> 3
        const bitIndex = 7 - (bitOffset & 7)
        bitOffset++
        return (sps[byteIndex] >> bitIndex) & 1
    }

    function readBits(n: number): number {
        let val = 0
        for (let i = 0; i < n; i++) {
            val = (val << 1) | readBit()
        }
        return val
    }

    function readUe(): number {
        let leadingZeros = 0
        while (readBit() === 0 && leadingZeros < 32) leadingZeros++
        if (leadingZeros === 0) return 0
        return (1 << leadingZeros) - 1 + readBits(leadingZeros)
    }

    function readSe(): number {
        const val = readUe()
        return val & 1 ? (val + 1) >> 1 : -(val >> 1)
    }

    // profile_idc
    const profileIdc = readBits(8)
    // constraint_set flags + reserved
    readBits(8)
    // level_idc
    readBits(8)
    // seq_parameter_set_id
    readUe()

    if (HIGH_PROFILE_IDCS.has(profileIdc)) {
        const chromaFormatIdc = readUe()
        if (chromaFormatIdc === 3) readBit() // separate_colour_plane_flag
        readUe() // bit_depth_luma_minus8
        readUe() // bit_depth_chroma_minus8
        readBit() // qpprime_y_zero_transform_bypass_flag
        const seqScalingMatrixPresent = readBit()
        if (seqScalingMatrixPresent) {
            const count = chromaFormatIdc !== 3 ? 8 : 12
            for (let i = 0; i < count; i++) {
                if (readBit()) {
                    // 8x8 scaling lists (i >= 6) require a real H.264 encoder
                    // to produce a valid SPS bitstream that survives the full
                    // exp-golomb parser to this point.
                    const size = i < 6 ? 16 : /* c8 ignore next */ 64
                    let lastScale = 8
                    let nextScale = 8
                    for (let j = 0; j < size; j++) {
                        if (nextScale !== 0) {
                            const delta = readSe()
                            nextScale = (lastScale + delta + 0x100) % 0x100
                        }
                        lastScale = nextScale === 0 ? lastScale : nextScale
                    }
                }
            }
        }
    }

    readUe() // log2_max_frame_num_minus4
    const picOrderCntType = readUe()
    if (picOrderCntType === 0) {
        readUe() // log2_max_pic_order_cnt_lsb_minus4
    } else if (picOrderCntType === 1) {
        readBit() // delta_pic_order_always_zero_flag
        readSe() // offset_for_non_ref_pic
        readSe() // offset_for_top_to_bottom_field
        const numRefFrames = readUe()
        for (let i = 0; i < numRefFrames; i++) readSe()
    }

    readUe() // max_num_ref_frames
    readBit() // gaps_in_frame_num_value_allowed_flag

    const picWidthInMbsMinus1 = readUe()
    const picHeightInMapUnitsMinus1 = readUe()
    const frameMbsOnlyFlag = readBit()

    const width = (picWidthInMbsMinus1 + 1) * 16
    const height = (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16

    return { width, height }
}
