/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export function scrollToTop() {
    document.scrollingElement?.scroll({ top: 0, left: 0 })
}
