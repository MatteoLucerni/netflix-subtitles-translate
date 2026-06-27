const TOGGLE_KEYS = [
  "jumpToPreviousSubtitleOnBack",
  "autoPauseOnHover",
  "subtitleBlurEnabled",
  "autoRemoveBlurOnPause"
];

const SELECT_KEYS = ["subtitleSourceLang", "translationTargetLang"];

function getCheckbox(key) {
  return document.querySelector(`[data-setting="${key}"] input[type="checkbox"]`);
}

function getSelect(key) {
  return document.querySelector(`[data-setting="${key}"] select`);
}

function populateSelect(select, includeAuto) {
  if (includeAuto) {
    const option = document.createElement("option");
    option.value = "auto";
    option.textContent = "Auto (from Netflix)";
    select.appendChild(option);
  }
  for (const [code, label] of NSE_LANGUAGES) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = label;
    select.appendChild(option);
  }
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

  for (const key of SELECT_KEYS) {
    const select = getSelect(key);
    populateSelect(select, key === "subtitleSourceLang");
    select.value = current[key];
    select.addEventListener("change", () => {
      nseSetSetting(key, select.value);
    });
  }

  const advancedToggle = document.getElementById("nse-advanced-toggle");
  const advancedPanel = document.getElementById("nse-advanced-panel");
  advancedToggle.addEventListener("click", () => {
    const expanded = advancedToggle.getAttribute("aria-expanded") === "true";
    advancedToggle.setAttribute("aria-expanded", String(!expanded));
    advancedPanel.hidden = expanded;
    advancedToggle.querySelector("span").textContent = expanded
      ? "Show advanced options"
      : "Hide advanced options";
  });
}

init();
