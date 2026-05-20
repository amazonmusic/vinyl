/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export const ContentProtectionScheme = {
    /**
     * CENC protection scheme. (Should not be used to create a key session)
     */
    CENC: 'urn:mpeg:dash:mp4protection:2011',

    /**
     * A simple, unencrypted content protection scheme. Not a full DRM solution.
     */
    CLEAR_KEY: 'urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e',

    /**
     * Apple's FairPlay.
     */
    FAIR_PLAY: 'urn:uuid:94ce86fb-07ff-4f43-adb8-93d2fa968ca2',

    /**
     * Open-standards community initiative by Marlin Developer Community.
     */
    MARLIN: 'urn:uuid:5e629af5-38da-4063-8977-97ffbd9902d4',

    /**
     * Microsoft's PlayReady.
     */
    PLAY_READY: 'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95',

    /**
     * An old, unused PlayReady scheme id.
     */
    PLAY_READY_DEPRECATED: 'urn:uuid:79f0049a-4098-8642-ab92-e65be0885f95',

    /**
     * Google's Widevine.
     */
    WIDEVINE: 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
} as const
