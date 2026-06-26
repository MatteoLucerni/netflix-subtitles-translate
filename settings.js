const NSE_SETTINGS_DEFAULTS = {
  jumpToPreviousSubtitleOnBack: true,
  autoPauseOnHover: true,
  subtitleBlurEnabled: true,
  autoRemoveBlurOnPause: true
};

function nseGetSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(NSE_SETTINGS_DEFAULTS, (stored) => resolve(stored));
  });
}

function nseSetSetting(key, value) {
  return chrome.storage.sync.set({ [key]: value });
}

function nseOnSettingsChanged(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;

    const relevant = {};
    let hasRelevant = false;
    for (const key of Object.keys(NSE_SETTINGS_DEFAULTS)) {
      if (changes[key]) {
        relevant[key] = changes[key].newValue;
        hasRelevant = true;
      }
    }
    if (hasRelevant) callback(relevant);
  });
}
