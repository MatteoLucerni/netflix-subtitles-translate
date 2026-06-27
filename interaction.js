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
  stopDragTracking();
  dragAnchor = null;
  dragActive = false;
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
  removePopupElement();
  translationPending = true;
  let result;
  try {
    result = await chrome.runtime.sendMessage({
      type: "translate",
      word: text,
      sourceLang: settings.subtitleSourceLang,
      targetLang: settings.translationTargetLang
    });
    log("translate response", result);
  } catch (err) {
    log("translate request threw", err);
    result = { error: true };
  }
  translationPending = false;
  showPopup(anchorRect, result);
}

function finalizeSelection(anchorRect) {
  const range = selectionStart && selectionEnd ? collectRange(selectionStart, selectionEnd) : null;
  stopAccumulating();
  if (!range || !range.text) return;
  translateAndShowPhrase(range.text, anchorRect);
}

function applySelectionHighlight(range) {
  for (const wordSpan of getOrderedWordSpans()) wordSpan.classList.remove("selected");
  if (range) {
    for (const wordSpan of range.selectedWordSpans) wordSpan.classList.add("selected");
  }
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

  applySelectionHighlight(collectRange(selectionStart, selectionEnd));

  document.addEventListener("click", onSelectionOutsideClick, { capture: true });
  document.addEventListener("keydown", onSelectionEscape);

  const anchorRect = span.getBoundingClientRect();
  selectionTimer = setTimeout(() => finalizeSelection(anchorRect), SELECTION_DEBOUNCE_MS);
}

function stopDragTracking() {
  document.removeEventListener("mousemove", onWordDragMove);
  document.removeEventListener("mouseup", onWordDragEnd);
  document.removeEventListener("keydown", onDragEscape);
}

function onWordMouseDown(e) {
  if (e.button !== 0 || e.ctrlKey) return;
  const span = e.target.closest(".nse-word");
  if (!span) return;

  e.preventDefault();
  e.stopPropagation();
  cancelSelection();

  dragAnchor = span;
  dragActive = false;
  selectionStart = span;
  selectionEnd = span;
  applySelectionHighlight(collectRange(span, span));
  pauseForInteraction();

  document.addEventListener("mousemove", onWordDragMove);
  document.addEventListener("mouseup", onWordDragEnd);
  document.addEventListener("keydown", onDragEscape);
}

function onWordDragMove(e) {
  if (e.buttons === 0) {
    onWordDragEnd(e);
    return;
  }

  const span = e.target.closest(".nse-word");
  if (!span || span === selectionEnd) return;

  dragActive = true;
  selectionEnd = span;
  applySelectionHighlight(collectRange(dragAnchor, span));
}

function onWordDragEnd(e) {
  stopDragTracking();

  const anchor = dragAnchor;
  const wasDrag = dragActive;
  dragAnchor = null;
  dragActive = false;

  if (!wasDrag) {
    cancelSelection();
    return;
  }

  e.preventDefault();
  suppressClickAfterDrag = true;
  setTimeout(() => {
    suppressClickAfterDrag = false;
  }, 0);

  const endSpan = selectionEnd ?? anchor;
  const range = collectRange(anchor, endSpan);
  stopAccumulating();

  if (!range || !range.text) return;

  const anchorRect = endSpan.getBoundingClientRect();
  translateAndShowPhrase(range.text, anchorRect);
}

function onDragEscape(e) {
  if (e.key !== "Escape") return;
  stopDragTracking();
  dragAnchor = null;
  dragActive = false;
  cancelSelection();
  if (!isPopupOpen()) releaseInteraction();
}

async function onWordClick(e) {
  log("overlay click", e.target);

  if (suppressClickAfterDrag) {
    suppressClickAfterDrag = false;
    e.stopPropagation();
    return;
  }

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
  await translateAndShowPhrase(word, anchorRect);
}

function showPopup(anchorRect, result) {
  removePopupElement();

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

function removePopupElement() {
  const popup = document.getElementById("nse-popup");
  if (!popup) return false;

  popup.remove();
  document.removeEventListener("click", onOutsideClick, { capture: true });
  document.removeEventListener("keydown", onEscape);
  return true;
}

function removePopup() {
  if (!removePopupElement()) return;

  cancelSelection();
  releaseInteraction();
  if (!getVideo()?.paused) blurUnheldOverlays();
}

function onOutsideClick(e) {
  if (suppressClickAfterDrag) return;
  if (e.target.closest(".nse-word")) return;
  const popup = document.getElementById("nse-popup");
  if (popup && popup.contains(e.target)) return;
  removePopup();
}

function onEscape(e) {
  if (e.key === "Escape") removePopup();
}
