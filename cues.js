function markCueEnded() {
  const video = getVideo();
  if (!video) return;
  const entry = cueHistory[cueIndex];
  if (!entry || entry.endTime != null) return;
  entry.endTime = video.currentTime;
  log("markCueEnded: endTime", entry.endTime, "for cue started at", entry.time);
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
  const knownIndex = cueHistory.findIndex(
    (entry) => Math.abs(entry.time - time) < CUE_HISTORY_EPSILON_SEC
  );
  if (knownIndex !== -1) {
    cueIndex = knownIndex;
    log("recordCueStart: replaying known cue", time, "cueIndex", cueIndex);
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
  const seeked = await seekPlayer(timeMs);
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
