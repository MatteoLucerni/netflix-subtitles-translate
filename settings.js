const NSE_SETTINGS_DEFAULTS = {
  netflixEnabled: true,
  youtubeEnabled: true,
  jumpToPreviousSubtitleOnBack: true,
  autoPauseOnHover: true,
  subtitleBlurEnabled: true,
  autoRemoveBlurOnPause: true,
  pronunciationEnabled: true,
  subtitleSourceLang: "auto",
  translationTargetLang: "en"
};

const NSE_LANGUAGES = [
  ["en", "English"],
  ["it", "Italiano"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["pt", "Português"],
  ["nl", "Nederlands"],
  ["sv", "Svenska"],
  ["pl", "Polski"],
  ["ro", "Română"],
  ["tr", "Türkçe"],
  ["el", "Ελληνικά"],
  ["ru", "Русский"],
  ["uk", "Українська"]
];

function nseGetSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(NSE_SETTINGS_DEFAULTS, (stored) => resolve(stored));
  });
}

function nseSetSetting(key, value) {
  return chrome.storage.sync.set({ [key]: value });
}

function nseGetOnboarded() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ onboardingCompleted: false }, (stored) => resolve(!!stored.onboardingCompleted));
  });
}

function nseSetOnboarded(value) {
  return chrome.storage.sync.set({ onboardingCompleted: value });
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
