/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    parsePlayReadyKeyMessage,
    unpackPlayReadyChallenge,
} from '@amazon/vinyl'
import { bufferToBase64, utf16ToUint16Array } from '@amazon/vinyl-util'

describe('unpackPlayReadyChallenge', () => {
    describe('when the challenge is not packed', () => {
        it('returns the challenge as is and returns a content type header', () => {
            {
                const challenge = new Uint8Array([1, 2, 3, 4]).buffer
                expect(unpackPlayReadyChallenge(challenge)).toEqual({
                    challenge,
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                    },
                })
            }
            {
                const challenge = new Uint8Array([1, 2, 3]).buffer // Odd length challenges cannot be UTF-16
                expect(unpackPlayReadyChallenge(challenge)).toEqual({
                    challenge,
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                    },
                })
            }
        })
    })

    describe('when the challenge is packed', () => {
        it('returns the unpacked challenge with parsed headers', () => {
            const challenge = new Uint8Array([1, 2, 3, 4, 5, 6]).buffer

            const xml = `<PlayReadyKeyMessage type="LicenseAcquisition">
       <LicenseAcquisition Version="1">
         <Challenge encoding="base64encoded">${bufferToBase64(challenge)}</Challenge>
         <HttpHeaders>
           <HttpHeader>
             <name>Content-Type</name>
             <value>text/xml; charset=utf-8</value>
           </HttpHeader>
           <HttpHeader>
             <name>SOAPAction</name>
             <value>http://schemas.microsoft.com/DRM/etc/etc</value>
           </HttpHeader>
         </HttpHeaders>
       </LicenseAcquisition>
     </PlayReadyKeyMessage>`
            expect(
                unpackPlayReadyChallenge(
                    utf16ToUint16Array(xml) as unknown as ArrayBuffer
                )
            ).toEqual({
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    SOAPAction: 'http://schemas.microsoft.com/DRM/etc/etc',
                },
                challenge: challenge,
            })
        })
    })
})

describe('parsePlayReadyKeyMessage', () => {
    it('returns a parsed PlayReadyKeyMessage', () => {
        // language=XML
        const message = parsePlayReadyKeyMessage(
            `<PlayReadyKeyMessage type="LicenseAcquisition">
       <LicenseAcquisition Version="1">
         <Challenge encoding="base64encoded">aabbccdd</Challenge>
         <HttpHeaders>
           <HttpHeader>
             <name>Content-Type</name>
             <value>text/xml; charset=utf-8</value>
           </HttpHeader>
           <HttpHeader>
             <name>SOAPAction</name>
             <value>http://schemas.microsoft.com/DRM/etc/etc</value>
           </HttpHeader>
         </HttpHeaders>
       </LicenseAcquisition>
     </PlayReadyKeyMessage>
        `
        )
        expect(message.toJSON()).toEqual({
            PlayReadyKeyMessage: {
                type: 'LicenseAcquisition',
                LicenseAcquisition: {
                    Version: 1,
                    Challenge: {
                        encoding: 'base64encoded',
                        _content: 'aabbccdd',
                    },
                    HttpHeaders: {
                        HttpHeader: [
                            {
                                name: { _content: 'Content-Type' },
                                value: { _content: 'text/xml; charset=utf-8' },
                            },
                            {
                                name: { _content: 'SOAPAction' },
                                value: {
                                    _content:
                                        'http://schemas.microsoft.com/DRM/etc/etc',
                                },
                            },
                        ],
                    },
                },
            },
        })
    })
})
