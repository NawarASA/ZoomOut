// App extras: Discord Activity, offline support, analytics, and the "install as an app" button.
import { CONFIG } from "./config.js";

const $ = id => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- Discord Activity ---------------- */
// Opened inside Discord? Discord serves the site from <app id>.discordsays.com and adds frame_id.
export const inDiscord = location.hostname.endsWith(".discordsays.com") || new URLSearchParams(location.search).has("frame_id");
if (inDiscord) {
  document.documentElement.classList.add("in-discord");
  try { await import("./discord.js?v=4"); } // bump ?v= when discord.js changes: Discord caches Activity files catch (e) { console.warn("Discord SDK didn't start", e); }
}

/* ---------------- offline support ---------------- */
if (!inDiscord && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

/* ---------------- Cloudflare Web Analytics ---------------- */
// Not inside Discord: it blocks the analytics server.
if (CONFIG.cloudflareAnalyticsToken && !inDiscord) {
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.dataset.cfBeacon = JSON.stringify({ token: CONFIG.cloudflareAnalyticsToken });
  document.head.appendChild(s);
}

/* ---------------- install as an app ---------------- */
const DISMISS = "zoomout-install-dismissed";
const installed = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let deferred = null; // Android / desktop Chrome's install prompt, saved for our own button

function dismissed() { try { return !!localStorage.getItem(DISMISS); } catch { return false; } }

// Show the install card (on the end screen) only when installing is actually possible.
export function refreshInstall() {
  const box = $("install");
  if (!box) return;
  box.hidden = inDiscord || installed() || dismissed() || !(deferred || isIOS);
}

addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; refreshInstall(); });
addEventListener("appinstalled", () => { deferred = null; refreshInstall(); });

$("install-btn")?.addEventListener("click", async () => {
  if (deferred) {
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    deferred = null; refreshInstall();
  } else if (isIOS) openSheet();
});
$("install-later")?.addEventListener("click", () => {
  try { localStorage.setItem(DISMISS, "1"); } catch {}
  refreshInstall();
});

/* iPhone/iPad: browsers there don't allow an install button, so show the steps. */
function openSheet() {
  const box = $("ios-install");
  box.classList.remove("closing"); box.hidden = false;
  document.documentElement.classList.add("no-scroll");
  box.querySelector(".help-sheet").focus({ preventScroll: true });
}
function closeSheet() {
  const box = $("ios-install");
  if (box.hidden) return;
  box.classList.add("closing");
  setTimeout(() => { box.hidden = true; box.classList.remove("closing"); document.documentElement.classList.remove("no-scroll"); $("install-btn")?.focus({ preventScroll: true }); }, reduced ? 0 : 210);
}
$("ios-install")?.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeSheet(); });
addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

refreshInstall();
