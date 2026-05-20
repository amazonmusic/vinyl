/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Added to ensure file is treated as module
export {}

//
// This adds implementation-specific EME methods to HMTLMediaElement's interface.
//

declare global {
    interface HTMLMediaElement {
        webkitSetMediaKeys?(mediaKeys: WebKitMediaKeys | null): void
        msSetMediaKeys?(mediaKeys: MSMediaKeys | null): void
    }
}
