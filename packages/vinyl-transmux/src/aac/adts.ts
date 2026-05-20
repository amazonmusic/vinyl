/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ADTS (Audio Data Transport Stream) frame parser for AAC.
 *
 * ADTS is the framing format used to carry AAC audio in MPEG-TS and raw .aac
 * files. Each frame starts with a 7-byte (or 9-byte with CRC) sync header
 * containing the audio object type, sample rate, and channel configuration
 * needed to construct the MP4 AudioSpecificConfig.
 *
 * @module
 */

export interface AdtsFrame {
    /** Offset of this frame within the source buffer. */
    readonly offset: number
    /** Total frame size including header. */
    readonly frameLength: number
    /** Size of the ADTS header (7 or 9 bytes). */
    readonly headerSize: number
    /** AAC audio object type (1 = AAC-LC, 2 = HE-AAC, etc.). */
    readonly audioObjectType: number
    /** Sampling frequency index (0-12). */
    readonly samplingFrequencyIndex: number
    /** Channel configuration (1 = mono, 2 = stereo, etc.). */
    readonly channelConfiguration: number
}

const ADTS_SAMPLING_RATES = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025,
    8000, 7350,
]

/**
 * Returns the sample rate in Hz for a given sampling frequency index.
 */
export function adtsSampleRate(index: number): number {
    return ADTS_SAMPLING_RATES[index] ?? 0
}

/**
 * Parses all ADTS frames from a buffer of raw AAC data.
 */
export function parseAdtsFrames(data: Uint8Array): AdtsFrame[] {
    const frames: AdtsFrame[] = []
    let offset = 0

    while (offset + 7 <= data.length) {
        // ADTS sync word: 0xFFF
        if (data[offset] !== 0xff || (data[offset + 1] & 0xf0) !== 0xf0) {
            offset++
            continue
        }

        const hasCrc = (data[offset + 1] & 0x01) === 0
        const headerSize = hasCrc ? 9 : 7

        const audioObjectType = ((data[offset + 2] >> 6) & 0x03) + 1
        const samplingFrequencyIndex = (data[offset + 2] >> 2) & 0x0f
        const channelConfiguration =
            ((data[offset + 2] & 0x01) << 2) | ((data[offset + 3] >> 6) & 0x03)

        const frameLength =
            ((data[offset + 3] & 0x03) << 11) |
            (data[offset + 4] << 3) |
            ((data[offset + 5] >> 5) & 0x07)

        if (frameLength < headerSize || offset + frameLength > data.length) {
            break
        }

        frames.push({
            offset,
            frameLength,
            headerSize,
            audioObjectType,
            samplingFrequencyIndex,
            channelConfiguration,
        })

        offset += frameLength
    }

    return frames
}

/**
 * Builds the AudioSpecificConfig (2 bytes) for an AAC-LC stream.
 * This is required in the MP4 esds box.
 */
export function buildAudioSpecificConfig(frame: AdtsFrame): Uint8Array {
    const config = new Uint8Array(2)
    config[0] =
        (frame.audioObjectType << 3) |
        ((frame.samplingFrequencyIndex & 0x0e) >> 1)
    config[1] =
        ((frame.samplingFrequencyIndex & 0x01) << 7) |
        (frame.channelConfiguration << 3)
    return config
}
