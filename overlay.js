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

function onVideoPause() {
  if (settings.autoRemoveBlurOnPause) revealAllOverlays();
}

function attachVideoListeners(video) {
  if (video.dataset.nseListenersAttached) return;
  video.dataset.nseListenersAttached = "true";
  video.addEventListener("pause", onVideoPause);
  video.addEventListener("play", blurUnheldOverlays);
}

function detachVideoListeners(video) {
  if (!video.dataset.nseListenersAttached) return;
  delete video.dataset.nseListenersAttached;
  video.removeEventListener("pause", onVideoPause);
  video.removeEventListener("play", blurUnheldOverlays);
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

  const fontSize = parseFloat(computed.getPropertyValue("font-size"));
  if (!Number.isNaN(fontSize)) {
    const blur = Math.min(MAX_BLUR_PX, Math.max(MIN_BLUR_PX, fontSize * BLUR_RATIO));
    target.style.setProperty("--nse-blur", `${blur}px`);
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
  const delta = pinnedBottom !== null ? Math.min(0, pinnedBottom - naturalBottommost) : 0;

  for (const { line, rect } of rects) {
    line.overlay.style.top = `${rect.bottom + delta}px`;
    line.overlay.style.left = `${rect.left}px`;
    line.overlay.style.width = "auto";
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
    if (!LETTER_REGEX.test(part)) return document.createTextNode(part);

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
    if (settings.autoPauseOnHover) pauseForInteraction();
  });

  overlay.addEventListener("mouseleave", () => {
    delete overlay.dataset.hovered;
    if (isPopupOpen() || selectionStart !== null || translationPending) return;
    if (settings.autoPauseOnHover) releaseInteraction();
    if (!getVideo()?.paused) overlay.classList.remove("revealed");
  });

  overlay.addEventListener("mousedown", onWordMouseDown);
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
    let matchIndex = activeLines.findIndex(
      (line, idx) => !usedOldIndexes.has(idx) && line.lineEl === lineEl
    );
    if (matchIndex === -1) {
      matchIndex = activeLines.findIndex(
        (line, idx) => !usedOldIndexes.has(idx) && line.lastText === text
      );
    }

    if (matchIndex !== -1) {
      usedOldIndexes.add(matchIndex);
      const line = activeLines[matchIndex];
      line.lineEl = lineEl;
      lineEl.style.visibility = "hidden";
      if (line.lastText !== text) {
        line.overlay.replaceChildren(...buildTokens(text));
        line.lastText = text;
      }
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

function removeAllOverlays() {
  if (activeLines.length > 0) markCueEnded();
  for (const line of activeLines) {
    line.overlay.remove();
    if (line.lineEl) line.lineEl.style.visibility = "";
  }
  activeLines = [];
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
