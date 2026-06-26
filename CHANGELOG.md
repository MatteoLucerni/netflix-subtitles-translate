# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0]

### Added
- Toolbar settings popup (`popup.html`/`popup.css`/`popup.js`) with 4 toggles: jump to previous subtitle on back arrow, auto-pause on hover, subtitle blur, and auto-remove blur on pause. Settings are stored in `chrome.storage.sync` and applied live without a page reload.
- Shared `settings.js` module exposing `chrome.storage.sync` helpers to both the content script and the popup.
- New icon set (16/32/48/128 px): a magnifying-glass "lens" mark over subtitle lines, green on dark gray.
- New extension name ("Subtitle Lens") and Chrome Web Store description, deliberately platform-agnostic so other streaming sites can be supported later without a rebrand.
- Popup redesign: layered Google-style dark gray palette instead of flat black, decorated header with title/tagline and a version badge pinned bottom-right, and a toned-down switch style (muted track, green knob) using the same brand green as the rest of the UI.
- `README.md`, this changelog, and a project-level `CLAUDE.md` (untracked) with the versioning policy.
- `storage` permission, required for `chrome.storage.sync`.

### Changed
- Flattened the repository: all extension files moved from `netflix-sub-ext/` to the repository root.

## [0.1.0]

### Added
- Initial release: dictionary lookup on word click, Ctrl+click multi-word selection, click-and-drag phrase selection, dynamic subtitle blur based on font size, auto-pause on subtitle hover, and jump-to-previous-subtitle on the Left Arrow key.
