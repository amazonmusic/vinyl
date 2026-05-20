# Networking

The Amazon Vinyl Networking layer is an enhanced wrapper around a Fetch
implementation (such as `fetch` or `node-fetch`) that offers several advanced
features:

- Implements exponential back-off on client requests when a service fails,
  reducing the risk of prolonged traffic surges.
- Automatically retries specific types of failures, addressing potential
  transient service issues.

- Standardizes abort and timeout behavior across all network requests.
- Collects and provides detailed networking metrics, including service failure
  rates and data transfer speeds.

## Usage

The API is similar to `fetch`, with a couple key differences.

- Responses with a !ok status will reject, not resolve.
- An optional third parameter can be provided with Requester configuration such
  as setting a service id or an Abort controller (note that `signal` is not
  supported). Service ids may be any string that identifies the service for
  metrics and backoff.

```typescript
import { Abort, requesterWithRetryRef } from '@amazon/vinyl-util'

const abort = new Abort()
const response = await requestWithRetry(
    'https://example.com',
    {
        method: 'POST',
        headers: {
            exampleHeader: 'value',
        },
        body: JSON.stringify(requestWithRetry),
    },
    {
        serviceId: 'example.com',
        abort,
    }
)
```

In most cases, `requesterWithRetryRef` should be used, which uses a client set
to reasonable defaults for retry policies, backoff distribution, retryable
status codes, etc.

`requesterWithRetryRef` is configured to use a single retry when the response
code is one of:

```
429, // Too many requests
503, // Service unavailable
504, // Gateway timeout
```

The backoff time is a clamped exponential backoff with a randomized jitter.
Backoff applies only when a service id is set.

In advanced cases a new `RequesterImpl` may be created.

```typescript
const requester = new RequesterImpl({
    networkMetricsController: networkMetricsControllerRef.value,
    networkState: networkStateRef.value,
    fetch: nativeFetchRef.value,
})
requester.configure({
    retryOptions: RetryStrategy.ONE_RETRY,
    timeout: 90,
})
networkLoggingHandler(requester)
```

## Control Flow

```
                                +-------------+
                                |   fetch     |
                                +-------------+
                                       |
                                       v
                               +------------------------+
                               | emit requestWithRetry  |
                               +-------+----------------+
                                       |
                                       v
                                     +---+
+----------------------------------> |try|
|                                    +---+
|                                      |
|                            < retry-after marked? >
|                                      |
|                    +------ no -------+------- yes -------+
|                    |                                     |
|                    v                                     v
|       +-----------------------------+       +-----------------------------+
|       | sleep until backOff         |       | sleep until retry-after +   |
|       |                             |       | jitter                      |
|       +-------------+---------------+       +-------------+---------------+
|                     |                                     |
|                     |-------------------------------------+
|                     v
|            +------------------------+
|            | emit fetchAttemptStart |
|            +----------+-------------+
|                      |
|                      v
|                  +----------------+
|                  | window.fetch() |
|                  +--------+-------+
|                           |
|                 < response received? >
|                           |
|                           v
|                    +- no ------------------ yes ---------+
|                    |                                     |
|               < aborted? >                        < ok response? >
|                    |                                     |
|                    v                                     v
|       +-- no -------- yes ---+                  +- no ------ yes -----------+
|       |                      |                  |                           |
|       v                      v                  v                           v
| +--------------+        +--------------+     +---------------+         +--------------+
| |lastResult =  |        |lastResult =  |     |lastResult =   |         |lastResult =  |
| |network error |        |abort error   |     |response error |         |success       |
| +--------------+        +--------------+     +---------------+         +--------------+
|                                                     |                              |
|                                                     |--set retry-after             |
|                                           < status is retryable? >                 |
|                                                     |                              |
|                           +--------------yes--------+---------no----+              |
|                           |                                         |              |
|                   < was last retry? >                               |              |
|                           |                                         |              |
|               (last try will be true if                             |              |
|                retry count is reached or                            |              |
|                failure count for the service                        |              |
|                reaches retryFailureCutoff)                          |              |
|                           |                                         |              |
|          +--- no ---------+---------- yes ---+                      |              |
|          |                                   |                      |              |
|          v                                   v  v-------------------+              v
|      +-------+                           +------+                                +----+
+----- | retry |                           | fail |                                | ok |
       +-------+                           +------+                                +----+
           |                                   |                                      |     +------------------------+
           +-----------------------------------+->------------------------------------+->-->| Network metrics update |
                                               |                                      |     +------------------------+
                                               v      v-------------------------------+
                                     +--------------------+
                                     | emit fetchComplete |
                                     +--------------------+
                                               |
                                               v
                                           +--------+
                                           | settle |
                                           +--------|
```
