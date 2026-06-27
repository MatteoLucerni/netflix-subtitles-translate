# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.7.1]

### Fixed
- Toolbar icon background now uses the exact same blue (`#38bdf8`) as the rest of the app, instead of a darker shade that no longer matched.

### Changed
- "Show advanced options" label and chevron are now centered and colored with the app's accent blue instead of secondary gray.

## [0.7.0]

### Added
- The four behavior toggles (back arrow rewind, auto-pause on hover, blur subtitles, remove blur on pause) are now collapsed behind a "Show advanced options" disclosure in the popup, simplifying the default view. Click it to expand and access them.

### Changed
- Loosened spacing throughout the popup (header, language rows, toggle rows, help section) for a less cramped, more relaxed read.
- "Ctrl+Click" in the help section is now written "Ctrl + Click".

## [0.6.2]

### Fixed
- The popup header logo (`.nse-logo`) no longer rounds its bottom-right corner via CSS, which was masking the icon's intentionally squared-off corner.

### Changed
- Toolbar icon (16/32/48/128): the two center bars now read like wrapped text, left-aligned with the first (top) line the longest and the second (bottom) line half its length.
- Re-added a small magnifying-glass handle in the bottom-right corner, sized to fit the space left by the squared-off background corner, without changing the ring's size.

## [0.6.1]

### Changed
- Toolbar icon background (16/32/48/128) is now a circle rounded on three corners, with the bottom-right corner squared off to meet the canvas edge instead of being rounded.
- The shorter of the two center bars (the first line) is now half the width of the second.

## [0.6.0]

### Changed
- Reworked the toolbar icon (16/32/48/128): dropped the magnifying-glass handle and enlarged the circle to fill most of the canvas, so the glyph reads more clearly at small sizes. Background darkened to `#08a5eb` to read closer to the app's accent blue at full-bleed icon size.

## [0.5.1]

### Fixed
- Restored rounded corners on the toolbar icon (16/32/48/128), which had been lost when the background was made full-bleed in 0.5.0.

## [0.5.0]

### Changed
- Switched the accent color from green to a light blue (`#38bdf8`) across the subtitle overlay, dictionary popup, onboarding overlay, and toolbar popup, so selected words, translations, and UI accents now share a single consistent color.
- Redrawn the toolbar icon (16/32/48/128) with a full-bleed light blue background and a white magnifying glass glyph, replacing the previous rounded dark icon with a green glyph.
- Widened the toolbar popup from 320px to 360px.

## [0.4.1]

### Fixed
- The previous dictionary popup now closes immediately when a new word, multi-word, or phrase selection is finalized, instead of staying open until the new translation arrives. This makes it clear the new selection was registered.

## [0.4.0]

### Added
- First-run onboarding overlay: the first time you land on Netflix after installing, a centered modal asks you to choose the translation target language. The choice is saved and the overlay never appears again (tracked by an `onboardingCompleted` flag in `chrome.storage.sync`, which also dismisses the overlay in other open tabs). Everything remains changeable later from the toolbar popup.

## [0.3.0]

### Added
- Multi-language support. The subtitle (source) language is auto-detected from the active Netflix subtitle track via the player API (`getTimedTextTrack().bcp47`), with a manual override available in the popup. The translation (target) language is selectable from a curated list of 14 Latin/Cyrillic languages. Both settings are stored in `chrome.storage.sync` and apply live without a page reload.
- Two language dropdowns in the toolbar popup: "Subtitle language" (with an "Auto (from Netflix)" option) and "Translate to".

### Changed
- Word tokenizer is now Unicode-aware (`\p{L}\p{M}`) instead of `A-Za-z`, so accented Latin and Cyrillic words become clickable.
- Google Translate requests are parameterized by source/target language instead of being hardcoded to English → Italian. When the source cannot be detected (e.g. subtitles off), it falls back to Google's automatic source detection.

## [0.2.0]

### Added
- Toolbar settings popup (`popup.html`/`popup.css`/`popup.js`) with 4 toggles: jump to previous subtitle on back arrow, auto-pause on hover, subtitle blur, and auto-remove blur on pause. Settings are stored in `chrome.storage.sync` and applied live without a page reload.
- Shared `settings.js` module exposing `chrome.storage.sync` helpers to both the content script and the popup.
- New icon set (16/32/48/128 px): a magnifying-glass "lens" mark over subtitle lines, green on dark gray.
- New extension name ("Subtitle Lens") and Chrome Web Store description, deliberately platform-agnostic so other streaming sites can be supported later without a rebrand.
- Popup redesign: layered Google-style dark gray palette instead of flat black, a bolder header with the "Lens" word picked out in green and the version badge pinned top-right, and a toned-down switch style (muted track, green knob) using the same brand green as the rest of the UI.
- `README.md`, this changelog, and a project-level `CLAUDE.md` (untracked) with the versioning policy.
- `storage` permission, required for `chrome.storage.sync`.

### Changed
- Flattened the repository: all extension files moved from `netflix-sub-ext/` to the repository root.

### Fixed
- Settings tooltips no longer get clipped by the popup's edge: they are now centered on their toggle row instead of anchored to the small "?" icon, so they always stay fully within the popup regardless of how far right the icon sits.

## [0.1.0]

### Added
- Initial release: dictionary lookup on word click, Ctrl+click multi-word selection, click-and-drag phrase selection, dynamic subtitle blur based on font size, auto-pause on subtitle hover, and jump-to-previous-subtitle on the Left Arrow key.
