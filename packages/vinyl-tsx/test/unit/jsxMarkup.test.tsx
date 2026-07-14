import { jsx } from '@amazon/vinyl-tsx'
import { installDomPolyfill } from './domPolyfill'
import { data } from '@amazon/vinyl-observable'

describe('jsxMarkup', () => {
    installDomPolyfill()

    describe('tsx elements', () => {
        it('are compile-time safe', () => {
            const d = <div id="test123" />
            expect(d.id).toBe('test123')

            // @ts-expect-error Expected notValid to be compile-time failure
            const _d2 = <div notValid="123" />

            const _d3 = <div aria-controls="123" />
            const _d4 = <div aria-any-valid="123" />
            const _d5 = <div data-any-valid="123" />
            const _d6 = <div any-dash-valid="123" />
            // @ts-expect-error Expected non-nullable
            const _d7 = <div tabIndex={null} />
            // @ts-expect-error Expected non-nullable
            const _d8 = <div tabIndex={data<number | null>(0)} />
            // @ts-expect-error Expected number
            const _d9 = <div tabIndex="1" />
            // @ts-expect-error Expected number
            const _d9b = <div tabIndex={data('1')} />
            const _d10 = <div tabIndex={data(1)} />
            const _d11 = <div tabIndex={1} />
        })
    })
})
