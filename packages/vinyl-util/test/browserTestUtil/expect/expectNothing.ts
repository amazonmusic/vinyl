/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Some tests (such as benchmarks or type expectations) have no jasmine expectations.
 */
export function expectNothing() {
    expect(true).toBeTruthy()
}
