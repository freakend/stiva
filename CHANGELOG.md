# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial open-source release of Stiva, the private browser collage maker.
- Grid layouts for 9 ratios and 1/2/3/4/6 photos, landscape & portrait templates.
- Per-cell crop with pan, zoom, and pinch gestures; drag-to-swap cells.
- Export to PNG up to 3000px on the long edge, preserving crop & pan.
- Fully local processing. Photos never leave the browser (max 10MB each).
- PWA support: installable, offline-capable shell with service worker.
- Mobile UI: Lightroom-style bottom toolbar with collapsible pickers.
- Dark-accent light theme (cream / off-white), Space Grotesk + JetBrains Mono.
- Lighthouse 99/100/100/100 banner (`public/lighthouse-banner.svg`) in README.

### Fixed

- Tap on a filled photo cell now opens the crop viewer bottom sheet instead of the Replace file picker.
- Respect iOS safe area (`viewport-fit=cover`, `env(safe-area-inset-bottom)`) for bottom toolbar, picker, and crop sheet.
- Improve text contrast to WCAG AA 4.5:1 (`#9A9A93` → `#6B6B63`, `#B8B4A8` → `#6B6B63`) and remove dark mode toggle.
- Label Gap range inputs (`htmlFor`/`aria-label`) and make Imbe links always underlined; raise contrast of unselected Photo/Orientation segments (`#6B6B63` → `#2D2E26` on `#EDE9E0`).

### Changed

- Crop viewer is now a bottom sheet on mobile and a centered modal on desktop.
