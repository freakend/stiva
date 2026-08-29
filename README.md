<div align="center">

# Stiva

**Arrange photos into collages. Your computer does it all.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev)

[Live app](https://stiva.imbe.net) · [Report Bug](https://github.com/freakend/stiva/issues) · [Request Feature](https://github.com/freakend/stiva/issues)

<p align="center">
Stiva is a browser-based collage maker that runs entirely on-device.<br>
Pick a ratio and photo count, drop in pictures, adjust each crop with pan and zoom,<br>
then export a PNG up to 3000px on the long edge.
</p>

No accounts. No uploads. No tracking. Everything stays in your browser.

</div>

---

## Why Stiva

Collage tools usually upload your photos to a server to render the result.
Stiva never does. Every image is read from your device, drawn onto a canvas
in your browser, and exported straight to a download. If you close the tab
after exporting, nothing about your collage ever leaves your machine.

## Features

- 9 canvas ratios: 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 4:5, 5:4
- 1, 2, 3, 4, or 6 photos per collage
- Landscape and portrait layout templates per count
- Click a photo to crop it: drag to pan, pinch or scroll to zoom
- Drag any photo to swap its position with another
- Adjustable gap between photos and canvas background color
- Export PNG up to 3000px on the long edge, keeping your exact crop
- 10MB max per image, everything local
- Installable as a PWA
- Mobile-first bottom toolbar (desktop keeps a full sidebar)

## Quick start

Requires [Node.js](https://nodejs.org) 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173. The dev server skips the service worker so
live-reload stays clean.

### Scripts

| Command        | What it does                            |
| -------------- | --------------------------------------- |
| `pnpm dev`     | Start the Vite dev server               |
| `pnpm build`   | Typecheck + production build to `dist/` |
| `pnpm preview` | Preview the production build            |
| `pnpm lint`    | ESLint (zero warnings allowed)          |
| `pnpm test`    | Vitest unit tests                       |
| `pnpm format`  | Prettier on everything                  |

## How it works

```mermaid
flowchart LR
    A[Pick ratio & count] --> B[Add photos to cells]
    B --> C[Crop & arrange]
    C --> D[Export PNG]
```

Everything runs client-side:

- `src/hooks/useCollageState.ts` owns the collage state and undo/redo history.
- `src/lib/layouts.ts` computes cell rectangles per count and orientation
  (pure functions, unit tested).
- `src/lib/export.ts` renders collages to a high-res PNG using the browser
  Canvas API, with your pan and zoom applied to each cell.
- `public/sw.js` is the PWA service worker. It self-destructs on localhost so
  it never interferes with development.

## Privacy

Stiva makes no network requests for your images. Photos are read via
`URL.createObjectURL`, rendered locally, and discarded when you close the app.
The only assets fetched from a server are the app's own static files (JS, CSS,
fonts, PWA manifest).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). All checks run in CI on every pull
request:

```bash
pnpm lint && pnpm test && pnpm build
```

## License

[MIT](./LICENSE)
