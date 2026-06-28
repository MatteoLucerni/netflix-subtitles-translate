# Sublens

A Chrome extension (Manifest V3) that blurs subtitles until you want to read them, and turns subtitle words into clickable translations, dictionary lookups and pronunciation.

Supports Netflix and YouTube. The extension is built around a platform adapter so other streaming platforms can be added later without changing its identity.

## Features

- **Subtitle blur**: subtitles are blurred by default; hover over a line to reveal it.
- **Auto-pause on hover**: hovering a subtitle pauses the video so you can read it.
- **Auto-reveal on pause**: pausing the video reveals all blurred subtitles.
- **Jump to previous subtitle**: pressing the Left Arrow key replays the previous subtitle line (instead of the player's default rewind).
- **Per-platform on/off**: master toggles to enable or disable the extension on Netflix and on YouTube independently (turn both off to disable it everywhere).
- **Word translation and dictionary**: click a word for its translation and dictionary entry, Ctrl/Cmd+click to add more words to the selection, or click-and-drag to select a phrase.
- **Pronunciation**: the selected word or phrase is pronounced automatically in the subtitle language when the popup opens, and a speaker button lets you replay it.
- **Language selection**: choose the subtitle (source) language, or leave it on "Auto" to detect it from the active player caption track, and the language to translate into.

On YouTube, both manual and auto-generated captions are supported; the captions must be enabled in the player (CC button). On YouTube the supported pages are `youtube.com/watch`.

The five behaviors above are toggleable from the extension's toolbar popup and default to enabled (matching the extension's original always-on behavior); the subtitle and translation languages are configurable in the same popup.

## File structure

```
manifest.json     MV3 manifest
background.js     Service worker: platform-aware player seek + Google Translate requests
content.css       Styles for the subtitle overlay and dictionary popup
popup.html/css/js Toolbar action popup with the settings controls
env.js            Single DEV_MODE logging flag (self.DEV_MODE)
icons/            Extension icons (16/32/48/128 px)
build.ps1         Packages the extension into a versioned zip for the Chrome Web Store
docs/             Marketing site (landing, welcome, privacy), published on getsublens.com
```

The content-script logic is split across several classic scripts that share one
isolated-world scope and are loaded in this exact order (see `manifest.json`):

```
env.js            Sets self.DEV_MODE (logging flag); loaded first
settings.js       Shared chrome.storage.sync helpers + language list
platforms.js      Platform adapter (Netflix/YouTube): selectors, seek, lang detection
core.js           Config constants, shared state, base helpers
overlay.js        Subtitle overlay: styles, positioning, tokenizing, reconcile, blur/reveal
cues.js           Cue history + Left Arrow back-jump navigation
interaction.js    Word/phrase selection (click/Ctrl+click/drag) + translation popup
content.js        Entry point: subtitle discovery, onboarding, init + event wiring
```

The order matters: these files share globals, and only `content.js` (loaded last)
runs top-level code.

## Logging

All logging is gated behind a single flag defined in `env.js`
(`self.DEV_MODE`), shared by the content scripts and the background service
worker (which loads it via `importScripts("env.js")`). In development the flag
is `true` and `[NSE]` logs are printed. The production zip produced by
`build.ps1` rewrites `env.js` to `self.DEV_MODE = false`, so a packaged build
prints nothing to the user's console.

## Development setup

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this repository's root folder.
4. Open a Netflix video or a YouTube `/watch` video with subtitles enabled.

On first install the extension opens a getting-started page
(`https://getsublens.com/welcome.html`) in a new tab.

## Building for the Chrome Web Store

Run `./build.ps1` from the repository root. It reads `manifest.json`, collects
exactly the files the extension references (manifest, content scripts,
`content.css`, `background.js`, the popup and its assets, `env.js`, icons),
forces `env.js` to `self.DEV_MODE = false`, and writes
`dist/Sublens-<version>-<timestamp>.zip`.

## Permissions

- `scripting`: used to inject a script into the page's main world to call the internal player API (Netflix seek and YouTube source-language detection).
- `storage`: used by `chrome.storage.sync` to persist the settings.
- `host_permissions` for `netflix.com` and `youtube.com` (content script), `translate.googleapis.com` (background fetches for translation/dictionary data), and `translate.google.com` (background fetches for text-to-speech audio).

## Settings popup

Click the extension icon in the toolbar to open the settings popup. It holds the subtitle and translation language selects, the **Enable on Netflix** / **Enable on YouTube** master toggles (which turn the extension on or off per platform), and the five behavior toggles under "advanced options". Each control has a "?" icon with a hover tooltip explaining its effect in detail. Settings are stored via `chrome.storage.sync` and applied live, no page reload required. A footer at the bottom links out to **Give feedback**, the **Changelog**, and the **Website**.

## Word interaction guide

- **Click** a word to see its translation and dictionary definition.
- **Ctrl/Cmd+Click** additional words to combine them into one selection before looking them up.
- **Click and drag** across multiple words to select a phrase.

## Versioning

This project follows [Semantic Versioning](https://semver.org/). Every change bumps `manifest.json`'s `version` field and is recorded in [CHANGELOG.md](CHANGELOG.md). See the project-level `CLAUDE.md` (local, not committed) for the exact versioning policy used by Claude Code when working on this repository.
