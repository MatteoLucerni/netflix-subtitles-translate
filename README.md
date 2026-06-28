<p align="center">
  <img src="icons/icon128.png" alt="Sublens Logo" width="80" />
</p>

<h1 align="center">Sublens</h1>

<p align="center">
  <strong>Blur subtitles until you want to read them, then click, Ctrl/Cmd+click or drag-select any word for instant translation, dictionary definitions and pronunciation on Netflix and YouTube.</strong>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/hkocpinnlehjpbobobnpocanjaaaiijh"><img src="https://img.shields.io/chrome-web-store/v/hkocpinnlehjpbobobnpocanjaaaiijh?style=flat&logo=googlechrome&logoColor=white&label=Chrome%20Web%20Store" alt="Chrome Web Store Version" /></a>
  <a href="https://chromewebstore.google.com/detail/hkocpinnlehjpbobobnpocanjaaaiijh"><img src="https://img.shields.io/chrome-web-store/users/hkocpinnlehjpbobobnpocanjaaaiijh?style=flat&logo=googlechrome&logoColor=white&label=Users" alt="Chrome Web Store Users" /></a>
  <a href="https://chromewebstore.google.com/detail/hkocpinnlehjpbobobnpocanjaaaiijh"><img src="https://img.shields.io/chrome-web-store/rating/hkocpinnlehjpbobobnpocanjaaaiijh?style=flat&logo=googlechrome&logoColor=white&label=Rating" alt="Chrome Web Store Rating" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-green?style=flat" alt="Manifest V3" />
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/hkocpinnlehjpbobobnpocanjaaaiijh">Chrome Web Store</a> &middot;
  <a href="https://getsublens.com/">Website</a> &middot;
  <a href="https://forms.gle/DK6xH1bjRLuqNHYQ6">Give Feedback</a> &middot;
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

## Features

### Subtitle Blur

Subtitles are blurred by default, so you test your listening before reading. Hover over a line to reveal it; pausing the video reveals every blurred line at once. The blur amount scales with the subtitle's own font size. Toggle the default blur, and whether pausing auto-reveals, independently in the popup.

### Click to Translate & Define

**Click** any subtitle word for its translation and dictionary entry. **Ctrl/Cmd+click** additional words to combine them into one selection before looking them up, or **click and drag** across a line to select a whole phrase. The popup appears instantly with a loading spinner, then fills in with the translation, dictionary entries and example sentences, placed above or below the subtitles depending on which side has room.

### Pronunciation

The selected word or phrase can be pronounced in the subtitle's source language, fetched through Google Translate's text-to-speech endpoint. A speaker button in the popup is always available to play the pronunciation on demand. The **Auto-pronounce on selection** toggle in the popup controls only whether the pronunciation also plays automatically as soon as the translation popup opens.

### Auto-Pause on Hover

Hovering a subtitle pauses the video so you have time to read or look up a word, and resumes playback when you move the mouse away. Toggleable independently of the blur and reveal-on-pause behaviors.

### Replay the Previous Subtitle

Press the **Left Arrow** key to jump back to the start of the previous subtitle line and pause at its end, instead of the player's default rewind. When there is no earlier subtitle to jump back to (subtitles off, or nothing played yet), the key falls back to the player's native rewind, so it never feels broken. If you manually pause during the replay, the scheduled auto-pause at the end of the line is cancelled.

### Language Selection

The subtitle (source) language is auto-detected from the active caption track on Netflix or YouTube, including auto-translated YouTube tracks (e.g. "English >> Italian" is detected as Italian, the language actually shown), or you can set it manually. Pick the language translations and dictionary definitions are shown in from a curated list of 14 Latin/Cyrillic languages. Both apply live, no page reload.

### Per-Platform Enable/Disable

Independent **Enable on Netflix** / **Enable on YouTube** master toggles in the popup. When a platform is disabled, its page plays with normal native subtitles and Sublens does nothing on it; turn both off to disable the extension everywhere.

### Netflix & YouTube Support

Built around a platform adapter (`platforms.js`) that isolates every platform-specific detail, so the same overlay, blur, translation and navigation logic runs on both sites. On YouTube, both manual and auto-generated (rollup) captions are supported on `youtube.com/watch` pages; the `>>` speaker-change markers YouTube adds are stripped before words become clickable, the overlay gets a semi-transparent background so white captions stay readable over bright scenes, and the overlay position stays stable while the player controls show or hide.

### Toolbar Settings Popup

Click the toolbar icon to open the settings popup: the language selects, the platform toggles, and five behavior toggles tucked under "Show advanced options" to keep the default view simple. Every control has a "?" tooltip explaining its effect. A footer links out to **Give Feedback**, the **Changelog**, and the **Website**.

### Onboarding & Getting Started

The first time you land on Netflix after installing, a centered overlay asks you to pick your translation language. On install, a getting-started page opens in a new tab walking through every feature.

### Privacy by Design

No account, no sign-in, no analytics, no tracking. The only data sent anywhere is the word or phrase you actively select, sent to Google Translate solely to return its translation and pronunciation. See the [Privacy Policy](https://getsublens.com/privacy.html) for details.

---

## Installation

### For Users

Install directly from the **[Chrome Web Store](https://chromewebstore.google.com/detail/hkocpinnlehjpbobobnpocanjaaaiijh)**.

### For Developers

1. Clone the repository
   ```bash
   git clone https://github.com/MatteoLucerni/netflix-subtitles-translate.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (top-right corner)
4. Click **Load unpacked** and select the repository's root folder
5. Open a Netflix video, or a YouTube `/watch` video with captions turned on (CC button)

> **Tip:** To filter only this extension's logs in Chrome DevTools console, use:
> `url:chrome-extension://EXTENSION_ID`
> Logs are also gated behind `self.DEV_MODE` in `env.js`, so they only appear in development builds (see [Logging](#logging) below).

---

## Build

Package the extension for Chrome Web Store upload:

```powershell
.\build.ps1
```

This reads `manifest.json`, collects exactly the files the extension references (manifest, content scripts, `content.css`, `background.js`, the popup and its assets, `env.js`, icons), forces `env.js` to `self.DEV_MODE = false`, and writes a versioned zip to `dist/Sublens-<version>-<timestamp>.zip`.

---

## Project Structure

```
subtitles-translate-extension
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── docs/                  Marketing site (landing, welcome, privacy), published on getsublens.com
│   ├── index.html         Landing page
│   ├── welcome.html       Getting-started page opened on install
│   ├── privacy.html       Privacy policy
│   ├── 404.html
│   └── assets/
│       ├── css/welcome.css
│       └── js/
│           ├── store-link.js       Wires "Add to Chrome" buttons to the Web Store listing
│           └── feedback-widget.js  Floating feedback/bug-report widget
├── env.js                 Sets self.DEV_MODE (logging flag); loaded first
├── settings.js            Shared chrome.storage.sync helpers + language list
├── platforms.js           Platform adapter (Netflix/YouTube): selectors, seek, language detection
├── core.js                Config constants, shared state, base helpers
├── overlay.js             Subtitle overlay: styles, positioning, tokenizing, reconcile, blur/reveal
├── cues.js                Cue history + Left Arrow back-jump navigation
├── interaction.js         Word/phrase selection (click/Ctrl+Cmd+click/drag) + translation popup
├── content.js             Entry point: subtitle discovery, onboarding, init + event wiring
├── content.css            Styles for the subtitle overlay and dictionary popup
├── background.js          Service worker: platform-aware player seek + Google Translate requests
├── popup.html/css/js      Toolbar action popup with the settings controls
├── build.ps1              Packages the extension into a versioned zip for the Chrome Web Store
├── CHANGELOG.md           Version history
├── manifest.json          Extension manifest (MV3)
└── README.md
```

---

## How It Works

1. **Content scripts** (`env.js` through `content.js`) load on Netflix and YouTube in the exact order declared in `manifest.json`, sharing one isolated-world scope. Only `content.js`, loaded last, runs top-level execution (settings loading, event wiring, `init()`); the other files are declarations only, so every symbol they reference already exists.
2. `platforms.js` detects the current platform from the page hostname and exposes a single `PLATFORM` object holding every platform-specific detail (selectors, debounce timing, caption cleanup, seek strategy), so `core.js`, `overlay.js`, `cues.js`, `interaction.js` and `content.js` stay platform-agnostic.
3. A **MutationObserver** watches the subtitle/caption container and a lightweight container watchdog re-attaches it whenever the player replaces it (Netflix mounts a placeholder before playback; YouTube re-renders on SPA navigation).
4. **Settings** are stored in `chrome.storage.sync` and applied live via `chrome.storage.onChanged`, no page reload required.
5. The **background service worker** injects a small MAIN-world script via `chrome.scripting.executeScript` to call each platform's internal player API (Netflix seek and source-language detection; YouTube source-language detection), and proxies translation/pronunciation requests to Google Translate.

### Logging

All logging is gated behind a single flag defined in `env.js` (`self.DEV_MODE`), shared by the content scripts and the background service worker (which loads it via `importScripts("env.js")`). In development the flag is `true` and `[NSE]`-prefixed logs are printed. The production zip produced by `build.ps1` rewrites `env.js` to `self.DEV_MODE = false`, so a packaged build prints nothing to the user's console.

## Permissions

- `scripting`: used to inject a script into the page's main world to call the internal player API (Netflix seek and source-language detection, YouTube source-language detection).
- `storage`: used by `chrome.storage.sync` to persist the settings.
- `host_permissions` for `netflix.com` and `youtube.com` (content script), `translate.googleapis.com` (background fetches for translation/dictionary data), and `translate.google.com` (background fetches for text-to-speech audio).

## Versioning

This project follows [Semantic Versioning](https://semver.org/). Every change bumps `manifest.json`'s `version` field and is recorded in [CHANGELOG.md](CHANGELOG.md).

---

## License

This project is licensed under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
