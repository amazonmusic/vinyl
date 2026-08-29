# @amazon/vinyl-browserstack

Runs an **in-browser Jasmine** suite across BrowserStack real browsers over
**Selenium/WebDriver** (`hub-cloud.browserstack.com/wd/hub`).

## How it works

The consuming package builds a browser test page (its Jasmine bootstrap + specs)
and serves it. This runner:

1. Starts a local Express server (serving the test page) plus a **reporter REST
   API** the in-browser suite posts progress and logs to.
2. Starts the **BrowserStack Local** tunnel.
3. Builds a real **WebDriver** session per browser — parallelized to the
   account's available session budget — and navigates each to the test URL with
   a `?reportApi=` query param.
4. Keeps each session alive with a periodic no-op WebDriver command (the specs
   run in-browser with no driver interaction, so the session's idle timer must
   be reset explicitly — REST status polling does not reset it), and enforces a
   local max-duration cap since WebDriver has no server-side worker timeout.
5. Aggregates per-spec pass/fail, writes `bStackLogs/<sessionId>.log` per
   session, and stamps each session pass/fail via the Automate REST API.

This is the WebDriver successor to the legacy `/5/worker` (JS Testing) transport
in `@amazon/vinyl-build-utils`. It reuses that package's framework-agnostic
primitives (reporter API, Express server, Local tunnel, Automate client,
credentials, logging) and swaps only the transport.

Unlike the legacy transport, WebDriver sessions populate the BrowserStack
dashboard **Console Logs** tab (Chrome only; `bStackLogs/` remains the complete
cross-browser log source).

## Usage

```ts
import { runSeleniumBrowserStackAndExit } from '@amazon/vinyl-browserstack'
import { vinylDefaultBrowserStackOptions } from '@amazon/vinyl-build-utils'

runSeleniumBrowserStackAndExit({
    ...vinylDefaultBrowserStackOptions,
    workerCommon: { project: 'MyProject' },
})
```

Credentials come from `options.credentials` or the `BROWSERSTACK_USERNAME` /
`BROWSERSTACK_ACCESS_KEY` environment variables (a `.env` file is honored).
