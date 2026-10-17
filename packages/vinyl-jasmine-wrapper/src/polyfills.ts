/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Jasmine and the specs it runs use built-ins that legacy browsers (e.g. Edge 18) lack, such as
// globalThis, structuredClone, queueMicrotask, and Object.fromEntries.
import 'core-js/stable'
