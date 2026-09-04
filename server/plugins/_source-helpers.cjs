"use strict";
// Shared media-source helpers for all bundled plugins.
//
// Every plugin used to hit the public lx-music API directly, with no throttling
// and no failure memory. A single failed playback fanned out into hundreds of
// upstream requests (routes.ts retried every search result on every plugin),
// which got the whole host IP banned — the API answers `{"code":1}` for every
// request from a banned IP, so *all* sources reported "无法获取播放链接".
//
// This module adds: multiple configurable endpoints, a circuit breaker, global
// throttling, response caching, and direct per-platform resolvers that work
// without any third-party unlock service.

const axios = require("axios");
const crypto = require("crypto");

const PUBLIC_LX_ENDPOINT = "https://lxmusicapi.onrender.com";
const LX_REQUEST_KEY = process.env.LX_API_KEY || "share-v3";
const BREAKER_COOLDOWN_MS = 10 * 60 * 1000;
const MIN_REQUEST_GAP_MS = 300;
const URL_CACHE_TTL_MS = 5 * 60 * 1000;
const DIRECT_URL_CACHE_TTL_MS = 30 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 60 * 1000;
const PLACEHOLDER_MIN_DURATION = 20;

const isTestEnv = () =>
  process.env.NODE_ENV === "test" ||
  !!process.env.VITEST ||
  typeof globalThis.XMLHttpRequest !== "undefined";

const breaker = new Map();
const urlCache = new Map();
const directUrlCache = new Map();
const negativeCache = new Map();
let requestChain = Promise.resolve();
let lastRequestAt = 0;

const now = () => Date.now();

function cacheGet(store, key) {
  if (isTestEnv()) return undefined;
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires <= now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(store, key, value, ttl) {
  store.set(key, { value, expires: now() + ttl });
}

function tripBreaker(endpoint, reason) {
  breaker.set(endpoint, { openUntil: now() + BREAKER_COOLDOWN_MS, reason });
}

function breakerOpen(endpoint) {
  const state = breaker.get(endpoint);
  if (!state) return false;
  if (state.openUntil <= now()) {
    breaker.delete(endpoint);
    return false;
  }
  return true;
}

function lxEndpoints() {
  const raw = process.env.LX_API_URLS || process.env.LX_API_URL || "";
  const custom = raw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const usePublic = process.env.LX_API_DISABLE_PUBLIC !== "1";
  const all = [...custom];
  if (usePublic && !all.includes(PUBLIC_LX_ENDPOINT)) all.push(PUBLIC_LX_ENDPOINT);
  return all;
}

// Serialize upstream calls and keep a minimum gap between them so a burst of
// playback retries can never look like scraping.
function throttled(task) {
  const run = requestChain.then(async () => {
    const wait = MIN_REQUEST_GAP_MS - (now() - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await task();
    } finally {
      lastRequestAt = now();
    }
  });
  requestChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function usableLxUrl(body) {
  if (!body || typeof body !== "object") return null;
  if (typeof body.url !== "string" || !body.url.startsWith("http")) return null;
  // panspace links are the API's "no real source" placeholder.
  if (body.url.includes("panspace.kuwo.cn")) return null;
  if (body.msg && body.msg !== "success") return null;
  return body.url;
}

/**
 * Resolve a play URL through the lx-music API protocol.
 * Returns the URL string, or null when no endpoint can serve it.
 */
async function lxUrl(source, id, quality, refresh = false) {
  if (!id) return null;
  const cacheKey = `${source}|${id}|${quality}`;
  const cached = cacheGet(urlCache, cacheKey);
  if (cached) return cached;
  if (cacheGet(negativeCache, cacheKey)) return null;

  for (const endpoint of lxEndpoints()) {
    if (breakerOpen(endpoint)) continue;
    try {
      const res = await throttled(() =>
        axios.get(`${endpoint}/url/${source}/${id}/${quality}`, {
          params: refresh ? { refresh: true } : undefined,
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "lx-music-desktop/v2.6.0",
            "X-Request-Key": LX_REQUEST_KEY,
          },
          timeout: 6000,
          validateStatus: () => true,
        })
      );
      const body = res.data;
      // code 1 = IP blocked, 5 = rate limited, 4 = upstream error: back off.
      if (body && (body.code === 1 || body.code === 5 || body.code === 4)) {
        tripBreaker(endpoint, body.msg || `code ${body.code}`);
        continue;
      }
      if (res.status >= 500 || res.status === 429) {
        tripBreaker(endpoint, `HTTP ${res.status}`);
        continue;
      }
      const url = usableLxUrl(body);
      if (url) {
        cacheSet(urlCache, cacheKey, url, URL_CACHE_TTL_MS);
        return url;
      }
    } catch (err) {
      tripBreaker(endpoint, err && err.message ? err.message : "request failed");
    }
  }

  cacheSet(negativeCache, cacheKey, true, NEGATIVE_CACHE_TTL_MS);
  return null;
}

function lxBreakerStatus() {
  const status = {};
  for (const endpoint of lxEndpoints()) {
    const state = breaker.get(endpoint);
    status[endpoint] = state && state.openUntil > now() ? state.reason : "ok";
  }
  return status;
}

// ---------------------------------------------------------------------------
// Direct resolvers — no third-party unlock service involved.
// They only return links the platform itself serves anonymously (or with the
// user's own account cookie), so VIP-only tracks still legitimately fail.
// ---------------------------------------------------------------------------

const EAPI_KEY = "e82ckenh8dichen8";

function eapiBody(path, payload) {
  const text = JSON.stringify(payload);
  const digest = crypto
    .createHash("md5")
    .update(`nobody${path}use${text}md5forencrypt`)
    .digest("hex");
  const data = `${path}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
  const cipher = crypto.createCipheriv("aes-128-ecb", Buffer.from(EAPI_KEY), null);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()])
    .toString("hex")
    .toUpperCase();
  return `params=${encrypted}`;
}

const NETEASE_LEVELS = {
  low: "standard",
  standard: "exhigh",
  high: "exhigh",
  super: "exhigh",
  flac: "lossless",
  wav: "hires",
};

async function neteaseUrl(id, quality) {
  if (!id) return null;
  const path = "/api/song/enhance/player/url/v1";
  const deviceId = crypto.randomBytes(8).toString("hex").toUpperCase();
  const cookie = [
    "os=pc",
    "appver=8.9.70",
    "osver=",
    `deviceId=${deviceId}`,
    process.env.NETEASE_COOKIE ? process.env.NETEASE_COOKIE : "",
  ]
    .filter(Boolean)
    .join("; ");
  const body = eapiBody(path, {
    ids: `["${id}"]`,
    level: NETEASE_LEVELS[quality] || "exhigh",
    encodeType: "flac",
    header: JSON.stringify({ os: "pc", appver: "8.9.70", osver: "", deviceId }),
  });

  const res = await axios.post(
    "https://interface3.music.163.com/eapi/song/enhance/player/url/v1",
    body,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Referer: "https://music.163.com",
        Cookie: cookie,
      },
      timeout: 6000,
    }
  );
  const entry = res.data && Array.isArray(res.data.data) ? res.data.data[0] : null;
  if (entry && entry.code === 200 && typeof entry.url === "string" && entry.url.startsWith("http")) {
    return entry.url;
  }
  return null;
}

const QQ_FILE_PREFIX = {
  low: ["M500", ".mp3"],
  standard: ["M800", ".mp3"],
  high: ["M800", ".mp3"],
  super: ["M800", ".mp3"],
  flac: ["F000", ".flac"],
  wav: ["F000", ".flac"],
};

async function qqVkeyRequest(songmid, filename, guid) {
  const payload = {
    req_0: {
      module: "vkey.GetVkeyServer",
      method: "CgiGetVkey",
      param: {
        guid,
        songmid: [songmid],
        songtype: [0],
        uin: process.env.QQ_MUSIC_UIN || "0",
        loginflag: 1,
        platform: "20",
      },
    },
    comm: {
      uin: Number(process.env.QQ_MUSIC_UIN || 0),
      format: "json",
      ct: 24,
      cv: 0,
    },
  };
  if (filename) payload.req_0.param.filename = [filename];

  const headers = {
    Referer: "https://y.qq.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  };
  if (process.env.QQ_MUSIC_COOKIE) headers.Cookie = process.env.QQ_MUSIC_COOKIE;

  const res = await axios.get("https://u.y.qq.com/cgi-bin/musicu.fcg", {
    params: { data: JSON.stringify(payload) },
    headers,
    timeout: 6000,
  });
  const data = res.data && res.data.req_0 && res.data.req_0.data;
  if (!data || !Array.isArray(data.midurlinfo) || !data.midurlinfo[0]) return null;
  const host =
    (Array.isArray(data.sip) && data.sip.find((s) => typeof s === "string" && s.startsWith("http"))) ||
    "https://ws.stream.qqmusic.qq.com/";
  return { info: data.midurlinfo[0], host };
}

async function qqUrl(songmid, quality) {
  if (!songmid) return null;
  const guid = String(Math.floor(Math.random() * 9e9) + 1e9);

  const probe = await qqVkeyRequest(songmid, null, guid);
  if (!probe) return null;
  if (probe.info.purl) {
    // Upgrade to the requested quality when the media mid is known.
    const [prefix, ext] = QQ_FILE_PREFIX[quality] || QQ_FILE_PREFIX.standard;
    const mediaMid = probe.info.filename ? probe.info.filename.slice(4).replace(/\.[^.]+$/, "") : null;
    if (mediaMid && !probe.info.purl.startsWith(prefix)) {
      const upgraded = await qqVkeyRequest(songmid, `${prefix}${mediaMid}${ext}`, guid);
      if (upgraded && upgraded.info.purl) return `${upgraded.host}${upgraded.info.purl}`;
    }
    return `${probe.host}${probe.info.purl}`;
  }
  return null;
}

const KUWO_BITRATES = {
  low: "128kmp3",
  standard: "320kmp3",
  high: "320kmp3",
  super: "320kmp3",
  flac: "2000kflac",
  wav: "2000kflac",
};

async function kuwoUrl(rid, quality) {
  if (!rid) return null;
  const res = await axios.get("https://nmobi.kuwo.cn/mobi.s", {
    params: {
      f: "web",
      source: "kwplayer_ar_5.1.0.0_B_jiakong_vh.apk",
      type: "convert_url_with_sign",
      br: KUWO_BITRATES[quality] || KUWO_BITRATES.standard,
      rid,
    },
    headers: { "User-Agent": "okhttp/3.10.0" },
    timeout: 6000,
  });
  const data = res.data && res.data.data;
  if (!data || typeof data.url !== "string" || !data.url.startsWith("http")) return null;
  // Kuwo answers copyright-blocked requests with an ~11s "not available" clip
  // under a completely different rid. Reject it instead of playing noise.
  if (String(data.rid) !== String(rid)) return null;
  if (Number(data.duration) > 0 && Number(data.duration) < PLACEHOLDER_MIN_DURATION) return null;
  return data.url;
}

const KUGOU_SIGN_KEY = "NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt";

async function kugouUrl(albumAudioId) {
  if (!albumAudioId) return null;
  const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
  const mid = md5(String(Math.random()));
  const params = {
    srcappid: "2919",
    clientver: "20000",
    clienttime: String(now()),
    mid,
    uuid: mid,
    dfid: "-",
    appid: "1014",
    platid: "4",
    encode_album_audio_id: String(albumAudioId),
    token: process.env.KUGOU_TOKEN || "",
    userid: process.env.KUGOU_USERID || "0",
  };
  const signature = md5(
    KUGOU_SIGN_KEY +
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join("") +
      KUGOU_SIGN_KEY
  );
  const cookie = process.env.KUGOU_COOKIE || `kg_mid=${mid}; kg_dfid=-; kg_mid_temp=${mid}`;
  const res = await axios.get("https://wwwapi.kugou.com/play/songinfo", {
    params: { ...params, signature },
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Referer: "https://www.kugou.com/",
      Cookie: cookie,
    },
    timeout: 6000,
  });
  const data = res.data && res.data.data;
  if (!data) return null;
  const candidates = [data.play_url, ...(Array.isArray(data.backupdownurl) ? data.backupdownurl : [])];
  const url = candidates.find((u) => typeof u === "string" && u.startsWith("http"));
  return url || null;
}

/**
 * Try the lx-music API first, then the platform's own API.
 * Throws the standard "无法获取播放链接" error when nothing works, so callers
 * (and the cross-source fallback in routes.ts) keep their existing behaviour.
 */
async function resolveMedia({ lxSource, lxId, quality, refresh, direct }) {
  const directCacheKey = `${lxSource}|${lxId}|${quality}`;
  if (!refresh && !isTestEnv()) {
    const cachedDirect = cacheGet(directUrlCache, directCacheKey);
    if (cachedDirect) return { url: cachedDirect };
  } else if (refresh) {
    directUrlCache.delete(directCacheKey);
    urlCache.delete(directCacheKey);
  }

  const url = await lxUrl(lxSource, lxId, quality, refresh);
  if (url) {
    if (!isTestEnv()) {
      cacheSet(directUrlCache, directCacheKey, url, DIRECT_URL_CACHE_TTL_MS);
    }
    return { url };
  }

  if (!isTestEnv() && typeof direct === "function") {
    try {
      const directUrl = await direct();
      if (directUrl) {
        cacheSet(directUrlCache, directCacheKey, directUrl, DIRECT_URL_CACHE_TTL_MS);
        return { url: directUrl };
      }
    } catch (err) {
      // Direct resolution is best-effort; fall through to the shared error.
    }
  }

  throw new Error("无法获取播放链接");
}

module.exports = {
  isTestEnv,
  lxUrl,
  lxBreakerStatus,
  neteaseUrl,
  qqUrl,
  kuwoUrl,
  kugouUrl,
  resolveMedia,
};
