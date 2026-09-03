// ==UserScript==
// @name        CS2 VACnet Labeling Portal Enhancer
// @namespace   https://github.com/Mark7888/vacnet-tampermonkey
// @version     1.0.0-edge.20260903.1607
// @description Full clip playback, keyboard controls, resizable panels and other usability tweaks for the CS2 VACnet video labeling portal.
// @author      Mark7888
// @homepageURL https://github.com/Mark7888/vacnet-tampermonkey
// @supportURL  https://github.com/Mark7888/vacnet-tampermonkey/issues
// @downloadURL https://raw.githubusercontent.com/Mark7888/vacnet-tampermonkey/dist/vacnet-enhancer.user.js
// @updateURL   https://raw.githubusercontent.com/Mark7888/vacnet-tampermonkey/dist/vacnet-enhancer.meta.js
// @match       https://www.counter-strike.net/vacnet*
// @match       https://counter-strike.net/vacnet*
// @grant       none
// @run-at      document-start
// @noframes
// ==/UserScript==
// build: edge channel, commit 1f3ce403026b3d4bd97990d6ee9744a4462cb6d9, 2026-09-03T16:07:38.465Z

(function () {
'use strict';

"use strict";
(() => {
  // src/util.ts
  function log(...args) {
    console.log("[vacnet-enhancer]", ...args);
  }
  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }
  function el(tag, options = {}) {
    const node2 = document.createElement(tag);
    if (options.class) node2.className = options.class;
    if (options.text !== void 0) node2.textContent = options.text;
    if (options.html !== void 0) node2.innerHTML = options.html;
    for (const [name, value] of Object.entries(options.attrs ?? {})) {
      node2.setAttribute(name, value);
    }
    for (const child of options.children ?? []) {
      if (child) node2.appendChild(child);
    }
    return node2;
  }
  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }
  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "--:--";
    const sign = seconds < 0 ? "-" : "";
    const abs = Math.abs(seconds);
    const mins = Math.floor(abs / 60);
    const secs = abs - mins * 60;
    return `${sign}${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(1)}`;
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
    }
    try {
      const area = el("textarea", { attrs: { readonly: "readonly" } });
      area.value = text;
      area.style.cssText = "position:fixed;top:-1000px;opacity:0;";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }

  // src/clamp.ts
  var hookInstalled = false;
  var suppressed = false;
  var patchedTimers = 0;
  function isClipWindowTimer(handler, timeout) {
    if (typeof handler !== "function") return false;
    if (timeout !== void 0 && timeout > 1e3) return false;
    let source = "";
    try {
      source = Function.prototype.toString.call(handler);
    } catch {
      return false;
    }
    return /currentTime\s*\(/.test(source) && /(startTime|endTime)/.test(source);
  }
  function installClampHook() {
    if (hookInstalled) return;
    const original2 = window.setInterval;
    const patched = function(handler, timeout, ...args) {
      if (isClipWindowTimer(handler, timeout)) {
        patchedTimers += 1;
        const inner = handler;
        const wrapper = function(...callbackArgs) {
          if (suppressed) return void 0;
          return inner.apply(this, callbackArgs);
        };
        return original2.call(window, wrapper, timeout, ...args);
      }
      return original2.call(window, handler, timeout, ...args);
    };
    window.setInterval = patched;
    hookInstalled = true;
    log("clip-window hook installed");
  }
  function isClampHooked() {
    return patchedTimers > 0;
  }
  function isClampSuppressed() {
    return suppressed;
  }
  function setClampSuppressed(value) {
    suppressed = value;
  }

  // src/player.ts
  var cachedMedia = null;
  var cachedRange;
  function getMedia() {
    if (cachedMedia && cachedMedia.isConnected) return cachedMedia;
    cachedMedia = document.querySelector(".videocontainer video, video#video, video");
    return cachedMedia;
  }
  function getPlayerRoot() {
    return document.querySelector(".videocontainer .video-js") ?? document.querySelector(".videocontainer video");
  }
  function getVideoJsPlayer() {
    const videojs = window.videojs;
    try {
      return videojs?.getPlayer?.("video") ?? null;
    } catch {
      return null;
    }
  }
  function getClipRange() {
    if (cachedRange !== void 0) return cachedRange;
    cachedRange = parseClipRange();
    return cachedRange;
  }
  function parseClipRange() {
    const number = "(-?\\d+(?:\\.\\d+)?)";
    const startRe = new RegExp(`startTime\\s*=\\s*${number}`);
    const durationRe = new RegExp(`endTime\\s*=\\s*startTime\\s*\\+\\s*${number}`);
    const endRe = new RegExp(`endTime\\s*=\\s*${number}`);
    const eventRe = new RegExp(`eventTime\\s*=\\s*${number}`);
    for (const script of Array.from(document.querySelectorAll("script"))) {
      const text = script.textContent;
      if (!text || !text.includes("startTime")) continue;
      const start = startRe.exec(text);
      if (!start) continue;
      const startTime = Number(start[1]);
      const duration = durationRe.exec(text);
      const absoluteEnd = endRe.exec(text);
      const endTime = duration ? startTime + Number(duration[1]) : absoluteEnd ? Number(absoluteEnd[1]) : NaN;
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) continue;
      const event = eventRe.exec(text);
      return {
        start: startTime,
        end: endTime,
        event: event ? Number(event[1]) : null
      };
    }
    return null;
  }
  function getClipVideoUrl() {
    const media = getMedia();
    if (media?.currentSrc) return media.currentSrc;
    const source = document.querySelector(".videocontainer source[src]");
    return source?.src ?? null;
  }
  function getClipPageUrl() {
    const link = document.querySelector('a[href*="/vacnet/view"]');
    return link?.href ?? null;
  }

  // src/ui/toast.ts
  var node = null;
  var hideTimer;
  function toast(message) {
    if (!node || !node.isConnected) {
      node = el("div", { class: "vnh-toast" });
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.remove("vnh-show");
    void node.offsetWidth;
    node.classList.add("vnh-show");
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => node?.classList.remove("vnh-show"), 1400);
  }

  // src/keyboard.ts
  var RATES = [0.05, 0.1, 0.15, 0.25, 0.4, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  var FRAME = 1 / 60;
  function activeRange(media) {
    const range = getClipRange();
    if (range && !isClampSuppressed()) return { start: range.start, end: range.end };
    const duration = Number.isFinite(media.duration) ? media.duration : Number.MAX_SAFE_INTEGER;
    return { start: 0, end: duration };
  }
  function seekTo(media, time) {
    const { start, end } = activeRange(media);
    media.currentTime = clamp(time, start, Math.max(start, end - 0.03));
  }
  function seekBy(media, delta) {
    seekTo(media, media.currentTime + delta);
  }
  function stepFrame(media, direction) {
    if (!media.paused) media.pause();
    seekBy(media, direction * FRAME);
  }
  function changeVolume(media, delta) {
    const volume = clamp(media.volume + delta, 0, 1);
    media.volume = volume;
    if (volume > 0) media.muted = false;
    toast(`Volume ${Math.round(volume * 100)}%`);
  }
  function changeRate(media, direction) {
    let index = 0;
    let best = Number.POSITIVE_INFINITY;
    RATES.forEach((rate, i) => {
      const distance = Math.abs(rate - media.playbackRate);
      if (distance < best) {
        best = distance;
        index = i;
      }
    });
    const next = RATES[clamp(index + direction, 0, RATES.length - 1)];
    media.playbackRate = next;
    toast(`Speed ${next}x`);
  }
  function toggleFullscreen() {
    const player = getVideoJsPlayer();
    if (player?.requestFullscreen && player.isFullscreen) {
      if (player.isFullscreen()) player.exitFullscreen?.();
      else player.requestFullscreen();
      return;
    }
    const root = getPlayerRoot();
    if (!root) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.requestFullscreen();
  }
  function shouldIgnore(event) {
    if (event.ctrlKey || event.metaKey) return true;
    const target = event.target;
    if (target) {
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      if (tag === "TEXTAREA" || tag === "SELECT") return true;
      if (tag === "INPUT") {
        const type = target.type;
        if (!["radio", "checkbox", "button", "submit", "reset"].includes(type)) return true;
      }
    }
    const detailsModal = document.getElementById("detailsModalOverlay");
    if (detailsModal && detailsModal.style.display === "block") return true;
    return false;
  }
  function normalizeKey(event) {
    if (event.key === " " || event.code === "Space") return "space";
    if (event.key.length === 1) return event.key.toLowerCase();
    return event.key.toLowerCase();
  }
  function installKeyboard(actions) {
    try {
      getVideoJsPlayer()?.playbackRates?.(RATES);
    } catch {
    }
    window.addEventListener("keydown", (event) => {
      const key = normalizeKey(event);
      if (key === "escape" && actions.closeHelp()) {
        event.preventDefault();
        return;
      }
      if (event.repeat && (key === "c" || key === "e")) return;
      if (shouldIgnore(event)) return;
      const media = getMedia();
      if (!media) return;
      const step = event.shiftKey ? 5 : event.altKey ? 0.1 : 1;
      let handled = true;
      switch (key) {
        case "space":
        case "k":
          if (media.paused) void media.play();
          else media.pause();
          break;
        case "arrowright":
          seekBy(media, step);
          break;
        case "arrowleft":
          seekBy(media, -step);
          break;
        case "l":
          seekBy(media, 5);
          break;
        case "j":
          seekBy(media, -5);
          break;
        case ".":
        case ">":
          stepFrame(media, 1);
          break;
        case ",":
        case "<":
          stepFrame(media, -1);
          break;
        case "arrowup":
          changeVolume(media, 0.05);
          break;
        case "arrowdown":
          changeVolume(media, -0.05);
          break;
        case "m":
          media.muted = !media.muted;
          toast(media.muted ? "Muted" : "Unmuted");
          break;
        case "f":
          toggleFullscreen();
          break;
        case "-":
        case "_":
          changeRate(media, -1);
          break;
        case "+":
        case "=":
          changeRate(media, 1);
          break;
        case "backspace":
          media.playbackRate = 1;
          toast("Speed 1x");
          break;
        case "home":
          seekTo(media, activeRange(media).start);
          break;
        case "end":
          seekTo(media, activeRange(media).end);
          break;
        case "c":
          actions.toggleFullContext();
          break;
        case "e":
          actions.toggleExpertView();
          break;
        case "y":
          actions.copyClipLink();
          break;
        case "/":
        case "?":
          actions.toggleHelp();
          break;
        default:
          handled = false;
      }
      if (!handled && key.length === 1 && key >= "0" && key <= "9") {
        const { start, end } = activeRange(media);
        seekTo(media, start + (end - start) * (Number(key) / 10));
        handled = true;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  // src/settings.ts
  var STORAGE_KEY = "vacnetEnhancer.settings.v1";
  var DEFAULTS = {
    fullContext: false,
    expertView: false
  };
  var current = { ...DEFAULTS };
  function loadSettings() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        current = { ...DEFAULTS, ...parsed };
      }
    } catch {
      current = { ...DEFAULTS };
    }
    return current;
  }
  function getSettings() {
    return current;
  }
  function updateSettings(patch2) {
    current = { ...current, ...patch2 };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
    }
    return current;
  }

  // src/styles.ts
  var CSS = `
:root {
	--vnh-accent: #d5903a;
	--vnh-text: #c6d4df;
	--vnh-text-dim: #8fa0ad;
	--vnh-panel: rgba(16, 19, 23, 0.78);
	--vnh-panel-solid: #14181d;
	--vnh-border: rgba(198, 212, 223, 0.18);
	--vnh-border-strong: rgba(198, 212, 223, 0.34);
}

.vnh-toolbar {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	box-sizing: border-box;
	width: 100%;
	margin: 0 0 8px 0;
	padding: 7px 10px;
	background: var(--vnh-panel);
	border: 1px solid var(--vnh-border);
	border-radius: 3px;
	color: var(--vnh-text);
	font-size: 12px;
	line-height: 1.4;
}

.vnh-toolbar .vnh-spacer { flex: 1 1 auto; }

.vnh-btn {
	appearance: none;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	margin: 0;
	padding: 5px 10px;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid var(--vnh-border);
	border-radius: 2px;
	color: var(--vnh-text);
	font: inherit;
	font-size: 11px;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	cursor: pointer;
	transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.vnh-btn:hover {
	background: rgba(255, 255, 255, 0.11);
	border-color: var(--vnh-border-strong);
	color: #fff;
}

.vnh-btn:active { background: rgba(255, 255, 255, 0.04); }

.vnh-btn[aria-pressed="true"] {
	border-color: var(--vnh-accent);
	color: var(--vnh-accent);
}

.vnh-btn-icon {
	width: 26px;
	justify-content: center;
	padding: 5px 0;
	font-size: 12px;
}

.vnh-check {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 8px 4px 6px;
	border: 1px solid transparent;
	border-radius: 2px;
	cursor: pointer;
	user-select: none;
	white-space: nowrap;
}

.vnh-check:hover { border-color: var(--vnh-border); }
.vnh-check input { accent-color: var(--vnh-accent); margin: 0; cursor: pointer; }
.vnh-check.vnh-on { color: var(--vnh-accent); }

.vnh-readout {
	font-variant-numeric: tabular-nums;
	font-size: 11px;
	color: var(--vnh-text-dim);
	white-space: nowrap;
}

.vnh-readout b { color: var(--vnh-text); font-weight: 600; }
.vnh-warn { color: #d47b6a; }

/*
 * Expert view is applied as inline !important styles (see src/ui/expert.ts),
 * because the portal's own selectors are more specific than anything we could
 * write here. Only our own toolbar needs styling from this side.
 */
html.vnh-expert .vnh-toolbar { margin-bottom: 6px; flex: 0 0 auto; }

/* --- toast ------------------------------------------------------------- */
.vnh-toast {
	position: fixed;
	left: 50%;
	bottom: 48px;
	z-index: 2147483000;
	transform: translate(-50%, 8px);
	padding: 8px 14px;
	background: var(--vnh-panel-solid);
	border: 1px solid var(--vnh-border-strong);
	border-left: 3px solid var(--vnh-accent);
	border-radius: 2px;
	color: var(--vnh-text);
	font-size: 13px;
	pointer-events: none;
	opacity: 0;
	transition: opacity 0.15s ease, transform 0.15s ease;
}

.vnh-toast.vnh-show { opacity: 1; transform: translate(-50%, 0); }

/* --- shortcut help ----------------------------------------------------- */
.vnh-modal {
	position: fixed;
	inset: 0;
	z-index: 2147483001;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.62);
}

.vnh-modal[hidden] { display: none; }

.vnh-modal-card {
	width: min(620px, calc(100vw - 40px));
	max-height: calc(100vh - 80px);
	overflow: auto;
	background: var(--vnh-panel-solid);
	border: 1px solid var(--vnh-border-strong);
	border-radius: 3px;
	color: var(--vnh-text);
	box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
}

.vnh-modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 14px;
	border-bottom: 1px solid var(--vnh-border);
	font-size: 13px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--vnh-accent);
}

.vnh-modal-close {
	cursor: pointer;
	padding: 0 4px;
	color: var(--vnh-text-dim);
	font-size: 15px;
	line-height: 1;
}

.vnh-modal-close:hover { color: #fff; }

.vnh-modal-body { padding: 12px 14px 16px; }

.vnh-keys {
	width: 100%;
	border-collapse: collapse;
	font-size: 12.5px;
}

.vnh-keys td { padding: 4px 6px; vertical-align: top; }
.vnh-keys tr + tr td { border-top: 1px solid rgba(198, 212, 223, 0.08); }
.vnh-keys td:first-child { width: 34%; white-space: nowrap; }
.vnh-keys .vnh-section td {
	padding-top: 12px;
	color: var(--vnh-accent);
	font-size: 11px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
}

.vnh-modal-body kbd {
	display: inline-block;
	min-width: 10px;
	padding: 2px 6px;
	background: rgba(255, 255, 255, 0.07);
	border: 1px solid var(--vnh-border);
	border-bottom-width: 2px;
	border-radius: 3px;
	font-family: inherit;
	font-size: 11px;
	color: #fff;
}

.vnh-note { margin: 12px 0 0; color: var(--vnh-text-dim); font-size: 11.5px; line-height: 1.5; }
`;
  function injectStyles() {
    if (document.getElementById("vnh-styles")) return;
    const style = el("style", { text: CSS });
    style.id = "vnh-styles";
    (document.head ?? document.documentElement).appendChild(style);
  }
  function applyAccentFromPage() {
    const sample = document.querySelector(".highlight-text") ?? document.querySelector(".list-title") ?? document.querySelector(".verdictbuttonslabel");
    if (!sample) return;
    const color = window.getComputedStyle(sample).color;
    if (color && !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*(,\s*0\s*)?\)/.test(color)) {
      document.documentElement.style.setProperty("--vnh-accent", color);
    }
  }

  // src/ui/expert.ts
  var PLAYER_WIDTH = "80vw";
  var ROOMY = "(min-width: 1100px) and (min-height: 620px)";
  var CHROME = [
    [".PageHeader, .footer-container, .top-section, .top-section-logo", { display: "none" }]
  ];
  var LAYOUT = [
    [".page-container", {
      "box-sizing": "border-box",
      display: "flex",
      width: "100%",
      "max-width": "none",
      height: "100vh",
      margin: "0",
      padding: "10px 0 14px",
      overflow: "hidden"
    }],
    [".flex-row-wrap", {
      display: "flex",
      "flex-direction": "column",
      "flex-wrap": "nowrap",
      "align-items": "center",
      gap: "10px",
      width: "100%",
      height: "100%",
      "min-height": "0",
      margin: "0",
      padding: "0"
    }],
    // The player takes every pixel the verdict row does not need.
    [".video-column", {
      flex: "1 1 auto",
      display: "flex",
      "flex-direction": "column",
      width: PLAYER_WIDTH,
      "max-width": PLAYER_WIDTH,
      "min-width": "0",
      height: "auto",
      "min-height": "160px",
      margin: "0",
      padding: "0"
    }],
    [".videocontainer", {
      flex: "1 1 auto",
      display: "flex",
      "flex-direction": "column",
      width: "100%",
      "max-width": "none",
      height: "auto",
      "min-height": "0",
      margin: "0",
      padding: "0"
    }],
    [".videocontainer .video-js, .videocontainer > video", {
      flex: "1 1 auto",
      width: "100%",
      "max-width": "none",
      height: "100%",
      "max-height": "none",
      "min-height": "0"
    }],
    [".videocontainer .video-js video", {
      width: "100%",
      height: "100%",
      "max-height": "none",
      "object-fit": "contain"
    }],
    // The verdicts take the height they need, and no more.
    [".verdict-column", {
      flex: "0 0 auto",
      width: PLAYER_WIDTH,
      "max-width": PLAYER_WIDTH,
      "min-width": "0",
      height: "auto",
      "min-height": "0",
      "max-height": "55vh",
      margin: "0",
      padding: "0",
      "overflow-x": "hidden",
      "overflow-y": "auto"
    }],
    [".verdicts-container", {
      "box-sizing": "border-box",
      width: "100%",
      height: "auto",
      "min-height": "0",
      "max-height": "none",
      margin: "0",
      padding: "16px 22px"
    }],
    [".verdicts-container-inner", {
      display: "grid",
      "grid-template-columns": "repeat(auto-fit, minmax(200px, 1fr))",
      "align-items": "start",
      gap: "10px 24px",
      width: "100%",
      height: "auto",
      "min-height": "0",
      margin: "0",
      padding: "0"
    }],
    [".verdict-block", {
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      "min-width": "0",
      margin: "0",
      padding: "0"
    }],
    [".verdict-desc", {
      display: "block",
      margin: "0",
      "font-size": "clamp(12px, 0.68vw, 16px)",
      "line-height": "1.35"
    }],
    [".verdictbuttons", {
      display: "flex",
      "flex-wrap": "wrap",
      "justify-content": "center",
      "align-items": "center",
      gap: "6px",
      margin: "0",
      padding: "0"
    }],
    [".verdictbutton", { margin: "0" }],
    [".verdictbutton label", { padding: "6px 10px", "font-size": "12px" }],
    // Second stage: the buttons are replaced by the chosen-label lines.
    [".verdictbuttonslabel, .verdictbuttonsverdictlabel", { margin: "0" }],
    ["#submitbuttons", {
      display: "flex",
      "justify-content": "center",
      "align-items": "center",
      gap: "10px",
      margin: "12px 0 0",
      padding: "0"
    }],
    ["#statustext", { "text-align": "center", margin: "0" }]
  ];
  var original = /* @__PURE__ */ new Map();
  var enabled = false;
  var roomy = null;
  var observer = null;
  var pending = false;
  function patch(groups) {
    for (const group of groups) {
      for (const [selector, styles] of group) {
        for (const node2 of Array.from(document.querySelectorAll(selector))) {
          if (!original.has(node2)) original.set(node2, node2.getAttribute("style") ?? "");
          for (const [property, value] of Object.entries(styles)) {
            node2.style.setProperty(property, value, "important");
          }
        }
      }
    }
  }
  function restore() {
    for (const [node2, style] of original) {
      if (style) node2.setAttribute("style", style);
      else node2.removeAttribute("style");
    }
    original.clear();
  }
  function apply() {
    const groups = [CHROME];
    if (roomy?.matches) {
      document.documentElement.style.setProperty("overflow", "hidden", "important");
      document.body.style.setProperty("overflow", "hidden", "important");
      groups.push(LAYOUT);
    }
    patch(groups);
  }
  function scheduleRefresh() {
    if (!enabled || pending) return;
    pending = true;
    window.requestAnimationFrame(() => {
      pending = false;
      if (enabled) apply();
    });
  }
  function refresh() {
    restore();
    document.documentElement.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow");
    if (enabled) apply();
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }
  function applyExpertView(value) {
    enabled = value;
    document.documentElement.classList.toggle("vnh-expert", value);
    if (!roomy) {
      roomy = window.matchMedia(ROOMY);
      roomy.addEventListener("change", refresh);
    }
    if (!observer) {
      observer = new MutationObserver(scheduleRefresh);
      const root = document.querySelector(".page-container");
      if (root) observer.observe(root, { childList: true, subtree: true });
    }
    refresh();
  }

  // src/shortcuts.ts
  var SHORTCUTS = [
    {
      title: "Playback",
      items: [
        ["Space / K", "Play / pause"],
        ["&larr; / &rarr;", "Seek 1s &mdash; hold Shift for 5s, Alt for 0.1s"],
        ["J / L", "Seek 5 seconds"],
        [", / .", "Step one frame back / forward"],
        ["0 / Home", "Jump to the start of the range"],
        ["End", "Jump to the end of the range"],
        ["1 &ndash; 9", "Jump to 10% &ndash; 90% of the range"]
      ]
    },
    {
      title: "Speed, audio, view",
      items: [
        ["- / +", "Slower / faster playback"],
        ["Backspace", "Reset speed to 1x"],
        ["&uarr; / &darr;", "Volume up / down"],
        ["M", "Mute / unmute"],
        ["F", "Fullscreen"]
      ]
    },
    {
      title: "Portal",
      items: [
        ["C", 'Toggle "View full context"'],
        ["E", "Toggle expert view"],
        ["Y", "Copy clip link"],
        ["?", "Show / hide this list"],
        ["Esc", "Close this list"]
      ]
    }
  ];

  // src/ui/help.ts
  var overlay = null;
  function buildRows() {
    const rows = [];
    for (const section of SHORTCUTS) {
      rows.push(`<tr class="vnh-section"><td colspan="2">${section.title}</td></tr>`);
      for (const [keys, description] of section.items) {
        const rendered = keys.split(" / ").map((key) => `<kbd>${key}</kbd>`).join(" / ");
        rows.push(`<tr><td>${rendered}</td><td>${description}</td></tr>`);
      }
    }
    return rows.join("");
  }
  function build() {
    const card = el("div", {
      class: "vnh-modal-card",
      html: `
			<div class="vnh-modal-header">
				<span>Keyboard shortcuts</span>
				<span class="vnh-modal-close" role="button" tabindex="0" aria-label="Close">X</span>
			</div>
			<div class="vnh-modal-body">
				<table class="vnh-keys">${buildRows()}</table>
				<p class="vnh-note">
					Shortcuts follow the keys your layout prints, not their US positions.
					They are ignored while you are typing in a text field.
					Seeking is limited to the labeled clip window unless
					<b>View full context</b> is enabled.
				</p>
			</div>`
    });
    const node2 = el("div", { class: "vnh-modal", children: [card] });
    node2.hidden = true;
    node2.addEventListener("click", (event) => {
      const target = event.target;
      if (target === node2 || target.classList.contains("vnh-modal-close")) closeHelp();
    });
    document.body.appendChild(node2);
    return node2;
  }
  function isHelpOpen() {
    return !!overlay && !overlay.hidden;
  }
  function openHelp() {
    if (!overlay || !overlay.isConnected) overlay = build();
    overlay.hidden = false;
  }
  function closeHelp() {
    if (!isHelpOpen()) return false;
    overlay.hidden = true;
    return true;
  }
  function toggleHelp() {
    if (isHelpOpen()) closeHelp();
    else openHelp();
  }

  // src/ui/toolbar.ts
  function installToolbar(callbacks) {
    const container = document.querySelector(".videocontainer");
    if (!container) return null;
    const checkbox = el("input", { attrs: { type: "checkbox", id: "vnh-fullcontext" } });
    const checkboxLabel = el("label", {
      class: "vnh-check",
      attrs: {
        for: "vnh-fullcontext",
        title: "Play the whole recording instead of only the labeled clip window (C)"
      },
      children: [checkbox, el("span", { text: "View full context" })]
    });
    const warning = el("span", {
      class: "vnh-readout vnh-warn",
      text: "⚠ clip timer not found",
      attrs: { title: "The portal’s clip-window timer was not detected on this page." }
    });
    warning.style.display = "none";
    const readout = el("span", { class: "vnh-readout" });
    const copyButton = el("button", {
      class: "vnh-btn",
      text: "Copy clip link",
      attrs: {
        type: "button",
        title: "Copy the portal link for this clip (Y). Shift-click copies the direct video URL."
      }
    });
    const expertButton = el("button", {
      class: "vnh-btn",
      text: "Expert view",
      attrs: {
        type: "button",
        "aria-pressed": "false",
        title: "Hide the page header, footer and instructions and give the player the full screen, with the verdicts in a row underneath. Click again to restore the normal page (E)."
      }
    });
    const helpButton = el("button", {
      class: "vnh-btn vnh-btn-icon",
      text: "?",
      attrs: { type: "button", title: "Keyboard shortcuts (?)" }
    });
    const toolbar = el("div", {
      class: "vnh-toolbar",
      children: [
        checkboxLabel,
        warning,
        readout,
        el("span", { class: "vnh-spacer" }),
        copyButton,
        expertButton,
        helpButton
      ]
    });
    container.insertBefore(toolbar, container.firstChild);
    checkbox.addEventListener("change", () => callbacks.onToggleFullContext(checkbox.checked));
    copyButton.addEventListener("click", (event) => callbacks.onCopyLink(event.shiftKey));
    expertButton.addEventListener("click", () => callbacks.onToggleExpert());
    helpButton.addEventListener("click", () => callbacks.onHelp());
    let fullContext = false;
    function updateReadout() {
      const media2 = getMedia();
      if (!media2) {
        readout.textContent = "";
        return;
      }
      const range = getClipRange();
      const position = media2.currentTime;
      const parts = [];
      if (range && !fullContext) {
        const length = Math.max(0, range.end - range.start);
        parts.push(`<b>+${(position - range.start).toFixed(1)}s</b> / ${length.toFixed(1)}s`);
      } else {
        const duration = Number.isFinite(media2.duration) ? formatTime(media2.duration) : "?";
        parts.push(`<b>${formatTime(position)}</b> / ${duration}`);
      }
      if (range && range.event !== null && !fullContext) {
        parts.push(`event +${(range.event - range.start).toFixed(1)}s`);
      }
      const rate = media2.playbackRate;
      if (Math.abs(rate - 1) > 1e-3) parts.push(`${rate}x`);
      readout.innerHTML = parts.join(" · ");
    }
    const media = getMedia();
    for (const event of ["timeupdate", "seeked", "ratechange", "play", "pause", "loadedmetadata"]) {
      media?.addEventListener(event, updateReadout);
    }
    updateReadout();
    if (!isClampHooked()) warning.style.display = "";
    return {
      syncFullContext(value) {
        fullContext = value;
        checkbox.checked = value;
        checkboxLabel.classList.toggle("vnh-on", value);
        updateReadout();
      },
      syncExpertView(value) {
        expertButton.setAttribute("aria-pressed", value ? "true" : "false");
      },
      refresh: updateReadout
    };
  }

  // src/main.ts
  installClampHook();
  loadSettings();
  setClampSuppressed(getSettings().fullContext);
  onReady(() => {
    if (!document.querySelector(".videocontainer")) {
      log("no player on this page - nothing to do");
      return;
    }
    injectStyles();
    applyAccentFromPage();
    const setExpertView = (value) => {
      updateSettings({ expertView: value });
      applyExpertView(value);
      toolbar?.syncExpertView(value);
    };
    const setFullContext = (value, notify = true) => {
      updateSettings({ fullContext: value });
      setClampSuppressed(value);
      toolbar?.syncFullContext(value);
      if (!notify) return;
      if (value && !isClampHooked()) {
        toast("Full context on (no clip timer was found on this page)");
      } else {
        toast(value ? "Full context on" : "Clip window restored");
      }
    };
    const copyClipLink = (rawVideo) => {
      const pageUrl = getClipPageUrl();
      const videoUrl = getClipVideoUrl();
      const url = rawVideo ? videoUrl ?? pageUrl : pageUrl ?? videoUrl;
      if (!url) {
        toast("No clip link found on this page");
        return;
      }
      void copyText(url).then((ok) => {
        if (!ok) {
          toast("Could not copy the link");
          return;
        }
        toast(url === videoUrl ? "Video URL copied" : "Clip link copied");
      });
    };
    const toolbar = installToolbar({
      onToggleFullContext: (next) => setFullContext(next),
      onCopyLink: copyClipLink,
      onToggleExpert: () => setExpertView(!getSettings().expertView),
      onHelp: toggleHelp
    });
    setFullContext(getSettings().fullContext, false);
    setExpertView(getSettings().expertView);
    installKeyboard({
      toggleFullContext: () => setFullContext(!getSettings().fullContext),
      toggleExpertView: () => setExpertView(!getSettings().expertView),
      copyClipLink: () => copyClipLink(false),
      toggleHelp,
      closeHelp
    });
    log("ready");
  });
})();
})();

