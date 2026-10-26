/** @jsx jsx */
import { jsx, Fragment, type JsxChild } from '@amazon/vinyl-tsx'
import { installDomPolyfill } from './domPolyfill'
import { data } from '@amazon/vinyl-observable'

describe('jsxMarkup', () => {
    installDomPolyfill()

    describe('tsx children', () => {
        it('accepts arrays of elements and text without spreading', () => {
            const items = ['a', 'b']
            const el = (
                <ul>
                    {items.map((item) => (
                        <li>{item}</li>
                    ))}
                    {['c', <li>d</li>]}
                </ul>
            )
            expect(
                Array.from(
                    el.childNodes,
                    (n) => (n.firstChild ?? n).textContent
                )
            ).toEqual(['a', 'b', 'c', 'd'])
        })

        it('omits null, undefined, and false children', () => {
            const render = (v?: { readonly myText: string }) => (
                <p>
                    {v && v.myText}
                    {v !== undefined && <b />}
                    {null}
                    {undefined}
                    {[v === undefined && 'x', null]}
                </p>
            )
            expect(
                Array.from(render().childNodes, (n) => n.textContent)
            ).toEqual(['x'])
            const shown = render({ myText: 'a' })
            expect(shown.childNodes.length).toBe(2)
            expect(shown.childNodes[0].textContent).toBe('a')
            expect((shown.childNodes[1] as HTMLElement).tagName).toBe('B')
        })

        it('passes factory component children through', () => {
            const Strings = (_props: object, children: string[]) => (
                <i>{children}</i>
            )
            const el = <Strings>a{'b'}</Strings>
            expect(Array.from(el.childNodes, (n) => n.textContent)).toEqual([
                'a',
                'b',
            ])
        })

        // Type checks only; never called.
        function _intrinsicChildTypes() {
            const _c1 = <div>{null}</div>
            const _c2 = <div>{[[<b />, data('a')], undefined]}</div>
            const _c3 = <div>{data<Node | string>('a')}</div>
            const v = undefined as { readonly myText: string } | undefined
            const _c9 = <p>{v && v.myText}</p>
            const flag = false as boolean
            const _c11 = <p>{[flag && 'a', null, undefined]}</p>
            const _c12 = <p>{flag && 'shown'}</p>
            // @ts-expect-error Expected boolean (which may be true) to be rejected
            const _c13 = <p>{flag}</p>
            // @ts-expect-error Expected boolean child to be rejected
            const _c4 = <div>{true}</div>
            // @ts-expect-error Expected number child to be rejected
            const _c5 = <div>{1}</div>
            // @ts-expect-error Expected true in an array to be rejected
            const _c6 = <div>{['a', true]}</div>
            // @ts-expect-error Expected boolean among children to be rejected
            const _c7 = <div>a{true}</div>
            // @ts-expect-error Expected observable number to be rejected
            const _c8 = <div>{data(1)}</div>
            const _c14 = <>a{[<b />, null]}</>
            // @ts-expect-error Expected boolean fragment child to be rejected
            const _c15 = <>{true}</>
        }

        // Type checks only; never called.
        function _componentChildTypes() {
            const NoChildren = (props: { x: string }) => <i>{props.x}</i>
            const Children = (_props: object, children: JsxChild[]) => (
                <i>{children}</i>
            )
            const Strings = (_props: object, children: string[]) => (
                <i>{children}</i>
            )
            const Any = (_props: object, _children: any[]) => <i />
            const Defaulted = (
                _props: object = {},
                children: JsxChild[] = []
            ) => <i>{children}</i>
            const Optional = (_props: object, children?: JsxChild[]) => (
                <i>{children}</i>
            )

            const _f1 = <NoChildren x="a" />
            // @ts-expect-error Expected no children to be accepted
            const _f2 = <NoChildren x="a">b</NoChildren>
            const _f3 = <Children>a</Children>
            const _f4 = (
                <Children>
                    a<b />
                </Children>
            )
            // @ts-expect-error Expected boolean child to be rejected
            const _f5 = <Children>{true}</Children>
            const _f6 = <Strings>a{'b'}</Strings>
            // @ts-expect-error Expected element child to be rejected
            const _f7 = <Strings>{<b />}</Strings>
            const _f8 = <Any>{true}</Any>
            const _f9 = (
                <Defaulted>
                    <b />
                </Defaulted>
            )
            const _f10 = <Optional>a</Optional>
            // @ts-expect-error Expected boolean child to be rejected with optional children
            const _f11 = <Optional>{true}</Optional>
        }
    })

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

        // Type checks only; never called.
        function _onConnectTypes() {
            const _o1 = (
                <input
                    onConnect={(el) => {
                        el.value = 'a'
                    }}
                />
            )
            const _o2 = <video onConnect={(el) => void el.play()} />
            const _o3 = <div onConnect={(el: HTMLElement) => void el} />
            const _o4 = (
                <div
                    // @ts-expect-error Expected div to lack input properties
                    onConnect={(el) => void el.value}
                />
            )
            const _o5 = (
                <div
                    // @ts-expect-error Expected a div not to be an input
                    onConnect={(el: HTMLInputElement) => void el}
                />
            )
        }
    })
})
