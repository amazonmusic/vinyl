import { jsx } from '@amazon/vinyl-tsx'
import { navigateTo } from '@/router/router'
import docsManifest from 'virtual:docs-manifest'

interface DocEntry {
    readonly title: string
    readonly filename: string
    readonly category: string
    readonly html: string
}

const allDocs = docsManifest as DocEntry[]
const categories = [...new Set(allDocs.map((d) => d.category))]

export function DocsPage(slug: string | null) {
    const contentArea = <div className="docsContent markdown" />

    const menuItems: HTMLElement[] = []
    const menuEl = document.createElement('nav')
    menuEl.className = 'docsMenu'
    menuEl.setAttribute('role', 'menu')
    menuEl.setAttribute('aria-label', 'Documentation')

    for (const cat of categories) {
        const catHeader = document.createElement('div')
        catHeader.className = 'docsCategoryHeader'
        catHeader.textContent = cat
        catHeader.id = `docs-cat-${cat.toLowerCase().replace(/\s+/g, '-')}`
        catHeader.setAttribute('role', 'presentation')
        menuEl.appendChild(catHeader)

        for (const doc of allDocs.filter((d) => d.category === cat)) {
            const item = document.createElement('a')
            item.className = 'docsMenuItem'
            item.setAttribute('role', 'menuitem')
            item.tabIndex = 0
            item.textContent = doc.title
            const activate = () =>
                navigateTo('/docs/' + doc.filename.replace('.md', ''))
            item.onclick = activate
            item.onkeydown = (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    activate()
                }
            }
            menuEl.appendChild(item)
            menuItems.push(item)
        }
    }

    contentArea.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        const anchor = target.closest('a')
        if (!anchor) return
        const href = anchor.getAttribute('href')
        if (!href) return

        if (href.endsWith('.md') || href.includes('.md#')) {
            e.preventDefault()
            const filename = href.split('/').pop()!.split('#')[0]
            navigateTo('/docs/' + filename.replace('.md', ''))
            return
        }

        if (href.endsWith('.html') && !href.startsWith('http')) {
            const mdName = href.split('/').pop()!.replace('.html', '.md')
            const doc = allDocs.find((d) => d.filename === mdName)
            if (doc) {
                e.preventDefault()
                navigateTo('/docs/' + doc.filename.replace('.md', ''))
            }
        }
    })

    const activeDoc = slug
        ? allDocs.find((d) => d.filename.replace('.md', '') === slug)
        : allDocs[0]

    if (activeDoc) {
        contentArea.innerHTML = activeDoc.html
        for (const item of menuItems) {
            const isActive = item.textContent === activeDoc.title
            item.classList.toggle('active', isActive)
            item.setAttribute('aria-current', isActive ? 'page' : 'false')
        }
    }

    return (
        <div className="docsLayout">
            {menuEl}
            {contentArea}
        </div>
    )
}
