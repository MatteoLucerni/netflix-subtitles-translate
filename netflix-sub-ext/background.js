console.log("[NSE] background service worker loaded");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[NSE] background received message", msg);

  if (msg?.type === "seekNetflixPlayer") {
    seekNetflixPlayer(sender.tab?.id, msg.timeMs)
      .then((result) => sendResponse(result))
      .catch((err) => {
        console.log("[NSE] seekNetflixPlayer failed", err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }

  if (msg?.type !== "translate") return;
  if (typeof msg.word !== "string" || !msg.word.trim()) {
    console.log("[NSE] invalid word, rejecting");
    sendResponse({ error: true });
    return;
  }
  translate(msg.word)
    .then((result) => {
      console.log("[NSE] translate succeeded", result);
      sendResponse(result);
    })
    .catch((err) => {
      console.log("[NSE] translate failed", err);
      sendResponse({ error: true });
    });
  return true;
});

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

async function translate(word) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", "it");
  url.searchParams.set("dt", "t");
  url.searchParams.append("dt", "bd");
  url.searchParams.append("dt", "md");
  url.searchParams.append("dt", "ex");
  url.searchParams.set("q", word);

  console.log("[NSE] fetching", url.toString());
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`translate request failed: ${res.status}`);

  const data = await res.json();
  const definitionsRaw = extractDefinitionGroups(data[12]);
  let definitions = definitionsRaw;

  if (definitionsRaw) {
    try {
      definitions = await translateDefinitionGroups(definitionsRaw);
    } catch (err) {
      console.log("[NSE] definitions translation failed", err);
    }
  }

  return {
    word,
    translation: data[0]?.map((segment) => segment[0]).join("") ?? null,
    entries: data[1] ?? null,
    definitions,
    examples: data[13]?.[0] ?? null
  };
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

async function translateText(text) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", "it");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`translate request failed: ${res.status}`);

  const data = await res.json();
  return data[0]?.map((segment) => segment[0]).join("") ?? text;
}

async function translateDefinitionGroups(groups) {
  const texts = [];
  for (const [, defs] of groups) {
    for (const def of defs) texts.push(def[0] ?? "");
  }
  if (texts.length === 0) return groups;

  const delimiter = "\n||\n";
  const translatedJoined = await translateText(texts.join(delimiter));
  const translatedTexts = translatedJoined.split("||").map((text) => text.trim());

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
