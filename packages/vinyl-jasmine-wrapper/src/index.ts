/*
 * Copyright (c) 2025. Amazon.com, Inc. or its affiliates. All rights reserved.
 */

// Ordinarily this would be a bad practice to import specific non-exported files like this,
// however, the jasmine browser runner does not support a wide range of browsers; it does not
// use babel. The jasmine and jasmine-core modules are meant for node and have no browser
// artifacts. The documented approach for a standalone jasmine runner is to use the jasmine releases
// at https://github.com/jasmine/jasmine/releases. However, copying the sources from the release
// artifacts is less maintainable than listing the jasmine-core files needed from npm.

import './polyfills'

import 'jasmine-core/lib/jasmine-core/jasmine-html.js' // must be before boot
import 'jasmine-core/lib/jasmine-core/boot0.js'
import 'jasmine-core/lib/jasmine-core/boot1.js'

// The default is 5s. Increase in order to allow time for the web server to start.
jasmine.DEFAULT_TIMEOUT_INTERVAL = 15_000
