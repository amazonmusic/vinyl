# @amazon/vinyl-website

[Website](https://amazonmusic.github.io/vinyl)

The marketing site, demos, and rendered documentation for Amazon Vinyl. Not
published — built and deployed to GitHub Pages by the release pipeline.

## Develop

```shell
npm run start -w @amazon/vinyl-website
```

The dev server reads markdown from each package's `README.md` and `docs/*.md`,
runs them through `marked` with `highlight.js` syntax highlighting, and serves
them via the SPA at `/docs/<slug>`.

## Build

```shell
npm run build:release -w @amazon/vinyl-website
```

This generates the TypeDoc API reference and produces a static bundle in
`dist/`.
