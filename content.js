async function seekPlayer(timeMs) {
  if (!PLATFORM.usesBackgroundSeek) {
    const video = getVideo();
    if (!video) return false;
    video.currentTime = timeMs / 1000;
    log("seekPlayer: direct video seek", video.currentTime);
    return true;
  }
  try {
    const result = await chrome.runtime.sendMessage({ type: "seekNetflixPlayer", timeMs });
    log("seekPlayer: result", result);
    return !!result?.ok;
  } catch (err) {
    log("seekPlayer: message failed", err);
    return false;
  }
}

function findSubtitleContainer() {
  for (const selector of SELECTOR_CHAIN) {
    const el = document.querySelector(selector);
    if (el) {
      log("container found via selector", selector, el);
      return el;
    }
  }
  const fallback = findStructuralFallback();
  if (fallback) log("container found via structural fallback", fallback);
  return fallback;
}

function findStructuralFallback() {
  const video = getVideo();
  if (!video) {
    log("structural fallback: no video element found");
    return null;
  }
  const videoRect = video.getBoundingClientRect();

  for (const div of document.querySelectorAll("div")) {
    if (getComputedStyle(div).position !== "absolute") continue;
    if (!div.textContent.trim()) continue;

    const rect = div.getBoundingClientRect();
    const insideVideo =
      rect.left >= videoRect.left &&
      rect.right <= videoRect.right &&
      rect.top >= videoRect.top &&
      rect.bottom <= videoRect.bottom;

    if (insideVideo) return div.parentElement ?? div;
  }
  return null;
}

function hasImageSubtitles(container) {
  return !!container.querySelector("svg, img");
}

function getLineContainers(container) {
  const matches = container.querySelectorAll(PLATFORM.lineContainerSelector);
  if (matches.length > 0) return Array.from(matches);
  if (PLATFORM.lineContainerFallbackSelector) {
    const fallback = container.querySelectorAll(PLATFORM.lineContainerFallbackSelector);
    if (fallback.length > 0) return Array.from(fallback);
  }
  return container.textContent.trim() ? [container] : [];
}

function logDomSnapshot(container) {
  log("container.outerHTML", container.outerHTML);
  log("container.textContent", JSON.stringify(container.textContent));
}

function isInteractionLocked() {
  return isPopupOpen() || selectionStart !== null;
}

function resyncSubtitles() {
  if (currentContainer) processSubtitle(currentContainer);
}

function processSubtitle(container) {
  log("processSubtitle fired");
  logDomSnapshot(container);

  if (hasImageSubtitles(container)) {
    log("image subtitles detected, skipping");
    if (!isInteractionLocked()) removeAllOverlays();
    return;
  }

  const lineContainers = getLineContainers(container);
  log("lineContainers found", lineContainers.length, lineContainers);
  if (lineContainers.length === 0) {
    if (!isInteractionLocked()) removeAllOverlays();
    return;
  }

  reconcileLines(lineContainers);
}

function watchContainer(container) {
  log("watchContainer started", container);
  currentContainer = container;

  const debounceMs = PLATFORM.processDebounceMs;
  let processTimer = null;
  const scheduleProcess = () => {
    if (debounceMs <= 0) {
      processSubtitle(container);
      return;
    }
    clearTimeout(processTimer);
    processTimer = setTimeout(() => processSubtitle(container), debounceMs);
  };

  const observer = new MutationObserver(scheduleProcess);
  observer.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["style"]
  });
  processSubtitle(container);
  observeVideoResize();
}

function observeVideoResize() {
  const video = getVideo();
  if (!video) return;
  attachVideoListeners(video);
  if (video.dataset.nseResizeObserved) return;
  video.dataset.nseResizeObserved = "true";
  const resizeObserver = new ResizeObserver(() => repositionAllOverlays());
  resizeObserver.observe(video);
}

function buildOnboarding() {
  const backdrop = document.createElement("div");
  backdrop.id = "nse-onboard";
  backdrop.className = "nse-onboard-backdrop";

  const card = document.createElement("div");
  card.className = "nse-onboard-card";

  const title = document.createElement("h1");
  title.className = "nse-onboard-title";
  title.appendChild(document.createTextNode("Sub"));
  const accent = document.createElement("span");
  accent.className = "nse-onboard-accent";
  accent.textContent = "lens";
  title.appendChild(accent);
  card.appendChild(title);

  const desc = document.createElement("p");
  desc.className = "nse-onboard-desc";
  desc.textContent =
    "Choose the language you want subtitles translated into. The subtitle language is detected automatically, and you can change everything later from the toolbar icon.";
  card.appendChild(desc);

  const label = document.createElement("label");
  label.className = "nse-onboard-label";
  label.textContent = "Translate to";
  card.appendChild(label);

  const select = document.createElement("select");
  select.className = "nse-onboard-select";
  for (const [code, name] of NSE_LANGUAGES) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    select.appendChild(option);
  }
  select.value = settings.translationTargetLang;
  card.appendChild(select);

  const button = document.createElement("button");
  button.className = "nse-onboard-btn";
  button.textContent = "Get started";
  button.addEventListener("click", async () => {
    const lang = select.value;
    settings.translationTargetLang = lang;
    await nseSetSetting("translationTargetLang", lang);
    await nseSetOnboarded(true);
    backdrop.remove();
  });
  card.appendChild(button);

  backdrop.appendChild(card);
  return backdrop;
}

async function showOnboardingIfFirstRun() {
  if (document.getElementById("nse-onboard")) return;
  if (await nseGetOnboarded()) return;
  if (document.getElementById("nse-onboard")) return;
  document.body.appendChild(buildOnboarding());
}

function init() {
  log("init() called");
  const existing = findSubtitleContainer();
  if (existing) {
    watchContainer(existing);
    return;
  }

  log("no existing container, starting bodyObserver fallback scan");
  let debounceTimer = null;
  const bodyObserver = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const container = findSubtitleContainer();
      if (!container) return;
      log("bodyObserver found container, switching to watchContainer");
      bodyObserver.disconnect();
      watchContainer(container);
    }, 150);
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
}

function onGlobalKeydown(e) {
  if (e.key !== "ArrowLeft") return;
  log("onGlobalKeydown: ArrowLeft detected", "repeat", e.repeat, "target", e.target);
  if (!settings.jumpToPreviousSubtitleOnBack) return;
  if (e.repeat) return;
  if (e.target instanceof HTMLElement) {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
  }
  if (!getVideo()) return;

  e.preventDefault();
  e.stopPropagation();
  jumpToPreviousCue();
}

log("content script loaded", location.href);

document.documentElement.classList.add(`nse-platform-${PLATFORM.name}`);

nseGetSettings().then((loaded) => {
  settings = loaded;
  applyBlurSettingToAllOverlays();
});

nseOnSettingsChanged((changed) => {
  Object.assign(settings, changed);
  if ("subtitleBlurEnabled" in changed) applyBlurSettingToAllOverlays();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.onboardingCompleted?.newValue) {
    document.getElementById("nse-onboard")?.remove();
  }
});

document.addEventListener("keydown", onGlobalKeydown, { capture: true });

window.addEventListener("resize", repositionAllOverlays);

document.addEventListener("fullscreenchange", () => {
  log("fullscreenchange", document.fullscreenElement);
  maxControlsHeight = 0;
  for (const line of activeLines) reparentToCurrentTarget(line.overlay);
  removePopup();
  repositionAllOverlays();
});

window.addEventListener("yt-navigate-finish", () => {
  log("yt-navigate-finish", location.href);
  if (currentContainer?.isConnected) return;
  removeAllOverlays();
  cueHistory = [];
  cueIndex = -1;
  currentContainer = null;
  init();
});

init();
showOnboardingIfFirstRun();
