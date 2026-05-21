# Amazon Vinyl

Amazon Vinyl is an HTML5 playback engine for Dash and HLS streaming. It features
high stability, performance, bundle size, compatibility, and standards
compliance.

## Performance

Amazon Vinyl is designed with a strong focus on performance, leveraging advanced
techniques to deliver a seamless user experience. It supports network
prioritization, ensuring that critical data is delivered first for uninterrupted
playback. Just-in-time buffering allows Amazon Vinyl to efficiently manage
resources by decoding data only when needed, minimizing delays. The custom
sub-millisecond SAX DASH parser enables lightning-fast processing of media
streams, further reducing initial playback delay. Additionally, Amazon Vinyl’s
track preloading feature allows applications to anticipate user actions, loading
tracks in advance to eliminate any lag or buffering during transitions,
resulting in smooth, responsive audio playback.

## Footprint

Amazon Vinyl takes an opinionated, zero-runtime-dependency stance. By shedding
any dependent frameworks or libraries, Amazon Vinyl bundles at 200 KiB (75 KiB
gzipped), making it 50-90% smaller than alternatives, which improves
performance, compatibility, and project longevity. Provided configuration can be
tuned to optimize for low-memory or variable network-devices.

## Premium Quality

Amazon Vinyl supports ultra-high-definition audio for exceptional sound quality
even on devices with limited memory resources. It achieves this by efficiently
managing data, allowing it to work within small source buffer quotas. This means
that, despite the high demands of processing detailed audio files, the engine
can still deliver crystal-clear sound without overwhelming the device's memory,
making high-fidelity audio accessible to a broader range of devices.

## Compatibility

To ensure high compatibility across various devices and browsers, integration
tests are run on BrowserStack, a cloud-based testing platform. This allows
developers to simulate real-world conditions by testing the application on
multiple operating systems, browsers, and devices. By identifying and fixing
issues in this diverse environment, the platform guarantees that the application
works seamlessly for all users, regardless of their chosen device or browser,
leading to a more reliable and consistent user experience.

Amazon Vinyl NPM bundles contain ES5 and ES6 versions, compatible across 99.9%
of browsers.

Amazon Vinyl currently supports Widevine (Chrome/Firefox), FairPlay (all iOS
browsers, or Safari macOS), and PlayReady (Edge).

| Browser                 | Support             |
| ----------------------- | ------------------- |
| Google Chrome           | v52+                |
| Mozilla Firefox         | v52+                |
| Safari                  | HLS v11+, Dash v17+ |
| Microsoft Edge          | v18+                |
| Chromium (Opera, Brave) | v52+                |

Amazon Vinyl supports Dash and HLS (fMP4) streaming via MSE on all browsers
listed above. Native HLS via FairPlay is supported on Safari and iOS.

# Extensibility

Extensibility is a key feature of the system, achieved through the use of
dependency injection and support for adding custom track types. Dependency
injection allows developers to easily swap out components or services, making
the system more flexible and adaptable to different needs. Additionally, the
ability to add custom track types enables developers to extend the functionality
of the playback engine, allowing it to support new service providers, audio
formats or specialized processing workflows.

# Getting Started

For installation instructions and detailed API documentation, please refer to
the [USAGE.md](./packages/vinyl/docs/USAGE.md) guide.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more
information.

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md) for more information.

## License

This project is licensed under the Apache-2.0 License.
