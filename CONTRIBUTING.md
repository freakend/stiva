# Contributing to Stiva

Thanks for wanting to help! Stiva is a small, friendly project. Every issue,
bug report, and pull request is appreciated.

## Getting started

```bash
pnpm install
pnpm dev
```

> [!TIP]
> Use **pnpm**. The lockfile (`pnpm-lock.yaml`) is only generated/valid for pnpm.

## Checks before you push

Run all of these locally:

```bash
pnpm lint        # ESLint (zero warnings allowed)
pnpm format      # Prettier
pnpm test        # Vitest unit tests
pnpm build       # tsc -b && vite build
```

Make sure `pnpm build` and `pnpm test` pass before opening a PR.

## How to contribute

1. **Found a bug or have an idea?** Open an issue first. Describe the problem,
   the steps to reproduce, and what you expected instead.
2. **Want to fix something?** Fork the repo, create a branch
   (`fix/describe-fix` or `feat/describe-feature`), and open a pull request.
   Reference the related issue in the PR description.
3. Keep changes small and focused. One PR = one logical change.

## Project structure

```
src/
  components/   UI components (Cell, ImageViewer, Select, Toast, ...)
  hooks/        useCollageState: all collage state + undo/redo history
  lib/          Pure logic: ratios, layouts, export (canvas rendering)
  App.tsx       Main layout: desktop sidebar + canvas + mobile bottom sheet
public/         Static assets: PWA manifest, service worker, icons
```

- Collage state (ratio, count, gap, orientation, cells, undo/redo) lives in
  `useCollageState`.
- Layout math lives in `lib/layouts.ts`. Pure functions, unit-testable.
- Canvas export lives in `lib/export.ts`. Pure-ish, rendered at export time.
- The PWA service worker (`public/sw.js`) self-destructs on `localhost` to keep
  dev/HMR clean; keep that behavior when touching it.

## Code style

- TypeScript, strict mode. No `any` unless absolutely necessary.
- React function components only (no classes).
- Tailwind utility classes, following the existing token palette in
  `src/index.css` (`--color-cream`, `--color-ink`, etc.). Avoid introducing new
  colors out of the blue.
- No `console.log` in production code paths.

## Releasing

Releases are cut from `main` via GitHub Releases. See `CHANGELOG.md` for the
format. Version bumps follow [SemVer](https://semver.org/).
