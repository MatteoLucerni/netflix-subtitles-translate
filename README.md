# Subtitle Lens

A Chrome extension (Manifest V3) that blurs subtitles until you want to read them, and turns subtitle words into clickable translations and dictionary lookups.

Currently supports Netflix. The extension is built so other streaming platforms can be added later without changing its identity.

## Features

- **Subtitle blur** — subtitles are blurred by default; hover over a line to reveal it.
- **Auto-pause on hover** — hovering a subtitle pauses the video so you can read it.
- **Auto-reveal on pause** — pausing the video reveals all blurred subtitles.
- **Jump to previous subtitle** — pressing the Left Arrow key replays the previous subtitle line (instead of Netflix's default 10-second rewind).
- **Word translation and dictionary** — click a word for its translation and dictionary entry, Ctrl+click to add more words to the selection, or click-and-drag to select a phrase.

All four behaviors above are toggleable from the extension's toolbar popup, and default to enabled (matching the extension's original always-on behavior).

## File structure

```
manifest.json     MV3 manifest
background.js     Service worker: Netflix player seek + Google Translate requests
content.js        Injected into netflix.com: subtitle overlay, blur, word interaction
content.css       Styles for the subtitle overlay and dictionary popup
settings.js        Shared chrome.storage.sync helpers, loaded before content.js and popup.js
popup.html/css/js Toolbar action popup with the settings toggles
icons/            Extension icons (16/32/48/128 px)
```

## Development setup

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this repository's root folder.
4. Open a Netflix video with subtitles enabled.

## Permissions

- `scripting` — used to inject a script into the Netflix page's main world to call the internal player API for seeking.
- `storage` — used by `chrome.storage.sync` to persist the 4 settings toggles.
- `host_permissions` for `netflix.com` (content script) and `translate.googleapis.com` (background fetches for translation/dictionary data).

## Settings popup

Click the extension icon in the toolbar to open the settings popup. Each toggle has a short description and a "?" icon with a hover tooltip explaining its effect in detail. Settings are stored via `chrome.storage.sync` and applied live, no page reload required.

## Word interaction guide

- **Click** a word to see its translation and dictionary definition.
- **Ctrl+Click** additional words to combine them into one selection before looking them up.
- **Click and drag** across multiple words to select a phrase.

## Versioning

This project follows [Semantic Versioning](https://semver.org/). Every change bumps `manifest.json`'s `version` field and is recorded in [CHANGELOG.md](CHANGELOG.md). See the project-level `CLAUDE.md` (local, not committed) for the exact versioning policy used by Claude Code when working on this repository.
