/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeConnectedObserver, jsx } from '@amazon/vinyl-tsx'
import { PlayerPage } from './components/PlayerPage'
import { TransportBar } from './components/TransportBar'
import { playerState } from './player'

// Mounts the interactive player demo into the statically rendered /player page.
// Loaded lazily by client.ts only on that route (keeps the heavy @amazon/vinyl
// import out of every other page).
initializeConnectedObserver()

const root = document.getElementById('player-root')
if (root) {
    root.append(PlayerPage())
    document.body.append(
        <TransportBar visible={playerState.track$.map((v) => v != null)} />
    )
}
