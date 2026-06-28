importScripts("env.js");

const DEBUG = self.DEV_MODE ?? false;
function log(...args) {
  if (DEBUG) console.log(...args);
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: "https://getsublens.com/welcome.html" });
  }
});

log("[NSE] background service worker loaded");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  log("[NSE] background received message", msg);

  if (msg?.type === "seekNetflixPlayer") {
    seekNetflixPlayer(sender.tab?.id, msg.timeMs)
      .then((result) => sendResponse(result))
      .catch((err) => {
        log("[NSE] seekNetflixPlayer failed", err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }

  if (msg?.type === "tts") {
    if (typeof msg.text !== "string" || !msg.text.trim()) {
      sendResponse({ error: true });
      return;
    }
    fetchTts(msg.text, normalizeLang(msg.lang))
      .then((audio) => sendResponse({ audio }))
      .catch((err) => {
        log("[NSE] tts failed", err);
        sendResponse({ error: true });
      });
    return true;
  }

  if (msg?.type !== "translate") return;
  if (typeof msg.word !== "string" || !msg.word.trim()) {
    log("[NSE] invalid word, rejecting");
    sendResponse({ error: true });
    return;
  }
  resolveSourceLang(sender.tab, msg.sourceLang)
    .then((sl) => translate(msg.word, sl, normalizeLang(msg.targetLang) || "en"))
    .then((result) => {
      log("[NSE] translate succeeded", result);
      sendResponse(result);
    })
    .catch((err) => {
      log("[NSE] translate failed", err);
      sendResponse({ error: true });
    });
  return true;
});

function normalizeLang(code) {
  if (typeof code !== "string") return null;
  const primary = code.trim().toLowerCase().split("-")[0];
  return primary || null;
}

function platformFromUrl(url) {
  if (typeof url !== "string") return null;
  try {
    const host = new URL(url).hostname;
    if (/(^|\.)youtube\.com$/.test(host)) return "youtube";
    if (/(^|\.)netflix\.com$/.test(host)) return "netflix";
  } catch (err) {
    return null;
  }
  return null;
}

async function resolveSourceLang(tab, sourceSetting) {
  if (sourceSetting && sourceSetting !== "auto") return normalizeLang(sourceSetting) ?? "auto";

  const tabId = tab?.id;

  if (platformFromUrl(tab?.url) === "youtube") {
    const lang = normalizeLang(await getYouTubeSubtitleLang(tabId));
    if (lang) return lang;
    return "auto";
  }

  const track = await getNetflixSubtitleLang(tabId);
  if (track && !track.isNoneTrack && track.bcp47) {
    const lang = normalizeLang(track.bcp47);
    if (lang) return lang;
  }
  return "auto";
}

async function getYouTubeSubtitleLang(tabId) {
  if (!tabId) return null;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        try {
          const player = document.getElementById("movie_player");
          const track = player?.getOption?.("captions", "track");
          if (track) {
            const translated = track.translationLanguage?.languageCode;
            if (translated) return translated;
            if (track.languageCode) return track.languageCode;
          }
          const tracks = window.ytInitialPlayerResponse?.captions
            ?.playerCaptionsTracklistRenderer?.captionTracks;
          if (Array.isArray(tracks) && tracks[0]?.languageCode) return tracks[0].languageCode;
          return null;
        } catch (err) {
          return null;
        }
      }
    });
    return results?.[0]?.result ?? null;
  } catch (err) {
    log("[NSE] getYouTubeSubtitleLang failed", err);
    return null;
  }
}

async function getNetflixSubtitleLang(tabId) {
  if (!tabId) return null;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        try {
          const videoPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer;
          const sessionId = videoPlayer?.getAllPlayerSessionIds()?.[0];
          const player = sessionId !== undefined ? videoPlayer.getVideoPlayerBySessionId(sessionId) : null;
          const track = player?.getTimedTextTrack?.();
          if (!track) return null;
          return { bcp47: track.bcp47 ?? null, isNoneTrack: !!track.isNoneTrack };
        } catch (err) {
          return null;
        }
      }
    });
    return results?.[0]?.result ?? null;
  } catch (err) {
    log("[NSE] getNetflixSubtitleLang failed", err);
    return null;
  }
}

async function seekNetflixPlayer(tabId, timeMs) {
  if (!tabId) return { ok: false, error: "no tabId" };

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (timeMsArg) => {
      try {
        const videoPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer;
        const sessionId = videoPlayer?.getAllPlayerSessionIds()?.[0];
        const player = sessionId !== undefined ? videoPlayer.getVideoPlayerBySessionId(sessionId) : null;
        if (!player) return { ok: false, error: "player not found" };
        player.seek(timeMsArg);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
    args: [timeMs]
  });

  return results?.[0]?.result ?? { ok: false, error: "no result" };
}

async function translate(word, sl, tl) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sl);
  url.searchParams.set("tl", tl);
  url.searchParams.set("dt", "t");
  url.searchParams.append("dt", "bd");
  url.searchParams.append("dt", "md");
  url.searchParams.append("dt", "ex");
  url.searchParams.set("q", word);

  log("[NSE] fetching", url.toString());
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`translate request failed: ${res.status}`);

  const data = await res.json();
  const detectedSl = data[2] ?? sl;
  const definitionsRaw = extractDefinitionGroups(data[12]);
  let definitions = definitionsRaw;

  if (definitionsRaw) {
    try {
      definitions = await translateDefinitionGroups(definitionsRaw, detectedSl, tl);
    } catch (err) {
      log("[NSE] definitions translation failed", err);
    }
  }

  return {
    word,
    translation: data[0]?.map((segment) => segment[0]).join("") ?? null,
    entries: data[1] ?? null,
    definitions,
    examples: data[13]?.[0] ?? null,
    sourceLang: detectedSl
  };
}

async function fetchTts(text, lang) {
  if (!lang || lang === "auto") throw new Error("tts language unavailable");

  const url = new URL("https://translate.google.com/translate_tts");
  url.searchParams.set("ie", "UTF-8");
  url.searchParams.set("client", "tw-ob");
  url.searchParams.set("tl", lang);
  url.searchParams.set("q", text);

  log("[NSE] fetching tts", url.toString());
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`tts request failed: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/mpeg;base64,${btoa(binary)}`;
}

function extractDefinitionGroups(raw, maxGroups = 2, maxPerGroup = 2) {
  if (!Array.isArray(raw)) return null;

  const groups = [];
  for (const [partOfSpeech, defs] of raw.slice(0, maxGroups)) {
    if (!partOfSpeech || !Array.isArray(defs)) continue;
    groups.push([partOfSpeech, defs.slice(0, maxPerGroup)]);
  }
  return groups.length > 0 ? groups : null;
}

async function translateText(text, sl, tl) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sl);
  url.searchParams.set("tl", tl);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`translate request failed: ${res.status}`);

  const data = await res.json();
  return data[0]?.map((segment) => segment[0]).join("") ?? text;
}

async function translateDefinitionGroups(groups, sl, tl) {
  const texts = [];
  for (const [, defs] of groups) {
    for (const def of defs) texts.push(def[0] ?? "");
  }
  if (texts.length === 0) return groups;

  const translatedTexts = await Promise.all(
    texts.map((text) =>
      text
        ? translateText(text, sl, tl).catch((err) => {
            log("[NSE] definition translation failed", err);
            return text;
          })
        : text
    )
  );

  let i = 0;
  return groups.map(([partOfSpeech, defs]) => [
    partOfSpeech,
    defs.map((def) => {
      const translated = translatedTexts[i] ?? def[0];
      i += 1;
      return [translated, def[1], def[2], def[3]];
    })
  ]);
}
