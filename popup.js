const TOGGLE_KEYS = [
  "jumpToPreviousSubtitleOnBack",
  "autoPauseOnHover",
  "subtitleBlurEnabled",
  "autoRemoveBlurOnPause"
];

function getCheckbox(key) {
  return document.querySelector(`[data-setting="${key}"] input[type="checkbox"]`);
}

async function init() {
  document.getElementById("nse-version").textContent = `v${chrome.runtime.getManifest().version}`;

  const current = await nseGetSettings();
  for (const key of TOGGLE_KEYS) {
    const checkbox = getCheckbox(key);
    checkbox.checked = current[key];
    checkbox.addEventListener("change", () => {
      nseSetSetting(key, checkbox.checked);
    });
  }
}

init();
