/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { BufferReader } from '../buffer/BufferReader'
import { ValidationError } from '../../error/ValidationError'
import { ErrorOrigin } from '../../error/ErrorOrigin'
import { MediaUnsupportedError } from '../../error/MediaUnsupportedError'

/**
 * ISO_IEC_14496-12 Segment Index Box
 * @module
 */

/**
 * Represents the base structure of a Segment Index ('sidx') Box.
 * The 'sidx' box is used in MPEG-4 media files to provide indexing information for efficient data access and retrieval.
 */
export interface SidxBoxBase {
    /**
     * The version, 0 and 1 supported.
     */
    readonly version: number

    /**
     * The ID of the track.
     */
    readonly referenceId: number

    /**
     * The timescale for the media in this 'sidx' box. It is a 32-bit unsigned integer.
     * This value represents the number of time units that pass in one second.
     */
    readonly timescale: number

    /**
     * An array of segment references. Each segment reference provides information about individual media segments.
     */
    readonly references: readonly SidxSegmentReference[]
}

/**
 * Properties specific to version 0 of a Segment Index ('sidx') Box.
 */
export interface SidxBoxV0 extends SidxBoxBase {
    readonly version: 0

    /**
     * The earliest presentation time of any access unit in the media segments that are referenced by this 'sidx' box.
     */
    readonly earliestPresentationTime: number

    /**
     * The byte offset from the end of this 'sidx' box to the first media segment in this 'sidx'.
     * For version 0, this is a 32-bit unsigned integer.
     */
    readonly firstOffset: number
}

/**
 * Properties specific to version 1 of a Segment Index ('sidx') Box.
 */
export interface SidxBoxV1 extends SidxBoxBase {
    readonly version: 1

    /**
     * The earliest presentation time of any access unit in the media segments that are referenced by this 'sidx' box.
     */
    readonly earliestPresentationTime: bigint

    /**
     * The byte offset from the end of this 'sidx' box to the first media segment in this 'sidx'.
     */
    readonly firstOffset: bigint
}

export type SidxBox = SidxBoxV0 | SidxBoxV1

/**
 * A single segment reference within a sidx box.
 */
export interface SidxSegmentReference {
    /**
     * Indicates the reference type. A value of 0 means the reference is to a media segment. A value of 1 indicates
     * the reference is to a hint track segment.
     */
    readonly referenceType: number

    /**
     * The size of the referenced segment in bytes.
     */
    readonly referencedSize: number

    /**
     * The duration of the subsegment. This is expressed in the timescale provided in the 'sidx' box.
     */
    readonly subsegmentDuration: number

    /**
     * Indicates if the segment starts with a SAP (Stream Access Point). If `true`, the segment starts with a SAP,
     * facilitating random access and efficient streaming.
     */
    readonly startsWithSap: boolean

    /**
     * The SAP type indicates the type of stream access point that starts the segment. This is a 3-bit field. The
     * SAP types are defined in ISO/IEC 14496-12, and they describe the characteristics of the stream access points.
     */
    readonly sapType: number

    /**
     * The SAP delta time specifies the difference in time (in the timescale of the 'sidx' box) between the earliest
     * presentation time of the segment and the first SAP within it. This allows players to quickly locate the SAP
     * for efficient playback startup or seeking.
     */
    readonly sapDeltaTime: number
}

export function parseSidxBox(buffer: ArrayBuffer): SidxBox {
    const reader = new BufferReader(buffer)

    reader.skip(4) // box size
    const boxType = reader.readString(4)
    if (boxType !== 'sidx')
        throw new ValidationError(
            `expected 'sidx' box but had box type: '${boxType}'`,
            ErrorOrigin.MEDIA
        )

    const version = reader.readUint8()

    // Skip flags
    reader.skip(3)

    const referenceId = reader.readUint32()
    const timescale = reader.readUint32()

    let versionedProps:
        | {
              // v0
              readonly version: 0
              readonly earliestPresentationTime: number
              readonly firstOffset: number
          }
        | {
              // v1
              readonly version: 1
              readonly earliestPresentationTime: bigint
              readonly firstOffset: bigint
          }

    if (version === 0) {
        versionedProps = {
            version: 0,
            earliestPresentationTime: reader.readUint32(),
            firstOffset: reader.readUint32(),
        }
    } else {
        // version > 1 may be backwards compatible for our use cases, but may not be. Log a warning.
        if (version !== 1)
            throw new MediaUnsupportedError(
                `sidx box version ${version} not supported`,
                'unsupported-sidx-version'
            )
        if (typeof BigInt === 'undefined')
            throw new MediaUnsupportedError(
                `sidx box version 1 not supported on this platform`,
                'client-unsupported-sidx-version'
            )
        versionedProps = {
            version: 1,
            earliestPresentationTime: reader.readUint64(),
            firstOffset: reader.readUint64(),
        }
    }

    // Skip reserved bits
    reader.skip(2)

    const referenceCount = reader.readUint16()
    const references: SidxSegmentReference[] = new Array(referenceCount)

    for (let i = 0; i < referenceCount; i++) {
        const refTypeAndSize = reader.readUint32()
        // 1 bit
        const referenceType = (refTypeAndSize & 0x80000000) >>> 31

        if (referenceType !== 0) {
            // ISO_IEC_14496-12 K.2.2
            throw new MediaUnsupportedError(
                'hierarchical sidx reference type not supported',
                'unsupported-sidx-reference-type'
            )
        }

        // 31 bits
        const referencedSize = refTypeAndSize & 0x7fffffff

        const subsegmentDuration = reader.readUint32()

        const sap = reader.readUint32()
        const startsWithSap = (sap & 0x80000000) >>> 31 === 1
        const sapType = (sap >>> 28) & 0x07
        const sapDeltaTime = sap & 0x0fffffff

        references[i] = {
            referenceType,
            referencedSize,
            subsegmentDuration,
            startsWithSap,
            sapType,
            sapDeltaTime,
        }
    }
    return {
        ...versionedProps,
        referenceId,
        timescale,
        references,
    }
}

/**
 * Creates a timeline of the segment start times, in timescale units.
 * The last element will be the last segment's end time.
 *
 * @param sidx
 */
export function getSidxSampleTimes(sidx: SidxBox) {
    let sampleTime = Number(sidx.earliestPresentationTime)
    const n = sidx.references.length
    const sampleTimes: number[] = new Array<number>(n + 1)
    for (let i = 0; i < n; i++) {
        sampleTimes[i] = sampleTime
        sampleTime += sidx.references[i].subsegmentDuration
    }
    sampleTimes[n] = sampleTime
    return sampleTimes
}
