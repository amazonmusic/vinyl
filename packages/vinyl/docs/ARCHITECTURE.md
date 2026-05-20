# Architecture

Amazon Vinyl is an HTML5 playback engine designed for high-performance streaming
of DASH and HLS content. The architecture follows a modular design with clear
separation of concerns, enabling extensibility through dependency injection.

## Core Components

```
                            +-------------+
                            | VinylPlayer |
                            +------+------+
                                   |
                    +--------------+-----------------+
                    |              |                 |
                    v              v                 v
            +---------------+ +----------+   +----------------+
            |TrackController| |Playback  |   |DrmController   |
            |               | |Controller|   |                |
            +-------+-------+ +----+-----+   +-------+--------+
                    |              |                 |
                    v              v                 v
            +---------------+ +-----------+   +-----------+
            | Track         | | Media     |   | EME       |
            | (Dash/Hls)    | | Element   |   | (Browser) |
            |               | | (Browser) |   |           |
            +-------+-------+ +-----------+   +-----------+
                    |   |
                    |   +----------------------+
                    v                          v
            +-------------------+     +----------------+
            |BufferingController|     |SourceBuffer    |
            |                   |     |Controller      |
            +----------+--------+     +--------+-------+
                       |                       |
                       v                       v
            +-------------------+     +----------------+
            |SegmentController  |     |SourceBuffer    |
            |                   |     |(Browser)       |
            +----------+--------+     +----------------+
                       |
                       v
            +-------------------+
            |SegmentProvider    |
            |                   |
            +-------------------+
```

## Component Ownership

### VinylPlayer

Main entry point that orchestrates all streaming components and provides the
public API.

- **Owns**: TrackController, PlaybackController, DrmController
- **Dependencies**: AutoResetController, QualitySelector
- **Role**: Main orchestrator and public API
- **Responsibilities**:
    - Coordinate component lifecycle
    - Expose unified playback interface
    - Handle global error management

### TrackController

Manages the lifecycle of streaming tracks and maintains a playback queue.

- **Owns**: Track instances (e.g. SourceTrack/DashTrack/HlsTrack), Track cache
- **Dependencies**: TrackFactory
- **Role**: Track lifecycle and queue management
- **Responsibilities**:
    - Validate and create tracks
    - Manage playback queue
    - Handle track transitions

### PlaybackController

Controls the HTML5 media element and manages playback state transitions.

- **Owns**: HTML5 Media Element
- **Dependencies**: PlaybackSource
- **Role**: Media element control and state management
- **Responsibilities**:
    - Control play/pause/seek operations
    - Monitor playback state changes
    - Handle media element events

### DrmController

Handles encrypted content by managing DRM licenses and key exchanges.

- **Owns**: License sessions, Key management
- **Dependencies**: EME APIs, License servers
- **Role**: Content decryption and license management
- **Responsibilities**:
    - Handle DRM initialization
    - Manage license requests
    - Process key messages

### Track (DashTrack/HlsTrack)

Protocol-specific implementation that coordinates manifest parsing and media
streaming.

- **Owns**: ManifestController, BufferingController, SegmentController
- **Dependencies**: ManifestProvider, RepresentationProvider
- **Role**: Protocol-specific streaming logic
- **Responsibilities**:
    - Coordinate sub-controllers for manifest resolution and parsing, segment
      fetching, buffering, and encryption
    - Handle protocol-specific features
    - Handle track lifecycle
    - Provide streaming quality and prefetch status and updates

### BufferingController

Manages the MediaSource buffer by coordinating segment appending and buffer
health.

- **Owns**: Segment append queue, Buffer state
- **Dependencies**: SourceBufferController, SegmentController,
  PlaybackController
- **Role**: Media source buffer management
- **Responsibilities**:
    - Coordinate segment appending
    - Handle buffer quotas

### SegmentController

Manages segment caching and prioritization while coordinating with providers for
media locations.

- **Owns**: Segment cache, Priority queue
- **Dependencies**: SegmentProvider, QualitySelector
- **Role**: Segment caching and prioritization
- **Responsibilities**:
    - Prioritize segment requests
    - Manage segment cache

### SegmentProvider

Resolves media segment locations and handles the actual fetching of segment
data.

- **Owns**: Network requests, Segment timeline
- **Dependencies**: ManifestController, NetworkQueue
- **Role**: Media segment resolution and fetching
- **Responsibilities**:
    - Resolve segment URLs from manifest
    - Fetch segment data over network
    - Handle segment-specific transformations

### QualitySelector

Determines optimal playback quality based on network conditions.

- **Owns**: Quality selection algorithm
- **Dependencies**: NetworkMetrics, DeviceCapabilities, BufferHealth
- **Role**: Adaptive bitrate selection
- **Responsibilities**:
    - Monitor network performance
    - Select appropriate quality levels
    - Adapt to changing conditions

### ManifestController

Parses and manages streaming manifests, handling updates and transformations.

- **Owns**: Manifest data, Parser instances
- **Dependencies**: ManifestProvider, ManifestTransformer
- **Role**: Manifest parsing and refresh management
- **Responsibilities**:
    - Load and parse streaming manifests (MPD/M3U8)
    - Handle manifest updates
    - Transform manifest data
