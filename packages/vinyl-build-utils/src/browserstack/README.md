### Browserstack

The BrowserStack launcher starts a local server, creates a secure local tunnel
to BrowserStack, and exposes a REST API a Jasmine reporter uses to provide test
updates.

Usage example:

```typescript
import {
    vinylSupportedBrowsers,
    runBrowserStack,
} from '@amazon/vinyl-build-util'
import process from 'node:process'

void runBrowserStack({
    server: {
        http: { port: 9000 },
        staticDir: './dist/test',
        addressInUseAutoIncrement: true,
    },
    browsers: vinylSupportedBrowsers,

    workerCommon: {
        project: '@amazon/vinyl',
    },
    stopOnFirstFailure: true,
}).then((result) => {
    if (!result.passed) process.exit(1)
})
```

Shell output:

```
Session created for 'OS X chrome latest': https://automate.browserstack.com/builds/...
Session created for 'Windows firefox 76.0': https://automate.browserstack.com/builds/...
Session created for 'OS X safari latest': https://automate.browserstack.com/builds/...
Session created for 'Windows firefox latest': https://automate.browserstack.com/builds/...
Session created for 'OS X chrome 52': https://automate.browserstack.com/builds/...
Session created for 'Windows edge 18.0': https://automate.browserstack.com/builds/...
✅ Windows firefox latest passed
passed: 1, failed: 0, running: 5, pending: 4
[================>                                 ] 32%

```

Test workers are created as they become available according to the Automate plan
details. If test results aren't received within a capture timeout, the worker is
deleted and restarted if there are remaining attempts. Test failures will not be
restarted, and incomplete tests will be marked as failures.

```
+---------------------+
| Jasmine Tests.      |
| Run on BS devices   |
| as a service worker |<--+
+---------------------+   |
          |               |
          |               |
 report test progress     | launch
     (worker id           | worker
  via search param)       |
          |               +----------+
          ▼                          |
+---------------------+            +--------------+
| NodeJS local server | ---------> | BS REST API  |
+---------------------+            +--------------+
```
