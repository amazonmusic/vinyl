/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Source XSD:
// https://raw.githubusercontent.com/Dash-Industry-Forum/MPEG-Conformance-and-reference-source/master/conformance/MPDValidator/schemas/DASH-MPD.xsd

// ISO/IEC 23009-1:2022

import type { actuateType, Uri, UriType } from '@amazon/vinyl-xml'

import type { ReadonlyDate } from '@amazon/vinyl-util'
import type { ByteRange } from '../../../../../media/byteRange'
import type { Ratio } from '../../../../../media/ratio'
import type { Duration } from '../../../../../duration/duration'
import type { FrameRate } from '../../../../../media/frameRate'

/**
 * Represents an adaptation set in a DASH Media Presentation. An adaptation set groups
 * multiple representations that offer the same content but in different qualities, codecs,
 * or other characteristics, allowing adaptive streaming based on network conditions or user
 * preferences.
 */
export interface AdaptationSetType extends RepresentationBaseType {
    /**
     * The parent Period.
     */
    readonly parent: PeriodType

    /**
     * Specifies the actuation mechanism for this adaptation set, defining how it should be
     * activated or selected.
     */
    readonly actuate: actuateType

    /**
     * Indicates whether bitstream switching is supported, allowing seamless switches between representations
     * without the need for reinitializing the decoder.
     */
    readonly bitstreamSwitching?: boolean

    /**
     * The type of content (e.g., video, audio, text) this adaptation set represents.
     */
    readonly contentType?: string

    /**
     * Specifies the selection priority for the described data structures, i.e. the one described by the containing
     * element. In the absence of other information, higher numbers are the preferred selection to lower numbers.
     */
    readonly selectionPriority: number

    /**
     * A group identifier, indicates a group of AdaptationSet elements that are related in some way.
     * For example, an audio and video adaptation set that should be synchronized can be part of the same group.
     */
    readonly group?: number

    /**
     * An optional URL reference providing additional information or data relevant to this adaptation set.
     */
    readonly href?: string

    /**
     * A unique identifier for this adaptation set within the scope of the DASH manifest.
     */
    readonly id?: number

    /**
     * Specifies the language of the content, using a code as defined by RFC 5646.
     */
    readonly lang?: string

    /**
     * The maximum bandwidth in bits per second of all representations in this adaptation set.
     */
    readonly maxBandwidth?: number

    /**
     * The maximum frame rate of all video representations in this adaptation set.
     */
    readonly maxFrameRate?: FrameRate

    /**
     * The maximum height in pixels of all video representations in this adaptation set.
     */
    readonly maxHeight?: number

    /**
     * The maximum width in pixels of all video representations in this adaptation set.
     */
    readonly maxWidth?: number

    /**
     * The minimum bandwidth in bits per second of all representations in this adaptation set.
     */
    readonly minBandwidth?: number

    /**
     * The minimum frame rate of all video representations in this adaptation set.
     */
    readonly minFrameRate?: FrameRate

    /**
     * The minimum height in pixels of all video representations in this adaptation set.
     */
    readonly minHeight?: number

    /**
     * The minimum width in pixels of all video representations in this adaptation set.
     */
    readonly minWidth?: number

    /**
     * The display aspect ratio (for video representations) within this adaptation set, specifying
     * the width to height ratio of the video.
     */
    readonly par?: Ratio

    /**
     * Specifies if the segments within the representations are aligned, allowing for optimized switching and buffering.
     */
    readonly segmentAlignment: ConditionalUintType

    /**
     * Indicates if subsegments within the representations are aligned, further optimizing switching and buffering
     * efficiencies.
     */
    readonly subsegmentAlignment: ConditionalUintType

    /**
     * Specifies the SAP (Segment Alignment Point) type, indicating the alignment of segment starts with SAPs.
     */
    readonly subsegmentStartsWithSAP: SAPType

    /**
     * Descriptors providing accessibility information, such as captions or sign language interpretations.
     */
    readonly Accessibility?: readonly DescriptorType[]

    /**
     * Base URLs for segment retrieval, providing alternative paths or locations for accessing content.
     */
    readonly BaseURL?: readonly BaseURLType[]

    /**
     * Defines content components within the adaptation set, such as different audio languages or video angles.
     */
    readonly ContentComponent?: readonly ContentComponentType[]

    /**
     * Rating descriptors providing content rating information, which may influence content selection.
     */
    readonly Rating?: readonly DescriptorType[]

    /**
     * The representations available within this adaptation set, offering various qualities or formats of the content.
     */
    readonly Representation?: readonly RepresentationType[]

    /**
     * Role descriptors defining the role or function of the content, such as main, alternative, or supplementary.
     */
    readonly Role?: readonly DescriptorType[]

    /**
     * Specifies segment base information, defining access to media segments using a base URL
     */
    readonly SegmentBase?: SegmentBaseType

    /**
     * Provides a list of media segments, allowing time-based access to content without requiring individual segment
     * URLs.
     */
    readonly SegmentList?: SegmentListType

    /**
     * Defines templates for generating media segment URLs, optimizing manifest size and segment access efficiency.
     */
    readonly SegmentTemplate?: SegmentTemplateType

    /**
     * Viewpoint descriptors providing information about the narrative or visual perspective of the content.
     */
    readonly Viewpoint?: readonly DescriptorType[]
}

/**
 * Extends the basic URI type with properties specific to DASH streaming, offering enhanced control over the
 * availability and access of content.
 *
 * According to ISO_IEC 23009-1_2022 -
 * 5.6.5 Alternative base URLs
 * If alternative base URLs are provided through the BaseURL element at any level, identical Segments shall
 * be accessible at multiple locations. In the absence of other criteria, the DASH Client may use the first
 * BaseURL element as "base URI". The DASH Client may use base URLs provided in the BaseURL element
 * as "base URI" and may implement any suitable algorithm to determine which URLs it uses for requests.
 * If a BaseURL element containing an absolute URL is present on any level, it overwrites any BaseURL
 * information present on a higher level.
 */
export interface BaseURLType extends UriType {
    /**
     * Indicates whether the content pointed to by this BaseURL is completely available at the time of the request.
     */
    readonly availabilityTimeComplete?: boolean

    /**
     * Specifies a time offset, in seconds, that should be considered for the content's availability start time.
     *
     * If the value is present in SegmentBase then this attribute is additive to the one in SegmentBase.
     */
    readonly availabilityTimeOffset?: number

    /**
     * If present, specifies HTTP partial GET requests may alternatively be issued by adding the byte range into a
     * regular HTTP-URL based on the value of this attribute and the construction rules in E.2. If not present, HTTP
     * partial GET requests may not be converted into regular GET requests.
     *
     * Substitution tokens:
     * $$ - escape sequence for $
     * $base$ - The identifier shall be substituted by the scheme of the original URL.
     * $query$ - The identifier shall be substituted by the query part of the original URL.
     * $first$ - The identifier shall be substituted by the byte offset of the first byte in a range.
     * $last$ The identifier is substituted by the byte offset of the last byte in the range.
     *
     * **Not supported** - No clients are currently supported that do not support range requests.
     */
    readonly byteRange?: string

    /**
     * This attribute specifies a relationship between Base URLs such that BaseURL elements with the
     * same `serviceLocation` value are likely to have their URLs resolve to services at a common network location, for
     * example a common Content Delivery Network. If not present, no relationship to any other Base URL is known.
     */
    readonly serviceLocation?: string
}

/**
 * Allows for a value to be either a boolean or a number, offering flexibility in defining conditional or
 * quantitative properties.
 */
export type ConditionalUintType = boolean | number

/**
 * Describes a component of the content, such as audio or video track, including optional identifiers and
 * descriptors for accessibility, rating, role, and viewpoint.
 */
export interface ContentComponentType {
    /**
     * The MIME type of the content component (e.g., video/mp4).
     */
    readonly contentType?: string

    /**
     * A unique identifier for this component.
     */
    readonly id?: number

    /**
     * The language of the content component, using BCP 47 language tags.
     */
    readonly lang?: string

    /**
     * The aspect ratio of the video component, if applicable.
     */
    readonly par?: Ratio

    /**
     * Descriptors to provide accessibility information about the content component.
     */
    readonly Accessibility?: readonly DescriptorType[]

    /**
     * Descriptors to provide rating information about the content component.
     */
    readonly Rating?: readonly DescriptorType[]

    /**
     * Descriptors to define the role of the content component within the presentation.
     */
    readonly Role?: readonly DescriptorType[]

    /**
     * Descriptors to provide viewpoint information, enhancing the descriptive richness of the content component.
     */
    readonly Viewpoint?: readonly DescriptorType[]
}

/**
 * A generic descriptor type that defines additional information about a content or component, specified by an ID, a
 * scheme, and an optional value.
 */
export interface DescriptorType {
    /**
     * An optional unique identifier for the descriptor.
     */
    readonly id?: string

    /**
     * The URI identifying the scheme or namespace of the descriptor.
     */
    readonly schemeIdUri: Uri

    /**
     * An optional value associated with the descriptor, whose interpretation depends on the scheme.
     */
    readonly value?: string
}

/**
 * Represents an event stream, potentially external, associated with a DASH presentation, including timing and
 * scheme information.
 */
export interface EventStreamType {
    /**
     * Specifies the condition under which the related URL (defined by `href`)
     * is actuated.
     */
    readonly actuate: actuateType

    /**
     * A URL referencing additional information or an external event stream.
     */
    readonly href?: string

    /**
     * An optional URI pointing to message data associated with the event stream.
     */
    readonly messageData?: Uri

    /**
     * The URI identifying the scheme or namespace of the event stream.
     */
    readonly schemeIdUri: Uri

    /**
     * The timescale in units per second used for timing properties within the event stream.
     */
    readonly timescale?: number

    /**
     * An optional value associated with the event stream, whose interpretation depends on the scheme.
     */
    readonly value?: string

    /**
     * An array of events, each with its own timing, duration, and optional message data.
     */
    readonly Event?: readonly EventType[]
}

/**
 * Defines a single event within an EventStream, including its timing, duration, and optional message data.
 */
export interface EventType {
    /**
     * The duration of the event, in timescale units.
     */
    readonly duration?: number

    /**
     * A unique identifier for the event.
     */
    readonly id?: number

    /**
     * An optional string containing message data associated with the event.
     */
    readonly messageData?: string

    /**
     * The presentation time of the event, in timescale units, relative to the start of the presentation.
     */
    readonly presentationTime: number
}

/**
 * Defines a structure for specifying metrics related to the consumption or delivery of media content. This includes
 * identifying the type of metrics being collected, the time ranges for which these metrics apply, and the reporting
 * mechanisms or descriptors that detail how and where these metrics should be reported.
 */
export interface MetricsType {
    /**
     * A string identifier for the type of metrics being described. This could represent various aspects of media
     * consumption or delivery, such as buffering events, playback errors, or network throughput measurements,
     * providing a flexible way to categorize and manage different sets of metrics.
     */
    readonly metrics: string

    /**
     * An optional array of `RangeType` objects, each specifying a time range for which the described metrics are
     * relevant. This allows for the association of metrics with specific segments of the content, enabling detailed
     * analysis and reporting of performance or consumption patterns over the duration of the media presentation.
     */
    readonly Range?: readonly RangeType[]

    /**
     * An array of `DescriptorType` objects, specifying how and where the metrics should be reported.
     */
    readonly Reporting: readonly DescriptorType[]
}

/**
 * Represents a Media Presentation Description (MPD) object for DASH (Dynamic Adaptive Streaming over HTTP).
 * This object contains information about the multimedia content, such as its availability, duration, and structure.
 */
export interface MPDtype {
    /**
     * The end time after which the media presentation is no longer available for consumption.
     */
    readonly availabilityEndTime?: ReadonlyDate

    /**
     * The start time from which the media presentation is available for consumption.
     */
    readonly availabilityStartTime?: ReadonlyDate

    /**
     * A unique identifier for the media presentation.
     */
    readonly id?: string

    /**
     * The maximum duration of any media segment in the presentation.
     */
    readonly maxSegmentDuration?: Duration

    /**
     * The maximum duration of any sub-segment in the presentation.
     */
    readonly maxSubsegmentDuration?: Duration

    /**
     * The total duration of the media presentation.
     */
    readonly mediaPresentationDuration?: Duration

    /**
     * The minimum duration of the buffer that a client should maintain for uninterrupted playback.
     */
    readonly minBufferTime: Duration

    /**
     * The minimum period between potential updates to the MPD.
     */
    readonly minimumUpdatePeriod?: Duration

    /**
     * The DASH profiles to which this presentation conforms.
     */
    readonly profiles: readonly string[]

    /**
     * The time at which the MPD was last published or updated.
     */
    readonly publishTime?: ReadonlyDate

    /**
     * The suggested delay of the presentation time from the live edge for live presentations.
     */
    readonly suggestedPresentationDelay?: Duration

    /**
     * The depth of the time-shift buffer for live presentations, allowing clients to access past segments.
     */
    readonly timeShiftBufferDepth?: Duration

    /**
     * The type of presentation, either 'static' or 'dynamic' (live).
     */
    readonly type?: PresentationType

    /**
     * The base URL(s) that can be used to construct the URLs for the segments.
     */
    readonly BaseURL?: readonly BaseURLType[]

    /**
     * Properties that are considered essential for the presentation. If not understood, the presentation should not be
     * played.
     */
    readonly EssentialProperty?: readonly DescriptorType[]

    /**
     * The location(s) of more information or alternate MPD files.
     */
    readonly Location?: readonly UriType[]

    /**
     * Metrics about the presentation or its usage for reporting.
     */
    readonly Metrics?: readonly MetricsType[]

    /**
     * The periods of the presentation, representing a sequence of playable segments.
     */
    readonly Period: readonly PeriodType[]

    /**
     * Information about the program, such as title, language, and more.
     */
    readonly ProgramInformation?: readonly ProgramInformationType[]

    /**
     * Supplemental properties that provide additional information about the presentation.
     */
    readonly SupplementalProperty?: readonly DescriptorType[]

    /**
     * Information for synchronizing the presentation's timeline to real-world time.
     */
    readonly UTCTiming?: readonly DescriptorType[]
}

/**
 * Extends `SegmentBaseType` to support scenarios involving multiple segments within a media presentation, such as
 * adaptive streaming. This type incorporates properties that describe the overall structure and sequencing of the
 * segments, providing essential information for efficient content delivery and playback.
 */
export interface MultipleSegmentBaseType extends SegmentBaseType {
    /**
     * The duration of each segment within the sequence, specified in the timescale units.
     */
    readonly duration?: number

    /**
     * The number of the first segment in the sequence.
     */
    readonly startNumber?: number

    /**
     * An optional URL pointing to a bitstream switching segment. This segment contains data that enables the
     * decoder to seamlessly switch between different bitrates or representations without the need for a full
     * reinitialization. Using this property can significantly improve the user experience in adaptive streaming
     * scenarios by reducing the latency and buffering times associated with bitrate switches.
     */
    readonly BitstreamSwitching?: URLType

    /**
     * An optional `SegmentTimeline` that provides a detailed breakdown of the segments' timing and duration within
     * the content.
     */
    readonly SegmentTimeline?: SegmentTimelineType
}

/**
 * Represents a single period within an MPD, defining a specific portion of the content with its own set of
 * adaptation sets and resources.
 */
export interface PeriodType {
    /**
     * The parent MPD.
     */
    readonly parent: MPDtype

    /**
     * Specifies the condition under which the related URL (defined by the `href` property) is actuated.
     * May be 'onLoad' or 'onRequest'
     */
    readonly actuate: actuateType

    /**
     * Indicates whether bitstream switching is supported within the period. This allows seamless switches between
     * different bitrates without needing a new initialization segment for the new bitrate stream.
     */
    readonly bitstreamSwitching: boolean

    /**
     * The duration of the period, in seconds.
     */
    readonly duration?: Duration

    /**
     * A URL referencing additional information or an external adaptation set that should be considered part of
     * this period.
     */
    readonly href?: string

    /**
     * A unique identifier for this period.
     */
    readonly id?: string

    /**
     * The start time of this period, in seconds relative to the beginning of the presentation.
     */
    readonly start?: Duration

    /**
     * The adaptation sets within this period. Each adaptation set represents a group of interchangeable
     * representations.
     */
    readonly AdaptationSet?: readonly AdaptationSetType[]

    /**
     * An identifier for the content assets within this period.
     */
    readonly AssetIdentifier?: DescriptorType

    /**
     * The base URL(s) for this period, which can be used to resolve relative URLs within this period.
     */
    readonly BaseURL?: readonly BaseURLType[]

    /**
     * Event streams associated with this period for signaling in-band events, such as SCTE-35 markers.
     */
    readonly EventStream?: readonly EventStreamType[]

    /**
     * Segment base information, specifying the default base URL and byte range for the media segments within this
     * period.
     */
    readonly SegmentBase?: SegmentBaseType

    /**
     * A list of media segments available within this period, typically used for presentations without live-streaming.
     */
    readonly SegmentList?: SegmentListType

    /**
     * Template information for generating media segment URLs within this period.
     */
    readonly SegmentTemplate?: SegmentTemplateType

    /**
     * Subsets of adaptation sets, allowing for more complex grouping of representations.
     */
    readonly Subset?: readonly SubsetType[]

    /**
     * Supplemental properties for this period, providing additional descriptors that may enhance the presentation
     * or setup.
     */
    readonly SupplementalProperty?: readonly DescriptorType[]
}

export type PresentationType = 'static' | 'dynamic'

/**
 * Provides metadata about the program or content represented in a DASH Media Presentation Description (MPD) or
 * similar context. This includes information such as the language, title, and copyrights.
 */
export interface ProgramInformationType {
    /**
     * The language of the program information, represented as a BCP 47 language tag.
     */
    readonly lang?: string

    /**
     * A URL pointing to a web page that provides more information about the program.
     */
    readonly moreInformationURL?: Uri

    /**
     * Copyright notice for the content or program.
     */
    readonly Copyright?: string

    /**
     * The source of the content or program, potentially including the content creator or distributor.
     */
    readonly Source?: string

    /**
     * The title of the content or program.
     */
    readonly Title?: string
}

/**
 * Represents a time range within media content, specifying the duration and/or start time of a segment or period.
 * This is particularly useful in scenarios where specific sections of content are being referenced or manipulated.
 */
export interface RangeType {
    /**
     * The duration of the range, in seconds.
     */
    readonly duration?: Duration

    /**
     * The start time of the range, in seconds relative to the beginning of the content or an enclosing period.
     * This enables precise referencing of content segments.
     */
    readonly starttime?: Duration
}

/**
 * Defines the base attributes common to all representation types within a DASH Media Presentation.
 */
export interface RepresentationBaseType {
    /**
     * Audio sampling rate(s) in samples per second.
     * An array of either one or two decimal integer values. If there are two elements this represents a minimum and
     * maximum sampling rate of the audio media.
     */
    readonly audioSamplingRate?: readonly number[]

    /**
     * Optional string specifying the codec(s) used for this representation. The format follows the RFC 6381 codec
     * string format.
     */
    readonly codecs?: string

    /**
     * Indicates whether the coding of media frames within the representation depends on other frames. A value of
     * true means there is a dependency, which affects adaptation logic.
     */
    readonly codingDependency?: boolean

    /**
     * Frame rate for video representations, specified either as a ratio of integers, e.g. [30000, 1001]
     */
    readonly frameRate?: FrameRate

    /**
     * Height of the video in pixels for video representations.
     */
    readonly height?: number

    /**
     * The maximum Segment Access Point (SAP) period in seconds. It indicates the maximum distance in playback time
     * between random access points, aiding in efficient seeking and buffering strategies.
     */
    readonly maximumSAPPeriod?: number

    /**
     * Maximum playout rate, indicating the maximum speed at which the representation can be played without
     * affecting normal audio pitch and video appearance.
     */
    readonly maxPlayoutRate?: number

    /**
     * MIME type of the representation, indicating the media type and potentially the codec information.
     */
    readonly mimeType?: string

    /**
     * An array of profile identifiers indicating compliance with specific codec profiles, facilitating
     * compatibility and quality assurance across devices and players.
     */
    readonly profiles?: readonly string[]

    /**
     * Sample aspect ratio for video representations, specifying the aspect ratio of the pixels themselves.
     */
    readonly sar?: Ratio

    /**
     * Scan type for video content, indicating whether the video is progressive or interlaced.
     */
    readonly scanType?: VideoScanType

    /**
     * Optional segment profiles supported by the representation, further defining the
     * characteristics of the segments within the representation.
     */
    readonly segmentProfiles?: string

    /**
     * Indicates the type of Stream Access Points (SAP) that the segments start with.
     */
    readonly startWithSAP?: SAPType

    /**
     * Optional width of the video in pixels for video representations.
     */
    readonly width?: number

    /**
     * Descriptors for audio channel configurations, providing detailed information about the audio channels
     * included in the representation.
     */
    readonly AudioChannelConfiguration?: readonly DescriptorType[]

    /**
     * Descriptors for content protection schemes applied to the representation, facilitating
     * the implementation of DRM and other content protection mechanisms.
     */
    readonly ContentProtection?: readonly DescriptorType[]

    /**
     * Descriptors for essential properties of the representation that are not defined by
     * other attributes or elements in the DASH manifest.
     */
    readonly EssentialProperty?: readonly DescriptorType[]

    /**
     * Descriptors for frame packing arrangements in video representations, relevant for
     * stereoscopic 3D content.
     */
    readonly FramePacking?: readonly DescriptorType[]

    /**
     * Array of in-band event streams, specifying events such as subtitles or metadata that
     * are embedded within the media content of the representation.
     */
    readonly InbandEventStream?: readonly EventStreamType[]

    /**
     * Descriptors for supplemental properties of the representation, providing additional
     * information that may enhance playback or presentation.
     */
    readonly SupplementalProperty?: readonly DescriptorType[]

    /**
     * Descriptors for switching information, indicating conditions or recommendations for
     * switching from this representation to another.
     */
    readonly Switching?: readonly SwitchingType[]
}

/**
 * Represents a single representation within a DASH Media Presentation. Representations are
 * versions of an adaptation set that differ in quality, bitrate, or other characteristics.
 */
export interface RepresentationType extends RepresentationBaseType {
    /**
     * The parent Adaptation Set.
     */
    readonly parent: AdaptationSetType

    /**
     * The average bandwidth in bits per second required for playing this representation.
     */
    readonly bandwidth: number

    /**
     * Specifies the bitrate of the representation, in bits per second.
     */
    readonly bitrate?: number

    /**
     * Optional identifiers for other representations that this representation depends on.
     * Dependency is typically used for representations that cannot be decoded independently,
     * such as enhanced layers in scalable video coding.
     */
    readonly dependencyId?: StringVectorType

    /**
     * A unique identifier for this representation within the scope of its adaptation set.
     */
    readonly id: string

    /**
     * Optional identifiers for media stream structure elements, such as segments, that this
     * representation is associated with.
     */
    readonly mediaStreamStructureId?: StringVectorType

    /**
     * Specifies a quality ranking of the Representation relative to other Representations in the same Adaptation
     * Set. Lower values represent higher quality
     */
    readonly qualityRanking?: number

    /**
     * An array of BaseURL elements that specify base URLs for segment fetching. BaseURLs can
     * provide alternative locations or addressable paths for accessing media segments.
     */
    readonly BaseURL?: readonly BaseURLType[]

    /**
     * An optional SegmentBase element that specifies how to access media segments for this
     * representation using a single URL and optional byte range.
     */
    readonly SegmentBase?: SegmentBaseType

    /**
     * An optional SegmentList element that provides a list of media segments through URLs and
     * duration information, allowing for time-based access to segments.
     */
    readonly SegmentList?: SegmentListType

    /**
     * An optional SegmentTemplate element that specifies how to generate segment URLs using
     * template patterns, enabling efficient access to segments without needing an explicit list.
     */
    readonly SegmentTemplate?: SegmentTemplateType

    /**
     * An optional array of SubRepresentation elements, which are subsets of this representation
     * that may differ in certain characteristics like bitrate or resolution to support more
     * granular adaptation.
     */
    readonly SubRepresentation?: readonly SubRepresentationType[]
}

/**
 * Must be between 0 and 6.
 */
export type SAPType = number

/**
 * Defines base properties for a segment within a media presentation, which are applicable to single segments.
 */
export interface SegmentBaseType {
    /**
     * Indicates whether the availability time for the segment is complete.
     */
    readonly availabilityTimeComplete?: boolean

    /**
     * Specifies a time offset, in seconds, from the availability start time of the content.
     */
    readonly availabilityTimeOffset?: number

    /**
     * Specifies the byte range for the segment index within the media file, if applicable.
     */
    readonly indexRange?: ByteRange

    /**
     * Indicates whether the `indexRange` is exact, providing precise byte range information for segment indexing.
     */
    readonly indexRangeExact: boolean

    /**
     * Specifies a presentation time offset in the media timeline relative to the start of the Period, in timescale
     * units, used to adjust the timing of media presentation.
     */
    readonly presentationTimeOffset?: number

    /**
     * The timescale in units per second used for timing properties within the segment.
     */
    readonly timescale?: number

    /**
     * The URL to the initialization segment required for decoding the media segments.
     */
    readonly Initialization?: URLType

    /**
     * The URL to the segment index providing information about segment locations within the media stream.
     */
    readonly RepresentationIndex?: URLType
}

/**
 * Extends `MultipleSegmentBaseType` with additional properties specific to lists of segments.
 */
export interface SegmentListType extends MultipleSegmentBaseType {
    /**
     * Specifies the condition under which the related URL (defined by the `href` property) is actuated.
     */
    readonly actuate: actuateType

    /**
     * A URL referencing additional information or an external segment list that should be considered part of this
     * presentation.
     */
    readonly href?: string

    /**
     * An array of URLs for the individual segments available within the list.
     */
    readonly SegmentURL?: readonly SegmentURLType[]
}

/**
 * Extends `MultipleSegmentBaseType` with template properties for generating segment URLs.
 */
export interface SegmentTemplateType extends MultipleSegmentBaseType {
    /**
     * A template for bitstream switching segment URLs, if bitstream switching is supported.
     */
    readonly bitstreamSwitching?: string

    /**
     * A template for generating segment index URLs.
     */
    readonly index?: string

    /**
     * A template for generating initialization segment URLs.
     */
    readonly initialization?: string

    /**
     * A template for generating media segment URLs.
     */
    readonly media?: string
}

/**
 * Defines a timeline of segments.
 */
export interface SegmentTimelineType {
    /**
     * An array of timeline segments, each specifying duration and repeat count.
     */
    readonly S?: readonly SegmentTimelineTypeSType[]
}

/**
 * Represents a single timeline segment in a DASH presentation's segment timeline.
 */
export interface SegmentTimelineTypeSType {
    /**
     * The duration of the segment, in timescale units.
     */
    readonly d: number

    /**
     * The sequence number of the segment, optional and used if segments are numbered.
     */
    readonly n?: number

    /**
     * The repeat count for the segment.
     * This value is zero-based (e.g. a value of three means four Segments in the contiguous series.)
     */
    readonly r: number

    /**
     * The start time of the segment, in timescale units.
     */
    readonly t?: number
}

/**
 * Represents a URL reference to a media segment, including optional range information for byte-serving.
 */
export interface SegmentURLType {
    /**
     * The URL to the index of the segment, if separate from the media URL.
     */
    readonly index?: Uri

    /**
     * The byte range of the index within the media file, if applicable.
     */
    readonly indexRange?: ByteRange

    /**
     * The URL to the media segment itself.
     */
    readonly media?: Uri

    /**
     * The byte range of the media within the media file, allowing for partial retrieval.
     */
    readonly mediaRange?: ByteRange
}

export type StringVectorType = readonly string[]

/**
 * Extends `RepresentationBaseType` to define a sub-representation, which is a subset of a representation often used
 * for adaptive streaming. This includes details like bandwidth and dependencies on other components or levels
 * within the content hierarchy.
 */
export interface SubRepresentationType extends RepresentationBaseType {
    /**
     * The bandwidth requirement for this sub-representation, specified in bits per second. This indicates the
     * network throughput needed to consume this content without interruptions.
     */
    readonly bandwidth?: number

    /**
     * Identifies the content components associated with this sub-representation, expressed as a vector of strings.
     * Each string in the vector represents a content component ID, allowing this sub-representation to be associated
     * with specific audio, video, or other types of media streams within the content.
     */
    readonly contentComponent?: StringVectorType

    /**
     * A vector of unsigned integers specifying the levels of dependency this sub-representation has on other
     * representations. Each number in the vector refers to a level in the content hierarchy, indicating this
     * sub-representation relies on components or data at those specified levels for proper playback or functionality.
     */
    readonly dependencyLevel?: UIntVectorType

    /**
     * An optional level indicator for this sub-representation, which could denote a quality level, spatial layer,
     * or other hierarchical level within a multi-layered or scalable content structure. This helps in adaptive
     * streaming decisions and content selection based on capabilities or preferences.
     */
    readonly level?: number
}

export interface SubsetType {
    readonly contains: UIntVectorType
    readonly id?: string
}

export interface SwitchingType {
    readonly interval: number
    readonly type?: SwitchingTypeType
}

export type SwitchingTypeType = 'media' | 'bitstream'

export type UIntVectorType = readonly number[]

export interface URLType {
    readonly range?: ByteRange
    readonly sourceURL?: Uri
}

export type VideoScanType = 'progressive' | 'interlaced' | 'unknown'

export interface DashManifest {
    readonly MPD: MPDtype
}
