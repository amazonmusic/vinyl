# Integ Tests

This integ tests package is bundled with the unit tests and dependent libraries
to be run in a browser.

The Jasmine bootstrap must be loaded before the specs, See
jasmine/html/resources/index.html

Integ tests can be created using a real Amazon Vinyl player. To set up an integ
suite, use `createVinylSuite`.

Example:

```typescript
describe('progressive tracks', () => {
    const suite = createVinylSuite()

    it('play', async () => {
        player.load({
            type: 'src',
            uri: vinylTestAssets.prog.libmp3lame_60s_2ch_16bit_44100Hz_48kbps,
        })
        await player.play()
        await expectTrackPlays(player)
    })
})
```

To run in a local browser, execute `npm run start`. To run on browserstack,
execute `npm run test:browserstack`
