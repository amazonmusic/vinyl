/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeIndexFile } from '@amazon/vinyl-build-utils'

writeIndexFile('./src')
writeIndexFile('./test/vinylTestUtil')
writeIndexFile('./test/unit')
writeIndexFile('./test/integ')
writeIndexFile('./test/benchmark')
