const DEBUG = true;
function log(...args) {
  if (DEBUG) console.log("[NSE]", ...args);
}

const SELECTOR_CHAIN = PLATFORM.subtitleSelectors;
const CONTROLS_SELECTOR_CHAIN = PLATFORM.controlsSelectors;
const FALLBACK_CONTROLS_HEIGHT = 110;
const BLUR_RATIO = 0.24;
const MIN_BLUR_PX = 6;
const MAX_BLUR_PX = 22;
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
const TOKEN_REGEX = /[\p{L}\p{M}'’]+|[^\p{L}\p{M}'’]+/gu;
const NON_WORD_CHAR_REGEX = /[^\p{L}\p{M}'’]/gu;
const LETTER_REGEX = /\p{L}/u;

const SELECTION_DEBOUNCE_MS = 1200;
const CUE_HISTORY_EPSILON_SEC = 0.05;
const PAUSE_BEFORE_NEXT_CUE_SEC = 0.05;
const PAUSE_SCHEDULE_SAFETY_MS = 15000;

let activeLines = [];
let currentContainer = null;
let maxControlsHeight = 0;

let extensionPaused = false;
let wasPlayingBeforePause = false;
let selectionStart = null;
let selectionEnd = null;
let selectionTimer = null;

let dragAnchor = null;
let dragActive = false;
let suppressClickAfterDrag = false;
let translationPending = false;

let cueHistory = [];
let cueIndex = -1;
let suppressHistoryCapture = false;
let suppressHistoryCaptureTimer = null;
let pauseScheduleCleanup = null;
let pauseScheduleTimer = null;

let settings = { ...NSE_SETTINGS_DEFAULTS };

function applyBlurSettingToAllOverlays() {
  document.documentElement.classList.toggle("nse-blur-disabled", !settings.subtitleBlurEnabled);
}

function getVideo() {
  return document.querySelector("video");
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
