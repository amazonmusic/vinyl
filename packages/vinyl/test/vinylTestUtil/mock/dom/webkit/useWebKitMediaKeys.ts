/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { overrideGlobalInit } from '@amazon/vinyl-util/testUtil'
import { mediaKeySupportRef } from '@amazon/vinyl'

/**
 * Overrides media key support.
 */
export function useWebKitMediaKeys(present: boolean): void {
    overrideGlobalInit(mediaKeySupportRef, () => {
        return {
            webkitEme: present,
            standardEme: false,
            msEme: false,
        }
    })
}
