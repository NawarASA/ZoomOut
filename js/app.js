// App extras: offline support, analytics, and the "install as an app" button.
import { CONFIG } from "./config.js";

const $ = id => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- offline support ---------------- */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

/* ---------------- Cloudflare Web Analytics ---------------- */
if (CONFIG.cloudflareAnalyticsToken) {
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
  box.hidden = installed() || dismissed() || !(deferred || isIOS);
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
