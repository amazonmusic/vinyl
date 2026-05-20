/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { utf16ToUint16Array } from '@amazon/vinyl-util'

/**
 * Create the payload for EME media key session from `encrypted` / `*needkey` event data and DRM
 * certificate.
 * Note: This code is taken from the official FairPlay SDK example.
 *
 * @param initData
 * @param contentId
 * @param certificateData certificate data as a Uint8Array
 */
export function createFairPlaySessionInitData(
    initData: Uint8Array,
    contentId: string,
    certificateData: Uint8Array
): Uint8Array {
    const contentIdUint16 = utf16ToUint16Array(contentId)
    const certificateDataUint8 = certificateData

    let offset = 0
    const buffer = new ArrayBuffer(
        initData.byteLength +
            4 + // contentId length
            contentIdUint16.byteLength +
            4 + // certificateDataUint8 length
            certificateDataUint8.byteLength
    )

    const initDataArray = new Uint8Array(buffer, offset, initData.byteLength)
    initDataArray.set(initData)
    offset += initData.byteLength

    const dataView = new DataView(buffer)
    dataView.setUint32(offset, contentIdUint16.byteLength, true)
    offset += 4

    const idArray = new Uint16Array(buffer, offset, contentIdUint16.length)
    idArray.set(contentIdUint16)
    offset += idArray.byteLength

    dataView.setUint32(offset, certificateDataUint8.byteLength, true)
    offset += 4

    const certArray = new Uint8Array(
        buffer,
        offset,
        certificateDataUint8.byteLength
    )
    certArray.set(certificateDataUint8)

    return new Uint8Array(buffer, 0, buffer.byteLength)
}
