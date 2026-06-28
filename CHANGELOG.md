# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.11.0]

### Added
- The dictionary popup now appears immediately with a loading spinner when you select a word or phrase, then fills in with the translation when it arrives, instead of staying hidden until the request completes. This avoids the impression that nothing happened on slower lookups.

### Changed
- The dictionary popup is now placed on the side of the subtitles where there is room: below the subtitles when they sit in the upper half of the player, above them when they sit in the lower half (previously it was always pinned above, which pushed it off-screen for top-positioned subtitles).

## [0.10.2]

### Fixed
- Disabling the extension while a subtitle is on screen no longer leaves that line blank: `removeAllOverlays` now restores the native subtitle element's visibility (it was left at `visibility: hidden`, so the native subtitle stayed invisible until the next cue, up to several seconds on Netflix).
- YouTube: the native-caption hiding class is now added synchronously at content-script load (and reconciled to the real on/off state once settings load), instead of only after the async settings read, closing a window where native captions could briefly flash on first load.
- Disabling a platform now tears down the video `ResizeObserver` and the `pause`/`play` listeners instead of leaving them attached for the page's lifetime.

### Changed
- `findSubtitleContainer` now reuses `findCanonicalContainer` for the selector-chain lookup instead of duplicating the loop.

## [0.10.1]

### Fixed
- Netflix: the extension no longer fails to attach the first time you start a movie or episode (subtitles staying unblurred and unclickable until a manual page reload). Netflix mounts a placeholder subtitle container before playback and replaces it when playback starts, leaving the old MutationObserver attached to a detached node. A persistent, lightweight container watchdog now re-attaches to the current subtitle container whenever it is replaced, which also makes the extension survive Netflix's in-app (SPA) navigation from browse to watch. The one-shot body scan was replaced by this watchdog.

## [0.10.0]

### Added
- Two master toggles in the popup, shown above the advanced options: "Enable on Netflix" and "Enable on YouTube". Each turns the whole extension on or off for that platform; turning both off disables it everywhere. When a platform is disabled, its page plays with its normal subtitles and the extension does nothing (no overlay, no blur, no key handling). The toggles apply live with no page reload, default to enabled, and are stored in `chrome.storage.sync` as `netflixEnabled` / `youtubeEnabled`.

## [0.9.0]

### Added
- YouTube support (`youtube.com/watch` pages). All existing features (subtitle blur, auto-pause on hover, auto-reveal on pause, Left Arrow back-jump, and word translation/dictionary) now work on YouTube in addition to Netflix. Both manual and auto-generated (rollup) captions are supported, with progressive word-by-word caption rendering handled so the blur stays stable. The native YouTube caption text is hidden via CSS (not just JS) so it never flashes on screen before the overlay takes over.
- New `platforms.js` adapter that isolates all platform-specific details (subtitle/controls selectors, line containers, cue-boundary detection, player seek, source-language detection). Loaded between `settings.js` and `core.js`. The platform is selected automatically from the page hostname.

### Changed
- Player seek is now platform-aware: Netflix keeps the main-world player API seek, while YouTube seeks the HTML5 `<video>` element directly. Subtitle source-language auto-detection reads the active YouTube caption track via the player API, mirroring the existing Netflix detection.

## [0.8.1]

### Fixed
- Back-arrow subtitle navigation no longer skips a cue or pauses at the wrong moment after a previous back-jump. The cue history now re-syncs its position to the cue actually on screen when replaying, and a cue's end time is recorded against the correct entry instead of always the last one.
- Subtitle overlays are no longer pinned too high after returning from fullscreen to windowed playback. The reserved controls height is now reset on fullscreen change so each mode measures its own controls.
- Dictionary definitions in the translation popup are now aligned to the correct sense. Each definition is translated individually instead of as one delimiter-joined blob, which could misalign when Google Translate dropped the delimiter.

### Changed
- Split the 1,100+ line `content.js` into cohesive feature modules (`core.js`, `overlay.js`, `cues.js`, `interaction.js`, and a thin `content.js` entry), loaded in order as classic content scripts. No user-facing behavior change; improves maintainability.

## [0.8.0]

### Changed
- Extension renamed from "Subtitle Lens" to "Sublens - Translate & Learn from Subtitles" (short name "Sublens"), to better surface the translation/language-learning value proposition in the Chrome Web Store. Updated everywhere the name appears: manifest, toolbar tooltip, popup header, and onboarding overlay.
- Removed the short description text under each language/toggle row in the popup, since the existing "?" tooltip already explains each setting in detail. Reduces visual clutter and lets toggle rows center their content instead of top-aligning.
- Popup header title given a slightly larger, more decorated treatment (bigger font, subtle glow on the accent word) to better carry the new name now that it stands alone without a subtitle line nearby.

## [0.7.3]

### Changed
- Toolbar icon background darkened further to `#0790cd`, a bigger step down than the previous adjustment, since that one still read too light.

## [0.7.2]

### Changed
- Toolbar icon background adjusted to `#20b1f2`, between the app's accent blue and the previous darker shade, to compensate for the large flat fill reading lighter than the same color used as small text/UI accents.

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
