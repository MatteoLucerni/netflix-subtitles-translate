(() => {
  const DEBUG = true;
  function log(...args) {
    if (DEBUG) console.log("[NSE]", ...args);
  }

  log("content script loaded", location.href);

  const SELECTOR_CHAIN = [".player-timedtext", '[class*="timedtext"]'];
  const CONTROLS_SELECTOR_CHAIN = [
    '[data-uia="player-controls-wrapper"]',
    '[data-uia="controls-standard"]',
    '[class*="PlayerControlsNeo__layout"]',
    '[class*="PlayerControlsNeo"]'
  ];
  const FALLBACK_CONTROLS_HEIGHT = 110;
  const STYLE_PROPS = [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "color",
    "text-shadow",
    "line-height",
    "text-align",
    "letter-spacing"
  ];
  const WORD_CHAR_CLASS = "A-Za-z'";
  const TOKEN_REGEX = new RegExp(`[${WORD_CHAR_CLASS}]+|[^${WORD_CHAR_CLASS}]+`, "g");
  const NON_WORD_CHAR_REGEX = new RegExp(`[^${WORD_CHAR_CLASS}]`, "g");

  let activeLines = [];
  let currentContainer = null;
  let maxControlsHeight = 0;

  let extensionPaused = false;
  let wasPlayingBeforePause = false;
  let selectionStart = null;
  let selectionEnd = null;
  let selectionTimer = null;
  const SELECTION_DEBOUNCE_MS = 1200;

  let cueHistory = [];
  let cueIndex = -1;
  let suppressHistoryCapture = false;
  let suppressHistoryCaptureTimer = null;
  let pauseScheduleCleanup = null;
  let pauseScheduleTimer = null;
  const CUE_HISTORY_EPSILON_SEC = 0.05;
  const PAUSE_BEFORE_NEXT_CUE_SEC = 0.05;
  const PAUSE_SCHEDULE_SAFETY_MS = 15000;

  function getVideo() {
    return document.querySelector("video");
  }

  async function seekNetflixPlayer(timeMs) {
    try {
      const result = await chrome.runtime.sendMessage({ type: "seekNetflixPlayer", timeMs });
      log("seekNetflixPlayer: result", result);
      return !!result?.ok;
    } catch (err) {
      log("seekNetflixPlayer: message failed", err);
      return false;
    }
  }

  function getAppendTarget() {
    return document.fullscreenElement ?? document.body;
  }

  function reparentToCurrentTarget(el) {
    const target = getAppendTarget();
    if (el.parentElement !== target) target.appendChild(el);
  }

  function isPopupOpen() {
    return !!document.getElementById("nse-popup");
  }

  function pauseForInteraction() {
    const video = getVideo();
    if (!video) return;
    if (!extensionPaused) {
      wasPlayingBeforePause = !video.paused;
      extensionPaused = true;
    }
    video.pause();
  }

  function releaseInteraction() {
    if (!extensionPaused) return;
    extensionPaused = false;
    if (wasPlayingBeforePause) getVideo()?.play();
  }

  function revealAllOverlays() {
    for (const line of activeLines) line.overlay.classList.add("revealed");
  }

  function blurUnheldOverlays() {
    for (const line of activeLines) {
      if (line.overlay.dataset.hovered === "true") continue;
      if (isPopupOpen()) continue;
      line.overlay.classList.remove("revealed");
    }
  }

  function attachVideoListeners(video) {
    if (video.dataset.nseListenersAttached) return;
    video.dataset.nseListenersAttached = "true";
    video.addEventListener("pause", revealAllOverlays);
    video.addEventListener("play", blurUnheldOverlays);
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
    const matches = container.querySelectorAll('[class*="timedtext-text-container"]');
    if (matches.length > 0) return Array.from(matches);
    return container.textContent.trim() ? [container] : [];
  }

  function logDomSnapshot(container) {
    log("container.outerHTML", container.outerHTML);
    log("container.textContent", JSON.stringify(container.textContent));
  }

  function findStyleSource(lineEl) {
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
    const textNode = walker.nextNode();
    return textNode?.parentElement ?? lineEl;
  }

  function getLineText(lineEl) {
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let text = "";
    let node = walker.currentNode;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue;
      else if (node.nodeName === "BR") text += "\n";
    }
    return text;
  }

  function copyComputedStyles(target, source) {
    const computed = getComputedStyle(source);
    for (const prop of STYLE_PROPS) {
      target.style.setProperty(prop, computed.getPropertyValue(prop));
    }
  }

  function toDocumentRect(rect) {
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      bottom: rect.bottom + window.scrollY,
      width: rect.width,
      height: rect.height
    };
  }

  function findControlsElement() {
    for (const selector of CONTROLS_SELECTOR_CHAIN) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function getControlsReservedHeight() {
    const el = findControlsElement();
    if (el) {
      const height = el.getBoundingClientRect().height;
      if (height > 0) maxControlsHeight = Math.max(maxControlsHeight, height);
    }
    return maxControlsHeight > 0 ? maxControlsHeight : FALLBACK_CONTROLS_HEIGHT;
  }

  function getPinnedBottom() {
    const video = getVideo();
    if (!video) return null;
    return toDocumentRect(video.getBoundingClientRect()).bottom - getControlsReservedHeight();
  }

  function positionOverlayGroup(lines) {
    const connected = lines.filter((line) => line.lineEl.isConnected);
    if (connected.length === 0) return;

    const rects = connected.map((line) => ({ line, rect: toDocumentRect(line.lineEl.getBoundingClientRect()) }));
    const naturalBottommost = Math.max(...rects.map(({ rect }) => rect.bottom));
    const pinnedBottom = getPinnedBottom();
    const delta = pinnedBottom !== null ? pinnedBottom - naturalBottommost : 0;

    for (const { line, rect } of rects) {
      line.overlay.style.top = `${rect.bottom + delta}px`;
      line.overlay.style.left = `${rect.left}px`;
      line.overlay.style.width = `${rect.width}px`;
      line.overlay.style.height = "auto";
      line.overlay.style.transform = "translateY(-100%)";
    }
  }

  function repositionAllOverlays() {
    positionOverlayGroup(activeLines);
  }

  function buildTokens(text) {
    const parts = text.match(TOKEN_REGEX) ?? [];
    return parts.map((part) => {
      if (!/[A-Za-z]/.test(part)) return document.createTextNode(part);

      const span = document.createElement("span");
      span.className = "nse-word";
      span.dataset.word = part;
      span.textContent = part;
      return span;
    });
  }

  function createOverlay(lineEl) {
    log("creating overlay for line", lineEl);
    const overlay = document.createElement("div");
    overlay.className = "nse-overlay";
    copyComputedStyles(overlay, findStyleSource(lineEl));

    overlay.addEventListener("mouseenter", () => {
      overlay.dataset.hovered = "true";
      overlay.classList.add("revealed");
      pauseForInteraction();
    });

    overlay.addEventListener("mouseleave", () => {
      delete overlay.dataset.hovered;
      if (isPopupOpen()) return;
      releaseInteraction();
      if (!getVideo()?.paused) overlay.classList.remove("revealed");
    });

    overlay.addEventListener("click", onWordClick);

    if (isPopupOpen() || getVideo()?.paused) overlay.classList.add("revealed");

    getAppendTarget().appendChild(overlay);
    return overlay;
  }

  function reconcileLines(lineContainers) {
    const incoming = lineContainers.map((lineEl) => ({ lineEl, text: getLineText(lineEl) }));
    const usedOldIndexes = new Set();
    const newActiveLines = [];
    let hasNewCue = false;
    let hasRemovedCue = false;

    for (const { lineEl, text } of incoming) {
      const matchIndex = activeLines.findIndex(
        (line, idx) => !usedOldIndexes.has(idx) && line.lastText === text
      );

      if (matchIndex !== -1) {
        usedOldIndexes.add(matchIndex);
        const line = activeLines[matchIndex];
        line.lineEl = lineEl;
        lineEl.style.visibility = "hidden";
        copyComputedStyles(line.overlay, findStyleSource(lineEl));
        newActiveLines.push(line);
      } else {
        log("reconcileLines: new/changed text", JSON.stringify(text));
        hasNewCue = true;
        const overlay = createOverlay(lineEl);
        overlay.replaceChildren(...buildTokens(text));
        lineEl.style.visibility = "hidden";
        newActiveLines.push({ lineEl, overlay, lastText: text });
      }
    }

    for (let i = 0; i < activeLines.length; i++) {
      if (!usedOldIndexes.has(i)) {
        activeLines[i].overlay.remove();
        hasRemovedCue = true;
      }
    }

    activeLines = newActiveLines;
    positionOverlayGroup(activeLines);

    if (hasRemovedCue) markCueEnded();
    if (hasNewCue) recordCueStart();
  }

  function markCueEnded() {
    const video = getVideo();
    if (!video) return;
    const last = cueHistory[cueHistory.length - 1];
    if (!last || last.endTime != null) return;
    last.endTime = video.currentTime;
    log("markCueEnded: endTime", last.endTime, "for cue started at", last.time);
  }

  function recordCueStart() {
    if (suppressHistoryCapture) {
      suppressHistoryCapture = false;
      clearTimeout(suppressHistoryCaptureTimer);
      log("recordCueStart: suppressed (consumed)");
      return;
    }
    const video = getVideo();
    if (!video) return;

    const time = video.currentTime;
    const last = cueHistory[cueHistory.length - 1];
    if (last && Math.abs(last.time - time) < CUE_HISTORY_EPSILON_SEC) {
      log("recordCueStart: deduped, too close to last entry", time, last.time);
      return;
    }

    cueHistory.push({ time, endTime: null });
    cueIndex = cueHistory.length - 1;
    log("recordCueStart: pushed", time, "cueIndex", cueIndex, "historyLength", cueHistory.length);
  }

  function clearPauseSchedule() {
    if (pauseScheduleCleanup) {
      pauseScheduleCleanup();
      pauseScheduleCleanup = null;
    }
    clearTimeout(pauseScheduleTimer);
    pauseScheduleTimer = null;
  }

  function schedulePauseBeforeTime(endTime) {
    const video = getVideo();
    if (!video) return;
    clearPauseSchedule();

    let rafId = null;
    const check = () => {
      if (video.currentTime >= endTime - PAUSE_BEFORE_NEXT_CUE_SEC) {
        clearPauseSchedule();
        video.pause();
        log("schedulePauseBeforeTime: paused at end of previous cue", video.currentTime);
        return;
      }
      rafId = requestAnimationFrame(check);
    };
    rafId = requestAnimationFrame(check);
    pauseScheduleCleanup = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };

    pauseScheduleTimer = setTimeout(() => {
      clearPauseSchedule();
      video.pause();
      log("schedulePauseBeforeTime: safety timeout fallback pause");
    }, PAUSE_SCHEDULE_SAFETY_MS);
  }

  async function jumpToPreviousCue() {
    log("jumpToPreviousCue: called, cueIndex", cueIndex, "historyLength", cueHistory.length);
    if (cueIndex <= 0) {
      log("jumpToPreviousCue: no earlier cue available, aborting");
      return;
    }
    const video = getVideo();
    if (!video) {
      log("jumpToPreviousCue: no video element found, aborting");
      return;
    }

    cueIndex -= 1;
    const target = cueHistory[cueIndex];
    log("jumpToPreviousCue: target", target, "new cueIndex", cueIndex);

    cancelSelection();
    removePopup();

    suppressHistoryCapture = true;
    clearTimeout(suppressHistoryCaptureTimer);
    suppressHistoryCaptureTimer = setTimeout(() => { suppressHistoryCapture = false; }, 2000);

    const timeMs = Math.max(0, Math.round(target.time * 1000));
    const seeked = await seekNetflixPlayer(timeMs);
    if (!seeked) {
      log("jumpToPreviousCue: falling back to video.currentTime");
      video.currentTime = target.time;
    }

    video.play().catch((err) => log("jumpToPreviousCue: video.play() rejected", err));

    if (target.endTime != null) {
      schedulePauseBeforeTime(target.endTime);
    } else {
      video.pause();
    }
  }

  function removeAllOverlays() {
    if (activeLines.length > 0) markCueEnded();
    for (const line of activeLines) line.overlay.remove();
    activeLines = [];
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

  function getOrderedOverlays() {
    return activeLines
      .map((line) => line.overlay)
      .filter((overlay) => overlay.isConnected)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  }

  function getOrderedWordSpans() {
    const spans = [];
    for (const overlay of getOrderedOverlays()) {
      spans.push(...overlay.querySelectorAll(".nse-word"));
    }
    return spans;
  }

  function stopAccumulating() {
    clearTimeout(selectionTimer);
    selectionTimer = null;
    selectionStart = null;
    selectionEnd = null;
    document.removeEventListener("click", onSelectionOutsideClick, { capture: true });
    document.removeEventListener("keydown", onSelectionEscape);
  }

  function cancelSelection() {
    stopAccumulating();
    for (const span of document.querySelectorAll(".nse-word.selected")) {
      span.classList.remove("selected");
    }
    resyncSubtitles();
  }

  function trailingAttached(text) {
    return text.match(/\S+$/)?.[0] ?? "";
  }

  function leadingAttached(text) {
    return text.match(/^\S+/)?.[0] ?? "";
  }

  function isTerminalPunctuation(text) {
    return text.length > 0 && /^[.!?)\]"'»›]+$/.test(text);
  }

  function collectRange(startSpan, endSpan) {
    const overlays = getOrderedOverlays();
    const startOverlay = startSpan.closest(".nse-overlay");
    const endOverlay = endSpan.closest(".nse-overlay");
    const startOverlayIdx = overlays.indexOf(startOverlay);
    const endOverlayIdx = overlays.indexOf(endOverlay);
    if (startOverlayIdx === -1 || endOverlayIdx === -1) return null;

    const fromIdx = Math.min(startOverlayIdx, endOverlayIdx);
    const toIdx = Math.max(startOverlayIdx, endOverlayIdx);
    const fromSpan = startOverlayIdx <= endOverlayIdx ? startSpan : endSpan;
    const toSpan = startOverlayIdx <= endOverlayIdx ? endSpan : startSpan;

    const selectedWordSpans = [];
    let text = "";

    for (let i = fromIdx; i <= toIdx; i++) {
      const overlay = overlays[i];
      const children = [...overlay.childNodes];
      let from = i === fromIdx ? children.indexOf(fromSpan) : 0;
      let to = i === toIdx ? children.indexOf(toSpan) : children.length - 1;
      if (from === -1 || to === -1) continue;
      if (from > to) [from, to] = [to, from];

      if (i === fromIdx && from > 0) {
        const sibling = children[from - 1];
        if (sibling.nodeType === Node.TEXT_NODE) text += trailingAttached(sibling.textContent);
      }

      if (i > fromIdx) text += " ";
      for (let j = from; j <= to; j++) {
        const node = children[j];
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("nse-word")) {
          selectedWordSpans.push(node);
        }
        text += node.textContent;
      }

      if (i === toIdx && to < children.length - 1) {
        const sibling = children[to + 1];
        if (sibling.nodeType === Node.TEXT_NODE) {
          const attached = leadingAttached(sibling.textContent);
          if (isTerminalPunctuation(attached)) text += attached;
        }
      }
    }

    return { selectedWordSpans, text: text.trim().replace(/\s+/g, " ") };
  }

  function onSelectionOutsideClick(e) {
    if (e.target.closest(".nse-word")) return;
    cancelSelection();
    if (!isPopupOpen()) releaseInteraction();
  }

  function onSelectionEscape(e) {
    if (e.key !== "Escape") return;
    cancelSelection();
    if (!isPopupOpen()) releaseInteraction();
  }

  async function translateAndShowPhrase(text, anchorRect) {
    let result;
    try {
      result = await chrome.runtime.sendMessage({ type: "translate", word: text });
      log("translate response", result);
    } catch (err) {
      log("translate request threw", err);
      result = { error: true };
    }
    showPopup(anchorRect, result);
  }

  function finalizeSelection(anchorRect) {
    const range = selectionStart && selectionEnd ? collectRange(selectionStart, selectionEnd) : null;
    stopAccumulating();
    if (!range || !range.text) return;
    translateAndShowPhrase(range.text, anchorRect);
  }

  function onWordCtrlClick(span) {
    pauseForInteraction();
    clearTimeout(selectionTimer);

    const orderedSpans = getOrderedWordSpans();
    const clickedIdx = orderedSpans.indexOf(span);
    if (clickedIdx === -1) return;

    const indices = [clickedIdx];
    const startIdx = selectionStart ? orderedSpans.indexOf(selectionStart) : -1;
    const endIdx = selectionEnd ? orderedSpans.indexOf(selectionEnd) : -1;
    if (startIdx !== -1) indices.push(startIdx);
    if (endIdx !== -1) indices.push(endIdx);

    selectionStart = orderedSpans[Math.min(...indices)];
    selectionEnd = orderedSpans[Math.max(...indices)];

    const range = collectRange(selectionStart, selectionEnd);
    for (const wordSpan of orderedSpans) wordSpan.classList.remove("selected");
    if (range) {
      for (const wordSpan of range.selectedWordSpans) wordSpan.classList.add("selected");
    }

    document.addEventListener("click", onSelectionOutsideClick, { capture: true });
    document.addEventListener("keydown", onSelectionEscape);

    const anchorRect = span.getBoundingClientRect();
    selectionTimer = setTimeout(() => finalizeSelection(anchorRect), SELECTION_DEBOUNCE_MS);
  }

  async function onWordClick(e) {
    log("overlay click", e.target);
    const span = e.target.closest(".nse-word");
    if (!span) {
      log("click target is not a .nse-word span, ignoring");
      return;
    }

    e.stopPropagation();

    if (e.ctrlKey) {
      onWordCtrlClick(span);
      return;
    }

    cancelSelection();
    pauseForInteraction();

    const word = span.dataset.word.replace(NON_WORD_CHAR_REGEX, "");
    log("word clicked", word);
    if (!word) return;

    span.classList.add("selected");
    const anchorRect = span.getBoundingClientRect();

    let result;
    try {
      result = await chrome.runtime.sendMessage({ type: "translate", word });
      log("translate response", result);
    } catch (err) {
      log("translate request threw", err);
      result = { error: true };
    }
    showPopup(anchorRect, result);
  }

  function showPopup(anchorRect, result) {
    removePopup();

    const popup = document.createElement("div");
    popup.id = "nse-popup";

    if (!result || result.error) {
      const error = document.createElement("div");
      error.className = "nse-error";
      error.textContent = "Translation unavailable";
      popup.appendChild(error);
    } else {
      const wordLabel = document.createElement("div");
      wordLabel.className = "nse-word-label";
      wordLabel.textContent = result.word;
      popup.appendChild(wordLabel);

      const translation = document.createElement("div");
      translation.className = "nse-translation";
      translation.textContent = result.translation ?? "-";
      popup.appendChild(translation);

      appendEntries(popup, result.entries);
      appendDefinitions(popup, result.definitions);
      appendExamples(popup, result.examples);
    }

    getAppendTarget().appendChild(popup);
    positionPopup(popup, anchorRect);

    document.addEventListener("click", onOutsideClick, { capture: true });
    document.addEventListener("keydown", onEscape);
  }

  function appendEntries(popup, entries) {
    if (!Array.isArray(entries)) return;

    const list = document.createElement("div");
    list.className = "nse-entries";

    for (const [partOfSpeech, definitions] of entries) {
      if (!partOfSpeech || !Array.isArray(definitions)) continue;

      const row = document.createElement("div");
      row.className = "nse-entry";

      const pos = document.createElement("span");
      pos.className = "nse-pos";
      pos.textContent = partOfSpeech;

      row.appendChild(pos);
      row.appendChild(document.createTextNode(` ${definitions.slice(0, 5).join(", ")}`));
      list.appendChild(row);
    }

    popup.appendChild(list);
  }

  function appendDefinitions(popup, definitions) {
    if (!Array.isArray(definitions)) return;

    const list = document.createElement("div");
    list.className = "nse-definitions";

    for (const [partOfSpeech, defs] of definitions.slice(0, 2)) {
      if (!partOfSpeech || !Array.isArray(defs)) continue;

      for (const def of defs.slice(0, 2)) {
        const [defText, , example] = def;
        if (!defText) continue;

        const row = document.createElement("div");
        row.className = "nse-definition";

        const pos = document.createElement("span");
        pos.className = "nse-pos";
        pos.textContent = partOfSpeech;
        row.appendChild(pos);
        row.appendChild(document.createTextNode(` ${defText}`));

        if (example) {
          const exampleEl = document.createElement("div");
          exampleEl.className = "nse-def-example";
          exampleEl.textContent = example;
          row.appendChild(exampleEl);
        }

        list.appendChild(row);
      }
    }

    if (list.children.length > 0) popup.appendChild(list);
  }

  function appendHighlighted(container, html) {
    const parts = html.split(/(<b>.*?<\/b>)/g);
    for (const part of parts) {
      const match = part.match(/^<b>(.*?)<\/b>$/);
      if (match) {
        const b = document.createElement("b");
        b.textContent = match[1];
        container.appendChild(b);
      } else if (part) {
        container.appendChild(document.createTextNode(part));
      }
    }
  }

  function appendExamples(popup, examples) {
    if (!Array.isArray(examples)) return;

    const list = document.createElement("div");
    list.className = "nse-examples";

    for (const example of examples.slice(0, 3)) {
      const html = example?.[0];
      if (!html) continue;

      const row = document.createElement("div");
      row.className = "nse-example";
      appendHighlighted(row, html);
      list.appendChild(row);
    }

    if (list.children.length > 0) popup.appendChild(list);
  }

  function getSubtitleBoundsRect() {
    let top = Infinity;
    let left = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    let found = false;

    for (const line of activeLines) {
      if (!line.overlay.isConnected) continue;
      const rect = line.overlay.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      found = true;
      top = Math.min(top, rect.top);
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    }

    if (!found) return null;
    return toDocumentRect({ top, left, bottom, width: right - left, height: bottom - top });
  }

  function positionPopup(popup, anchorViewportRect) {
    const anchor = toDocumentRect(anchorViewportRect);
    const popupRect = popup.getBoundingClientRect();
    const subtitleBounds = getSubtitleBoundsRect();

    const blockTop = subtitleBounds ? Math.min(subtitleBounds.top, anchor.top) : anchor.top;
    const centerX = subtitleBounds
      ? subtitleBounds.left + subtitleBounds.width / 2
      : window.scrollX + window.innerWidth / 2;

    let top = blockTop - popupRect.height - 8;
    let left = centerX - popupRect.width / 2;

    if (top < window.scrollY + 8) top = window.scrollY + 8;
    if (left + popupRect.width > window.scrollX + window.innerWidth - 8) {
      left = window.scrollX + window.innerWidth - popupRect.width - 8;
    }
    if (left < window.scrollX + 8) left = window.scrollX + 8;

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  function removePopup() {
    const popup = document.getElementById("nse-popup");
    if (!popup) return;

    popup.remove();
    document.removeEventListener("click", onOutsideClick, { capture: true });
    document.removeEventListener("keydown", onEscape);

    cancelSelection();
    releaseInteraction();
    if (!getVideo()?.paused) blurUnheldOverlays();
  }

  function onOutsideClick(e) {
    const popup = document.getElementById("nse-popup");
    if (popup && popup.contains(e.target)) return;
    removePopup();
  }

  function onEscape(e) {
    if (e.key === "Escape") removePopup();
  }

  function watchContainer(container) {
    log("watchContainer started", container);
    currentContainer = container;
    const observer = new MutationObserver(() => processSubtitle(container));
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

  document.addEventListener("keydown", onGlobalKeydown, { capture: true });

  window.addEventListener("resize", repositionAllOverlays);

  document.addEventListener("fullscreenchange", () => {
    log("fullscreenchange", document.fullscreenElement);
    for (const line of activeLines) reparentToCurrentTarget(line.overlay);
    removePopup();
    repositionAllOverlays();
  });

  init();
})();
