const NSE_PLATFORMS = {
  netflix: {
    name: "netflix",
    hostMatch: (host) => /(^|\.)netflix\.com$/.test(host),
    subtitleSelectors: [".player-timedtext", '[class*="timedtext"]'],
    controlsSelectors: [
      '[data-uia="player-controls-wrapper"]',
      '[data-uia="controls-standard"]',
      '[class*="PlayerControlsNeo__layout"]',
      '[class*="PlayerControlsNeo"]'
    ],
    lineContainerSelector: '[class*="timedtext-text-container"]',
    cueRootSelector: '[class*="timedtext-text-container"]',
    usesBackgroundSeek: true,
    processDebounceMs: 0,
    cleanLineText: (text) => text
  },
  youtube: {
    name: "youtube",
    hostMatch: (host) => /(^|\.)youtube\.com$/.test(host),
    subtitleSelectors: ["#ytp-caption-window-container"],
    controlsSelectors: [".ytp-chrome-bottom"],
    lineContainerSelector: ".caption-visual-line",
    lineContainerFallbackSelector: ".caption-window",
    cueRootSelector: ".caption-window",
    usesBackgroundSeek: false,
    processDebounceMs: 180,
    cleanLineText: (text) =>
      text
        .split("\n")
        .map((line) => line.replace(/>>+/g, " ").replace(/[ \t]+/g, " ").trim())
        .join("\n")
  }
};

function nseDetectPlatform() {
  const host = location.hostname;
  for (const platform of Object.values(NSE_PLATFORMS)) {
    if (platform.hostMatch(host)) return platform;
  }
  return NSE_PLATFORMS.netflix;
}

const PLATFORM = nseDetectPlatform();
