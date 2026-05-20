/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    base64ToByteArray,
    getSidxSampleTimes,
    isNode,
    parseSidxBox,
} from '@amazon/vinyl-util'

describe('parseSidxBox', () => {
    it('can parse a valid sidx mp4 box version 0', () => {
        // Taken from vinylTestAssets.dash.live_static_aac_opus_flac_60s_segmentBase
        const byteArray = base64ToByteArray(
            'AAAAaHNpZHgAAAAAAAAAAQAArEQAAAAAAAAAAAAAAAYAAnl4AAa8AJAAAAAAAnp1AAa8AJAAAAAAAnkNAAa4AJAAAAAAAnqFAAa8AJAAAAAAAnp0AAa8AJAAAAAAAn/TAAa38JAAAAA='
        )
        const sidxBox = parseSidxBox(byteArray.buffer)
        expect(sidxBox).toEqual({
            version: 0,
            referenceId: 1,
            timescale: 44100,
            earliestPresentationTime: 0,
            firstOffset: 0,
            references: [
                {
                    referenceType: 0,
                    referencedSize: 162168,
                    subsegmentDuration: 441344,
                    startsWithSap: true,
                    sapType: 1,
                    sapDeltaTime: 0,
                },
                {
                    referenceType: 0,
                    referencedSize: 162421,
                    subsegmentDuration: 441344,
                    startsWithSap: true,
                    sapType: 1,
                    sapDeltaTime: 0,
                },
                {
                    referenceType: 0,
                    referencedSize: 162061,
                    subsegmentDuration: 440320,
                    startsWithSap: true,
                    sapType: 1,
                    sapDeltaTime: 0,
                },
                {
                    referenceType: 0,
                    referencedSize: 162437,
                    subsegmentDuration: 441344,
                    startsWithSap: true,
                    sapType: 1,
                    sapDeltaTime: 0,
                },
                {
                    referenceType: 0,
                    referencedSize: 162420,
                    subsegmentDuration: 441344,
                    startsWithSap: true,
                    sapType: 1,
                    sapDeltaTime: 0,
                },
                {
                    referenceType: 0,
                    referencedSize: 163795,
                    subsegmentDuration: 440304,
                    startsWithSap: true,
                    sapType: 1,
                    sapDeltaTime: 0,
                },
            ],
        })
    })

    it('throws when sidx data is truncated', () => {
        const byteArray = base64ToByteArray(
            'AAAAaHNpZHgAAAAAAAAAAQAArEQAAAAAAAAAAAAAAAY'
        )
        expect(() => parseSidxBox(byteArray.buffer)).toThrowError(
            'Unexpected end of buffer reached at position: 32. Reading 4 bytes, 0 available.'
        )
    })

    it('throws when not a sidx box', () => {
        const byteArray = base64ToByteArray('AAAACHNpZHk=')
        expect(() => parseSidxBox(byteArray.buffer)).toThrowError(
            `expected 'sidx' box but had box type: 'sidy'`
        )
    })

    describe('if the sidx format is version 1', () => {
        const sidxVersion1 = base64ToByteArray(
            'AAAAWHNpZHgBAAAAAAAAAQAAA+gAAAAAB1vNFQAAAAAFOX+xAAAABAAAAAAAACcQkAAAAAAAAAAAAC7gkAAAAAAAAAAAADqYkAAAAAAAAAAAAB9AkAAAAA=='
        )

        describe('and BigInt is not supported', () => {
            let originalBigInt: typeof BigInt
            beforeEach(() => {
                if (!isNode()) {
                    pending('requires node environment to test')
                    return
                }
                originalBigInt = BigInt
                delete (global as any).BigInt
            })

            afterEach(() => {
                global.BigInt = originalBigInt
            })

            it('throws a MediaUnsupportedException', () => {
                expect(() => parseSidxBox(sidxVersion1.buffer)).toThrowError(
                    'sidx box version 1 not supported on this platform'
                )
            })
        })

        describe('and BigInt is supported', () => {
            beforeEach(() => {
                if (typeof BigInt === 'undefined') {
                    pending('sidx version 1 cannot be tested on this platform')
                }
            })

            it('can correctly parse', () => {
                const sidxBox = parseSidxBox(sidxVersion1.buffer)

                expect(sidxBox).toEqual({
                    version: 1,
                    referenceId: 1,
                    timescale: 1000,
                    earliestPresentationTime: BigInt('123456789'),
                    firstOffset: BigInt('87654321'),
                    references: [
                        {
                            referenceType: 0,
                            referencedSize: 0,
                            subsegmentDuration: 10000,
                            startsWithSap: true,
                            sapType: 1,
                            sapDeltaTime: 0,
                        },
                        {
                            referenceType: 0,
                            referencedSize: 0,
                            subsegmentDuration: 12000,
                            startsWithSap: true,
                            sapType: 1,
                            sapDeltaTime: 0,
                        },
                        {
                            referenceType: 0,
                            referencedSize: 0,
                            subsegmentDuration: 15000,
                            startsWithSap: true,
                            sapType: 1,
                            sapDeltaTime: 0,
                        },
                        {
                            referenceType: 0,
                            referencedSize: 0,
                            subsegmentDuration: 8000,
                            startsWithSap: true,
                            sapType: 1,
                            sapDeltaTime: 0,
                        },
                    ],
                })
            })
        })
    })

    describe('if the sidx format is format > 1', () => {
        it('throws a MediaUnsupportedError', () => {
            const byteArray = base64ToByteArray(
                'AAAAWHNpZHgCAAAAAAAAAQAAA+gAAAAAB1vNFQAAAAAFOX+xAAAABAAAAAAAACcQkAAAAAAAAAAAAC7gkAAAAAAAAAAAADqYkAAAAAAAAAAAAB9AkAAAAA=='
            )
            expect(() => parseSidxBox(byteArray.buffer)).toThrowError(
                `sidx box version 2 not supported`
            )
        })
    })

    describe('if reference type is hierarchical', () => {
        it('throws a validation error', () => {
            const byteArray = base64ToByteArray(
                'AAAAWHNpZHgAAAAAAAAAAQAAA+gAAATSAAAghAAAAASAAAB7AAAnEJAAAACAAAB7AAAu4JAAAACAAAB7AAA6mJAAAACAAAB7AAE4gJAAAAAAAAAAAAAAAA=='
            )
            expect(() => parseSidxBox(byteArray.buffer)).toThrowError(
                'hierarchical sidx reference type not supported'
            )
        })
    })

    describe('getSidxSampleTimes', () => {
        it('returns a list of sample start times, ending with the final duration', () => {
            const byteArray = base64ToByteArray(
                'AAAAaHNpZHgAAAAAAAAAAQAArEQAAAAAAAAAAAAAAAYAAnl4AAa8AJAAAAAAAnp1AAa8AJAAAAAAAnkNAAa4AJAAAAAAAnqFAAa8AJAAAAAAAnp0AAa8AJAAAAAAAn/TAAa38JAAAAA='
            )
            const sidxBox = parseSidxBox(byteArray.buffer)
            expect(getSidxSampleTimes(sidxBox)).toEqual([
                0, 441344, 882688, 1323008, 1764352, 2205696, 2646000,
            ])
        })
    })
})
