/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    base64ToByteArray,
    bufferToUtf16,
    logDebug,
    type LogTarget,
    type ReadonlyRecord,
} from '@amazon/vinyl-util'
import type { XmlElement } from '@amazon/vinyl-xml'
import {
    attrInt,
    attrString,
    charactersString,
    element,
    elements,
    parseXml,
    parseXmlHandler,
    type XmlRules,
} from '@amazon/vinyl-xml'

/**
 * The final challenge buffer and headers for a playready license challenge.
 */
export interface UnpackedPlayReadyChallenge {
    readonly challenge: ArrayBuffer
    readonly headers: ReadonlyRecord<string, string>
}

const logTarget: LogTarget = {
    logPrefix: 'unpackPlayReadyChallenge',
}

/**
 * IE and Edge wraps playready license challenges in PlayReadyKeyMessage xml.
 * Not all PlayReady clients do this.
 * Checks if the challenge is wrapped, and if so, returns the set headers and unwrapped challenge.
 * Otherwise, returns the challenge as-is with the required content type header.
 *
 * @param challenge The array buffer from the 'message' cdm event.
 */
export function unpackPlayReadyChallenge(
    challenge: ArrayBuffer
): UnpackedPlayReadyChallenge {
    const xml = challenge.byteLength % 2 === 0 ? bufferToUtf16(challenge) : ''
    if (!xml.includes('PlayReadyKeyMessage')) {
        logDebug(logTarget, 'not wrapped')
        // A client that does not wrap the challenge.
        return {
            challenge,
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
            },
        }
    }
    logDebug(logTarget, 'unpacking challenge')
    const message = parsePlayReadyKeyMessage(xml)
    const licenseAcquisition = message.PlayReadyKeyMessage.LicenseAcquisition
    const unpackedChallenge = base64ToByteArray(
        licenseAcquisition.Challenge._content
    ).buffer
    const headers: Record<string, string> = {}
    for (const element of licenseAcquisition.HttpHeaders.HttpHeader) {
        headers[element.name._content] = element.value._content
    }
    return {
        challenge: unpackedChallenge,
        headers,
    }
}

interface PlayReadyMessage {
    readonly PlayReadyKeyMessage: PlayReadyKeyMessageType
}

interface PlayReadyKeyMessageType {
    readonly type?: string
    readonly LicenseAcquisition: LicenseAcquisitionType
}

interface LicenseAcquisitionType {
    readonly Version: number
    readonly Challenge: ChallengeType
    readonly HttpHeaders: HttpHeadersType
}

interface ContentType {
    readonly _content: string
}

interface ChallengeType extends ContentType {
    readonly encoding?: string
}

interface HttpHeadersType {
    readonly HttpHeader: readonly HttpHeaderType[]
}

interface HttpHeaderType {
    readonly name: ContentType
    readonly value: ContentType
}

const challengeType: XmlRules<ChallengeType> = {
    _content: charactersString,
    encoding: attrString,
}

const contentType: XmlRules<ContentType> = {
    _content: charactersString,
}

const headerType: XmlRules<HttpHeaderType> = {
    name: element(contentType, { required: true }),
    value: element(contentType, { required: true }),
}

const httpHeadersType: XmlRules<HttpHeadersType> = {
    HttpHeader: elements(headerType, { useEmptyArrays: true }),
}

const licenseAcquisitionType: XmlRules<LicenseAcquisitionType> = {
    Challenge: element(challengeType, { required: true }),
    HttpHeaders: element(httpHeadersType, { required: true }),
    Version: attrInt({ required: true }),
}

const playReadyKeyMessageType: XmlRules<PlayReadyKeyMessageType> = {
    LicenseAcquisition: element(licenseAcquisitionType, { required: true }),
    type: attrString(),
}

const playReadyMessageRules: XmlRules<PlayReadyMessage> = {
    PlayReadyKeyMessage: element(playReadyKeyMessageType, {
        required: true,
    }),
}

/**
 * A Content handler for a PlayReady SOAP message.
 */
const playReadyXmlHandler = parseXmlHandler(playReadyMessageRules)

export function parsePlayReadyKeyMessage(
    xmlStr: string
): PlayReadyMessage & XmlElement<PlayReadyMessage> {
    return parseXml(xmlStr, playReadyXmlHandler)
}
