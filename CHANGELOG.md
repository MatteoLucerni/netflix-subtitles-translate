# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
