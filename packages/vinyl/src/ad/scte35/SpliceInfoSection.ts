/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The SCTE-35 model: a decoded `splice_info_section`, the cue message that
 * signals ad avails in both MPEG-TS and, carried as text or base64, in HLS
 * `EXT-X-DATERANGE` SCTE35 attributes and DASH MPD events (SCTE 214).
 *
 * Times and durations are in 90 kHz ticks, as in the binary syntax. Use
 * {@link scte35TicksToSeconds} to convert.
 *
 * @see https://www.scte.org/standards/library/catalog/scte-35-digital-program-insertion-cueing-message/
 *
 * @module
 */

/**
 * The SCTE-35 clock rate: splice times and durations are in 90 kHz ticks.
 */
export const SCTE35_TICKS_PER_SECOND = 90000

/**
 * Converts SCTE-35 90 kHz ticks to seconds.
 */
export function scte35TicksToSeconds(ticks: number): number {
    return ticks / SCTE35_TICKS_PER_SECOND
}

/**
 * A decoded SCTE-35 `splice_info_section`.
 */
export interface SpliceInfoSection {
    /**
     * Ticks added to every splice time in this section (`pts_adjustment`).
     */
    readonly ptsAdjustment: number

    /**
     * The 12-bit authorization tier (`tier`); 0xFFF when unused.
     */
    readonly tier: number

    /**
     * True when the command and descriptors are encrypted. An encrypted
     * section's command decodes as {@link UnknownSpliceCommand} and its
     * descriptors are empty.
     */
    readonly encrypted: boolean

    /**
     * The splice command.
     */
    readonly command: SpliceCommand

    /**
     * The splice descriptors, in signalled order.
     */
    readonly descriptors: readonly SpliceDescriptor[]
}

export type SpliceCommand =
    | SpliceNullCommand
    | SpliceInsertCommand
    | TimeSignalCommand
    | UnknownSpliceCommand

/**
 * `splice_null()` (command type 0x00), a heartbeat.
 */
export interface SpliceNullCommand {
    readonly type: 'spliceNull'
}

/**
 * `splice_insert()` (command type 0x05): signals a splice out of (into an
 * avail) or back into the network feed.
 */
export interface SpliceInsertCommand {
    readonly type: 'spliceInsert'

    /** `splice_event_id`, shared by the out and in splice of one avail. */
    readonly spliceEventId: number

    /** True when a previously sent event with this id is cancelled. */
    readonly cancel: boolean

    /**
     * True for a splice out of the network (the start of an avail), false for
     * the return to the network (the end of an avail).
     */
    readonly outOfNetwork: boolean

    /**
     * True when the splice happens immediately rather than at
     * {@link spliceTime}.
     */
    readonly spliceImmediate: boolean

    /**
     * The splice time in ticks, before {@link SpliceInfoSection.ptsAdjustment},
     * or null when immediate or unspecified. For a component splice this is the
     * first component's time.
     */
    readonly spliceTime: number | null

    /** The avail's duration, or null when not signalled. */
    readonly breakDuration: BreakDuration | null

    /** `unique_program_id`. */
    readonly uniqueProgramId: number

    /** `avail_num`, the avail's position within {@link availsExpected}. */
    readonly availNum: number

    /** `avails_expected`. */
    readonly availsExpected: number
}

/**
 * `break_duration()`.
 */
export interface BreakDuration {
    /**
     * True when the splicer returns to the network on its own when the
     * duration elapses; false when a return splice will be signalled.
     */
    readonly autoReturn: boolean

    /** The duration in ticks. */
    readonly duration: number
}

/**
 * `time_signal()` (command type 0x06): a time, given meaning by the section's
 * descriptors (typically {@link SegmentationDescriptor}s).
 */
export interface TimeSignalCommand {
    readonly type: 'timeSignal'

    /**
     * The signalled time in ticks, before
     * {@link SpliceInfoSection.ptsAdjustment}, or null when unspecified.
     */
    readonly spliceTime: number | null
}

/**
 * A command that is not decoded (`splice_schedule`, `bandwidth_reservation`,
 * `private_command`, or an encrypted command).
 */
export interface UnknownSpliceCommand {
    readonly type: 'unknown'

    /** The `splice_command_type`. */
    readonly commandType: number
}

export type SpliceDescriptor = SegmentationDescriptor | UnknownSpliceDescriptor

/**
 * `segmentation_descriptor()` (tag 0x02): describes the segment that starts
 * or ends at the section's time, such as a provider or distributor placement
 * opportunity.
 */
export interface SegmentationDescriptor {
    readonly type: 'segmentation'

    /**
     * `segmentation_event_id`, shared by the start and end descriptors of one
     * segment.
     */
    readonly segmentationEventId: number

    /** True when a previously sent event with this id is cancelled. */
    readonly cancel: boolean

    /** `segmentation_duration` in ticks, or null when not signalled. */
    readonly segmentationDuration: number | null

    /** `segmentation_upid_type`, e.g. 0x0C for MPU or 0x0E for ADS info. */
    readonly upidType: number

    /** The raw `segmentation_upid` bytes. */
    readonly upid: Uint8Array

    /** `segmentation_type_id`, see {@link SegmentationType}. */
    readonly segmentationTypeId: number

    /** `segment_num`. */
    readonly segmentNum: number

    /** `segments_expected`. */
    readonly segmentsExpected: number
}

/**
 * A descriptor that is not decoded (`avail_descriptor`, `DTMF_descriptor`,
 * `time_descriptor`, or private descriptors).
 */
export interface UnknownSpliceDescriptor {
    readonly type: 'unknown'

    /** The `splice_descriptor_tag`. */
    readonly tag: number

    /** The 32-bit descriptor identifier, 0x43554549 ('CUEI') for SCTE. */
    readonly identifier: number
}

/**
 * The `segmentation_type_id` values that delimit ad avails.
 */
export const SegmentationType = {
    BREAK_START: 0x22,
    BREAK_END: 0x23,
    PROVIDER_ADVERTISEMENT_START: 0x30,
    PROVIDER_ADVERTISEMENT_END: 0x31,
    DISTRIBUTOR_ADVERTISEMENT_START: 0x32,
    DISTRIBUTOR_ADVERTISEMENT_END: 0x33,
    PROVIDER_PLACEMENT_OPPORTUNITY_START: 0x34,
    PROVIDER_PLACEMENT_OPPORTUNITY_END: 0x35,
    DISTRIBUTOR_PLACEMENT_OPPORTUNITY_START: 0x36,
    DISTRIBUTOR_PLACEMENT_OPPORTUNITY_END: 0x37,
    PROVIDER_AD_BLOCK_START: 0x44,
    PROVIDER_AD_BLOCK_END: 0x45,
    DISTRIBUTOR_AD_BLOCK_START: 0x46,
    DISTRIBUTOR_AD_BLOCK_END: 0x47,
} as const

// Break, advertisement, placement opportunity, and ad block starts; each end
// type is its start type + 1.
const AVAIL_START_TYPES: ReadonlySet<number> = new Set([
    0x22, 0x30, 0x32, 0x34, 0x36, 0x44, 0x46,
])

const AVAIL_END_TYPES: ReadonlySet<number> = new Set([
    0x23, 0x31, 0x33, 0x35, 0x37, 0x45, 0x47,
])

/**
 * The avail a section signals: whether it opens (`out`) or closes (`in`) an
 * avail, the avail's event id, and its duration in ticks when known.
 */
export interface SpliceAvail {
    readonly direction: 'out' | 'in'

    /**
     * The `splice_event_id` or `segmentation_event_id`. The `out` and `in`
     * signals of one avail share it.
     */
    readonly eventId: number

    /**
     * The splice time in ticks, including the section's pts adjustment, or
     * null when immediate or unspecified.
     */
    readonly time: number | null

    /** The avail duration in ticks, or null when not signalled. */
    readonly duration: number | null
}

/**
 * Interprets a section as the start or end of an ad avail, or returns null
 * when it does not delimit one (e.g. a heartbeat, a cancellation, or a
 * segmentation type that is not advertising).
 *
 * A `splice_insert` delimits an avail by its `out_of_network_indicator`. A
 * `time_signal` delimits one by the first segmentation descriptor whose type
 * is a break, advertisement, placement opportunity, or ad block start or end.
 */
export function getSpliceAvail(section: SpliceInfoSection): SpliceAvail | null {
    const { command } = section
    const adjust = (time: number | null) =>
        time == null ? null : (time + section.ptsAdjustment) % 2 ** 33
    if (command.type === 'spliceInsert') {
        if (command.cancel) return null
        return {
            direction: command.outOfNetwork ? 'out' : 'in',
            eventId: command.spliceEventId,
            time: adjust(command.spliceTime),
            duration: command.breakDuration?.duration ?? null,
        }
    }
    if (command.type === 'timeSignal') {
        for (const descriptor of section.descriptors) {
            if (descriptor.type !== 'segmentation' || descriptor.cancel)
                continue
            const isStart = AVAIL_START_TYPES.has(descriptor.segmentationTypeId)
            if (!isStart && !AVAIL_END_TYPES.has(descriptor.segmentationTypeId))
                continue
            return {
                direction: isStart ? 'out' : 'in',
                eventId: descriptor.segmentationEventId,
                time: adjust(command.spliceTime),
                duration: descriptor.segmentationDuration,
            }
        }
    }
    return null
}
