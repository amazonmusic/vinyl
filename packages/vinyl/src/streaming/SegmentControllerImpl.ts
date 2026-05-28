/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Mutable, Unsubscribe } from '@amazon/vinyl-util'
import {
    Abort,
    clone,
    closeTo,
    createDisposer,
    EventHostImpl,
    getNetworkState,
    getOrSet,
    isSilentError,
    logDebug,
    logError,
    noop,
    type Range,
    rangeIntersects,
    RangesImpl,
    type ReadonlyAbort,
    type ReadonlyRanges,
    throttle,
    withAbort,
} from '@amazon/vinyl-util'
import type { ReadonlyPlaybackController } from '../playback/ReadonlyPlaybackController'
import {
    type PrefetchOptions,
    SEGMENT_START_AFFORDANCE,
    type SegmentController,
    type SegmentControllerEventMap,
} from './SegmentController'
import {
    type SegmentDataProvider,
    SegmentDataSlot,
    SegmentStatus,
} from './SegmentDataSlot'
import {
    defaultTrackPriority,
    enqueueSegmentPrefetch,
    immediatePrefetchPriority,
    type SegmentPrefetchPriority,
} from './SegmentPrefetch'
import {
    getSegmentAtTime,
    getSegmentInsertionIndexAtTime,
} from './util/segment'
import type { SegmentReference } from './SegmentReference'
import type { ContentType, MediaQualityMetadata } from './MediaQualityMetadata'
import type { ObservableValue } from '@amazon/vinyl-observable'
import type { MediaTimeline } from './MediaTimeline'
import { getMediaPeriodAtTime, type MediaPeriod } from './MediaTimeline'
import type { PrefetchState, QualitySelector } from './abr/QualitySelector'

/**
 * The interval to check if additional segments should be prefetched.
 */
export const PREFETCH_POLL_THROTTLE = 1

export interface SegmentControllerImplDeps {
    readonly playbackController: ReadonlyPlaybackController

    readonly mediaTimelineTransformed: ObservableValue<Promise<MediaTimeline>>

    readonly qualitySelector: QualitySelector
}

export interface SegmentControllerImplOptions {
    /**
     * The amount of time ahead of the playhead to prefetch when the track is active.
     * Default: 240
     */
    readonly prefetchActive: number

    /**
     * The amount of time to prefetch when the track is not active.
     * Default: 20
     */
    readonly prefetchInactive: number

    /**
     * The number of seconds behind the playhead to retain segments.
     * Default: 30
     */
    readonly retainTail: number
}

export const defaultSegmentControllerBaseOptions: SegmentControllerImplOptions =
    {
        prefetchActive: 180,
        prefetchInactive: 20,
        retainTail: 30,
    }

/**
 * Default SegmentController implementation.
 * Provides segments for a given time.
 * Handles segment prefetching and caching.
 *
 * Uses mediaTimelineTransformed to resolve segments directly from the MediaTimeline.
 */
export class SegmentControllerImpl
    extends EventHostImpl<SegmentControllerEventMap>
    implements SegmentController
{
    get [Symbol.toStringTag](): string {
        return 'SegmentControllerImpl'
    }

    private _active = false
    get active(): boolean {
        return this._active
    }

    private readonly _fetchedRanges = new RangesImpl()
    private _startTime = 0

    /**
     * A map of decoder id to init segment slots.
     * This allows representations with seamless bitstream switching to share initialization segments without
     * making unnecessary requests or decoder re-initializations.
     */
    private readonly cachedInitSegments = new Map<string, SegmentDataSlot>()
    private readonly cachedSegments: SegmentReference<SegmentDataSlot>[] = []

    private readonly disposer = createDisposer()
    readonly options: SegmentControllerImplOptions

    private prefetchingPriority: Mutable<SegmentPrefetchPriority> =
        clone(defaultTrackPriority)

    /**
     * True if the last segment in the prefetch range has been cached.
     */
    private ended = false
    private prefetching = false
    private _error: Error | null = null

    private timeUpdateSub: Unsubscribe | null = null
    private seekingSub: Unsubscribe | null = null

    // When disposed, aborts in-flight operations.
    private readonly abort = new Abort()

    /**
     * Cached last period lookup for fast repeated access.
     */
    private _cachedPeriod: MediaPeriod | null = null

    constructor(
        readonly deps: SegmentControllerImplDeps,
        readonly contentType: ContentType,
        options?: Partial<SegmentControllerImplOptions>
    ) {
        super()
        logDebug(this, 'constructed')
        const { add } = this.disposer
        this.options = {
            ...defaultSegmentControllerBaseOptions,
            ...options,
        }
        add(
            deps.mediaTimelineTransformed.onData(() => {
                // If the media timeline changes, re-check ended state.
                this.ended = false
                this._cachedPeriod = null
                this.pollPrefetch()
                this.dispatch('change', {})
            })
        )

        add(
            getNetworkState().on('online', () => {
                logDebug(this, 'online, resetting prefetch')
                this.reset()
            })
        )
    }

    get error(): Error | null {
        return this._error
    }

    async getDuration(): Promise<number | null> {
        const timeline = await this.deps.mediaTimelineTransformed.value
        if (timeline.getDuration) return timeline.getDuration()
        const periods = timeline.periods
        if (periods.length === 0) return null
        const last = periods[periods.length - 1]
        return last.endTime === Infinity ? null : last.endTime
    }

    /**
     * Gets the period at the given time, using a cache for the last returned period.
     */
    private async getPeriodAtTime(time: number): Promise<MediaPeriod | null> {
        if (
            this._cachedPeriod &&
            time >= this._cachedPeriod.startTime &&
            time < this._cachedPeriod.endTime
        ) {
            return this._cachedPeriod
        }
        const timeline = await this.deps.mediaTimelineTransformed.value
        const period = getMediaPeriodAtTime(timeline, time)
        if (period) this._cachedPeriod = period
        return period
    }

    /**
     * Configures this segment provider and initiates prefetching.
     * This may be called multiple times, for example when re-using a cached track a new track priority and start time
     * can be provided.
     */
    configure(options: Partial<PrefetchOptions>) {
        if (options.startTime != null) this._startTime = options.startTime
        if (options.trackPrefetchPriority != null)
            this.prefetchingPriority.trackPriority =
                options.trackPrefetchPriority
        this.ended = false
        this.pollPrefetch()
    }

    get startTime(): number {
        return this._startTime
    }

    get trackPrefetchPriority(): number {
        return this.prefetchingPriority.trackPriority
    }

    /**
     * Returns the range that should be prefetched.
     */
    private get prefetchRange(): Range {
        return this.active
            ? this.prefetchRangeActive
            : this.prefetchRangeInactive
    }

    /**
     * Returns the range that should be prefetched when inactive.
     * This range will not be removed during sweeps unless `clear` is called.
     */
    private get prefetchRangeInactive(): Range {
        const prefetchFrom = this.startTime
        const prefetchTo = prefetchFrom + this.options.prefetchInactive
        return [prefetchFrom, prefetchTo]
    }

    /**
     * Returns the range that should be prefetched while active.
     */
    private get prefetchRangeActive(): Range {
        const prefetchFrom = this.deps.playbackController.currentTime
        const prefetchTo = prefetchFrom + this.options.prefetchActive
        return [prefetchFrom, prefetchTo]
    }

    /**
     * Clears data segments no longer within the current prefetch range.
     * Init segments will not be changed.
     */
    private sweepCachedSegments() {
        // The inactive range (typically first couple segments of a track) will not be removed.
        const inactiveRange = this.prefetchRangeInactive

        // The active range prefetch expanded to include the retain tail will not be removed if the track is active.
        const activeRange = this.active
            ? ([
                  this.prefetchRangeActive[0] - this.options.retainTail,
                  this.prefetchRangeActive[1],
              ] as const)
            : null
        let n = this.cachedSegments.length
        for (let i = 0; i < n; i++) {
            const cachedSegment = this.cachedSegments[i]
            // Check if the cached segment is still within our retain window.
            const { startTime, endTime } = cachedSegment
            const cachedRange = [startTime, endTime] as const
            if (
                !rangeIntersects(inactiveRange, cachedRange) &&
                !(activeRange && rangeIntersects(activeRange, cachedRange))
            ) {
                // No longer need the segment. Does nothing if inactive.
                cachedSegment.data.clear()
                this.cachedSegments.splice(i, 1)
                logDebug(
                    this,
                    'removing cached segment at: ',
                    cachedSegment.startTime
                )
                i--
                n--
            }
        }
    }

    /**
     * Gets the next time to prefetch, or null if the prefetch range has been filled.
     */
    private getNextTimeToPrefetch(): number | null {
        const [prefetchFrom, prefetchTo] = this.prefetchRange
        // fetchedRanges are directly from the segments, safe to use when getting next segment.
        const currentRange = this.fetchedRanges.getRangeAt(prefetchFrom)
        const nextTime = currentRange == null ? prefetchFrom : currentRange[1]
        if (nextTime >= prefetchTo - Number.EPSILON) return null
        return nextTime
    }

    private pollPrefetch = this.disposer.add(
        throttle(
            () => {
                if (this.error) return
                this.sweepCachedSegments()
                if (this.ended || this.prefetching) return

                const nextTime = this.getNextTimeToPrefetch()
                if (nextTime == null) return // Prefetched the full range
                this.prefetching = true
                // Enqueue the prefetch.
                enqueueSegmentPrefetch(
                    async () => {
                        this.abort.throwIfAborted()
                        // Quality selection is done at the time of getSegment(), which is called when
                        // a slot is created. Defer slot creation until request is about to be made.
                        logDebug(this, `Prefetching`, nextTime.toFixed(4))
                        const slot = await this.getSlotAtTime(nextTime)
                        this.abort.throwIfAborted()
                        if (!slot) {
                            logDebug(this, 'prefetch ended')
                            this.ended = true
                            return
                        }
                        await withAbort(
                            Promise.all([
                                slot.initData.request(),
                                slot.data.request(),
                            ]),
                            this.abort
                        )
                    },
                    this.contentType,
                    this.prefetchingPriority
                )
                    .catch(this.prefetchErrorHandler)
                    .finally(() => {
                        this.prefetching = false
                        if (!this.disposed) this.pollPrefetch()
                    })
            },
            PREFETCH_POLL_THROTTLE,
            {
                leading: true,
                trailing: true,
            }
        )
    )

    private prefetchErrorHandler = (error: any) => {
        // Only log the error for prefetch failures, it will get reported if/when it is attempted
        // to be buffered.
        if (!isSilentError(error)) {
            logError(this, 'Error prefetching segment', error)
            this._error = error
        }
    }

    get fetchedRanges(): ReadonlyRanges {
        return this._fetchedRanges
    }

    /**
     * Gets the number of seconds currently prefetched.
     */
    get fetchedTime(): number {
        const time = this.active
            ? this.deps.playbackController.currentTime
            : this._startTime
        const currentRange = this.fetchedRanges.getRangeAt(time)
        if (!currentRange) return 0
        return currentRange[1] - time
    }

    private _streamingQuality: MediaQualityMetadata | null = null

    get streamingQuality(): MediaQualityMetadata | null {
        return this._streamingQuality
    }

    private set streamingQuality(value: MediaQualityMetadata | null) {
        const previous = this._streamingQuality
        if (value?.qualityId === previous?.qualityId) return
        this._streamingQuality = value
        logDebug(this, 'streamingQualityChange', value)
        this.dispatch('streamingQualityChange', {
            previous,
            current: value,
        })
    }

    getSegment(
        time: number,
        abort?: ReadonlyAbort
    ): Promise<SegmentReference<ArrayBuffer> | null> {
        logDebug(this, `requesting segment at time: ${time.toFixed(4)}`)
        const segmentReferencePromise = withAbort(
            this._getSegment(Math.max(0, time)),
            abort
        )

        // When a segment is actively needed, block the prefetch queue until the active segment promise settles:
        enqueueSegmentPrefetch(
            () => segmentReferencePromise,
            this.contentType,
            immediatePrefetchPriority
        ).catch(noop)
        return segmentReferencePromise
    }

    private async _getSegment(
        time: number
    ): Promise<SegmentReference<ArrayBuffer> | null> {
        const streamingSlot = await this.getSlotAtTime(time)
        if (!streamingSlot) return null
        logDebug(
            this,
            `init status: ${streamingSlot.initData.status}, data status: ${streamingSlot.data.status}`
        )
        // If prefetch failed, try again now that the segment is actively needed:
        this.resetSlot(streamingSlot)

        const initAndDataPromise = Promise.all([
            streamingSlot.initData.request(),
            streamingSlot.data.request(),
        ])

        // If the requested time is close to the start of the next segment, immediately start prefetching the next
        // segment, and not resolving until both are cached.
        let minBufferPrefetch: Promise<void> = Promise.resolve()
        const minBufferTime = await this.getMinBufferTime()
        if (streamingSlot.endTime - time < minBufferTime) {
            minBufferPrefetch = this.prefetchImmediate(
                streamingSlot.endTime
            ).catch(noop) // Ignore error until it is the next segment needed
        }
        const [initData, data] = await initAndDataPromise
        await minBufferPrefetch
        return {
            ...streamingSlot,
            initData,
            data,
        }
    }

    /**
     * Gets the minimum buffer time from the timeline.
     * Falls back to a reasonable default.
     */
    private async getMinBufferTime(): Promise<number> {
        const timeline = await this.deps.mediaTimelineTransformed.value
        return timeline.minBufferTime
    }

    /**
     * Prefetches the segment at the given time. Does not use the background scheduler.
     *
     * @param time
     */
    private async prefetchImmediate(time: number): Promise<void> {
        const slot = await this.getSlotAtTime(time)
        if (!slot) return
        await Promise.all([slot.initData.request(), slot.data.request()])
    }

    /**
     * Gets a streaming segment slot that spans the given time, or null if there is no media at that time.
     * Slots will be cached until they slide out of the retention range or `clear` is called.
     */
    private async getSlotAtTime(
        time: number
    ): Promise<SegmentReference<SegmentDataSlot> | null> {
        // Check if there is a cached slot.
        const cachedSegment = getSegmentAtTime(
            time,
            this.cachedSegments,
            SEGMENT_START_AFFORDANCE
        )
        if (cachedSegment) return cachedSegment

        const newSlot = await withAbort(
            this.createSlotForTime(time),
            this.abort
        )
        this.abort.throwIfAborted()

        if (!newSlot) return null
        newSlot.data.onStatusChange = () => {
            // When the data segment settles, update the fetched ranges.
            if (newSlot.data.status === SegmentStatus.RESOLVED)
                this._fetchedRanges.add(newSlot.startTime, newSlot.endTime)
            else if (newSlot.data.status === SegmentStatus.INACTIVE)
                this._fetchedRanges.remove(newSlot.startTime, newSlot.endTime)
            this.dispatch('fetchedRangesChange', {})
        }

        // Insert the slot, in order.
        const insertionIndex = getSegmentInsertionIndexAtTime(
            newSlot.startTime,
            this.cachedSegments
        )

        // Slot creation is asynchronous, to allow requesting index ranges. Check if a slot for this time was already
        // created.
        if (insertionIndex > 0) {
            const cachedSegment = this.cachedSegments[insertionIndex - 1]
            if (closeTo(newSlot.startTime, cachedSegment.startTime)) {
                return cachedSegment
            }
        }
        logDebug(
            this,
            `created slot at ${insertionIndex} for time ${newSlot.startTime.toFixed(4)}`
        )
        this.cachedSegments.splice(insertionIndex, 0, newSlot)
        return newSlot
    }

    /**
     * Gets a cached init segment slot for the given decoder id. If a slot is not cached, create one.
     */
    private getOrCreateInitSlot(
        decoderId: string,
        segmentDataProvider: SegmentDataProvider
    ): SegmentDataSlot {
        return getOrSet(this.cachedInitSegments, decoderId, () => {
            return new SegmentDataSlot(segmentDataProvider)
        })
    }

    /**
     * Creates a slot that spans the given time, or returns null if there is no media at that time.
     * Uses the mediaTimelineTransformed to resolve segments directly.
     */
    private async createSlotForTime(
        time: number
    ): Promise<SegmentReference<SegmentDataSlot> | null> {
        const period = await this.getPeriodAtTime(time)
        if (!period) return null

        // Filter qualities to this content type.
        const filteredQualities = period.qualities.filter(
            (q) => q.metadata.contentType === this.contentType
        )
        if (filteredQualities.length === 0) return null

        // Gets the preceding segment encoding metadata for quality selection.
        let previousQuality: MediaQualityMetadata | null = null
        const previousIndex =
            getSegmentInsertionIndexAtTime(time, this.cachedSegments) - 1
        if (previousIndex >= 0)
            previousQuality = this.cachedSegments[previousIndex].quality

        const prefetchState: PrefetchState = {
            fetchedTime: this.fetchedTime,
            previousQuality,
            active: this.active,
        }

        const metadataArray = filteredQualities.map((q) => q.metadata)
        const index = this.deps.qualitySelector.selectQuality(
            metadataArray,
            prefetchState
        )
        const selectedQuality = filteredQualities[index]

        const segment = await selectedQuality.getSegment(
            time,
            SEGMENT_START_AFFORDANCE
        )
        this.abort.throwIfAborted()
        this.streamingQuality = segment?.quality ?? null
        if (!segment) return null

        return {
            ...segment,
            quality: segment.quality,
            initData: this.getOrCreateInitSlot(
                segment.quality.decoderId,
                segment.initData
            ),
            data: new SegmentDataSlot(segment.data),
        }
    }

    /**
     * Indicates that this segment provider is providing segments for an active track and should be prioritized
     * accordingly.
     * Time ranges to be prefetched will change to the active prefetch window.
     */
    activate(): void {
        if (this._active) return
        logDebug(this, 'activate')
        this._active = true
        this.pollPrefetch()
        const playbackController = this.deps.playbackController
        this.timeUpdateSub = playbackController.on(
            'timeUpdate',
            this.pollPrefetch
        )
        this.seekingSub = playbackController.on('seeking', () => {
            this.ended = false
            this._error = null
            this.pollPrefetch()
        })
    }

    /**
     * Deactivates the segment provider.
     * This clears cached segments not within the inactive prefetch range.
     * Time ranges to be prefetched will change to the inactive prefetch window.
     */
    deactivate(): void {
        if (!this._active) return
        logDebug(this, 'deactivate')
        this._active = false
        this.sweepCachedSegments()
        this.timeUpdateSub!()
        this.timeUpdateSub = null
        this.seekingSub!()
        this.seekingSub = null
    }

    clear(): void {
        logDebug(this, 'clear')
        this.cachedSegments.forEach((slot) => {
            slot.data.onStatusChange = null
            slot.data.clear()
            slot.initData.clear()
        })
        this.cachedSegments.length = 0
        this.cachedInitSegments.clear()
        this._fetchedRanges.clear()
        this.ended = false
        this._error = null
        this._cachedPeriod = null
        if (!this.disposed) this.pollPrefetch()
        this.dispatch('fetchedRangesChange', {})
    }

    reset(): void {
        logDebug(this, 'reset')
        this.cachedSegments.forEach((slot) => this.resetSlot(slot))
        this._error = null
        this.pollPrefetch()
    }

    /**
     * Resets the slot if it's in an error state.
     * @param slot
     */
    private resetSlot(slot: SegmentReference<SegmentDataSlot>) {
        if (slot.data.status === SegmentStatus.ERRED) {
            logDebug(this, 'resetting failed segment at time:', slot.startTime)
            this.ended = false
            slot.data.clear()
        }
        if (slot.initData.status === SegmentStatus.ERRED) {
            logDebug(this, 'resetting failed init segment')
            this.ended = false
            slot.initData.clear()
        }
    }

    get disposed(): boolean {
        return this.disposer.disposed
    }

    dispose(): void {
        logDebug(this, 'disposing')
        super.dispose()
        this.disposer.dispose()
        this.deactivate()
        this.clear()
        this.abort.abort()
    }
}
