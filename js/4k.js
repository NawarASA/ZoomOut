// 4K, the bonus round (4k.html): PeakPoll's survey game, camera edition.
// Name the 5 most popular answers to a survey question. Each one raises the resolution of the
// viewfinder's bokeh lights, from blocky 144p to a crisp 4K at 4,000 points. 3 wrong answers are dead
// pixels, and the third one loses the signal. Unlocks once today's photo is finished.
import { CONFIG } from "./config.js";
import { isoDate, esc } from "./core.js";
import { MAX, tier, fmt, boardFor, store, scoreOf, finishedDaily } from "./4k-core.js";

const $ = id => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const today = isoDate(new Date());
for (const a of document.querySelectorAll("a[data-keep-query]")) a.href = a.getAttribute("href") + location.search; // stay in the Discord Activity

/* ---------- answer matching (from PeakPoll) ---------- */
const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ")
  .replace(/\b(a|an|the|my|your|to|some)\b/g, " ").replace(/\s+/g, " ").trim();
const sing = s => s.replace(/ies$/, "y").replace(/(es|s)$/, "");
function lev(a, b) {
  const m = [];
  for (let i = 0; i <= a.length; i++) { m[i] = [i]; for (let j = 1; j <= b.length; j++) m[i][j] = i ? Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) : j; }
  return m[a.length][b.length];
}
function match(guess, answers) {
  const g = norm(guess); if (!g) return -1;
  const all = []; answers.forEach((a, i) => a[2].concat(a[0]).forEach(al => all.push([norm(al), i])));
  for (const [al, i] of all) if (g === al || sing(g) === sing(al)) return i;
  for (const [al, i] of all) { const tol = al.length >= 7 ? 2 : al.length >= 4 ? 1 : 0; if (tol && lev(g, al) <= tol) return i; }
  all.sort((x, y) => y[0].length - x[0].length);
  for (const [al, i] of all) if (al.length >= 3 && (" " + g + " ").includes(" " + al + " ")) return i;
  return -1;
}

const board = boardFor(today);
const state = store.get().boards[today] || { found: [], strikes: 0, tried: [], done: false };
const score = () => scoreOf(board, state);

/* ---------- the viewfinder: today's bokeh lights, at the current resolution ---------- */
// Out-of-focus light circles (like the site background), a different set every day. They drift
// and pulse; at low scores they're drawn as big pixels, and every answer resolves them further.
const PALETTE = ["#7B61FF", "#2ED3A9", "#F4C54B", "#FF5C8D", "#4FB6E8", "#FF8C6E"];
const rnd = seed => { let s = seed % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`; };
const lights = (() => {
  const r = rnd(board.number * 7919 + 13), shift = Math.floor(r() * PALETTE.length);
  return Array.from({ length: 24 }, (_, i) => ({
    x: r(), y: r(), r: .05 + r() * .15, c: PALETTE[(shift + (i % 3 ? i : 0)) % PALETTE.length],
    a: .3 + r() * .5, drift: .015 + r() * .03, ph: r() * Math.PI * 2, speed: .6 + r() * .8,
  }));
})();
const view = { shown: 0, target: 0, from: 0, t0: 0, bloom: -1e9, raf: 0 };
const scene = document.createElement("canvas"), small = document.createElement("canvas");

function paint(t, w, h) { // the bokeh at full detail, into `scene`
  if (scene.width !== w || scene.height !== h) { scene.width = w; scene.height = h; }
  const ctx = scene.getContext("2d"), big = Math.max(w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h); bg.addColorStop(0, "#0A0E22"); bg.addColorStop(1, "#1E1236");
  ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const bloom = 1 + .35 * Math.exp(-(t - view.bloom) / 500) * (t > view.bloom ? 1 : 0); // swell when 4K is reached
  ctx.globalCompositeOperation = "lighter";
  for (const l of lights) {
    const s = t * .00025 * l.speed;
    const x = (l.x + Math.sin(s + l.ph) * l.drift) * w, y = (l.y + Math.cos(s * .8 + l.ph) * l.drift) * h;
    const pulse = .8 + .2 * Math.sin(t * .0011 * l.speed + l.ph), rad = l.r * big * bloom, a = l.a * pulse;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, rgba(l.c, a * .5)); g.addColorStop(.78, rgba(l.c, a * .38)); g.addColorStop(.9, rgba(l.c, a * .85)); g.addColorStop(1, rgba(l.c, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
  if (view.shown >= 1) { // star glints on a perfect shot
    ctx.fillStyle = "#fff";
    lights.forEach((l, i) => {
      if (i % 4) return;
      const k = Math.max(0, Math.sin(t * .002 + l.ph * 3)), x = l.x * w, y = l.y * h, len = big * .025 * k;
      ctx.globalAlpha = k; ctx.fillRect(x - len, y - .8, len * 2, 1.6); ctx.fillRect(x - .8, y - len, 1.6, len * 2);
    });
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = "source-over";
}

function draw(t = performance.now()) {
  const cv = $("photo"), rect = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
  if (!w || !h) return;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  if (view.t0) { // easing between resolutions
    const k = Math.min(1, (t - view.t0) / 900);
    view.shown = view.from + (view.target - view.from) * (1 - Math.pow(1 - k, 3));
    if (k >= 1) view.t0 = 0;
  }
  const ctx = cv.getContext("2d");
  if (view.shown >= .999) { paint(t, w, h); ctx.drawImage(scene, 0, 0); return; }
  paint(t, Math.round(w / 2), Math.round(h / 2)); // half detail is plenty under the pixels
  const cols = Math.max(6, Math.round(10 * Math.pow(2, view.shown * 5))), rows = Math.max(4, Math.round(cols * h / w));
  small.width = cols; small.height = rows;
  const sc = small.getContext("2d"); sc.imageSmoothingEnabled = true; sc.drawImage(scene, 0, 0, cols, rows);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, w, h);
}
function loop(t) { draw(t); view.raf = requestAnimationFrame(loop); }
function setResolution(f, instant) {
  if (f >= 1 && view.target < 1 && !instant) view.bloom = performance.now();
  if (instant || reduced) { view.shown = view.target = f; view.t0 = 0; }
  else { view.from = view.shown; view.target = f; view.t0 = performance.now(); }
  if (reduced) draw();
}
addEventListener("resize", () => draw());

/* ---------- drawing the board ---------- */
function render(hit = null) {
  const sc = score(), f = sc / MAX, { answers, pts } = board;
  $("res").textContent = tier(f);
  $("score").textContent = `${fmt(sc)} / ${fmt(MAX)}`;
  // The answers as rows: "?" until found, green with a flash when found, dimmed when missed.
  $("frames").innerHTML = answers.map((a, i) => {
    const found = state.found.includes(i), show = found || state.done;
    return `<li class="${found ? "found" : show ? "missed" : "empty"}${i === hit ? " hit" : ""}" style="--i:${i}">
      <span class="no">${i + 1}</span><span class="ans">${show ? esc(a[0]) : "?"}</span><span class="pts">${show ? fmt(pts[i]) : ""}</span></li>`;
  }).join("");
  $("pixels").innerHTML = [0, 1, 2].map(i => `<i class="${i < state.strikes ? "dead" : ""}"></i>`).join("");
  $("tried").textContent = state.tried.length ? `Not in the survey: ${state.tried.join(", ")}` : "";
  $("viewfinder").classList.toggle("lost", state.done && state.found.length < 5);
  $("viewfinder").classList.toggle("perfect", state.found.length === 5);
  $("form").hidden = state.done;
  $("end").hidden = !state.done;
  if (state.done) renderEnd(sc);
}

function renderEnd(sc) {
  const perfect = state.found.length === 5, res = tier(sc / MAX);
  // Written in capitals here (not CSS) so resolutions keep their lowercase "p": 480p, not 480P.
  $("end-title").textContent = perfect ? "SHOT IN 4K" : state.strikes >= 3 ? `SIGNAL LOST AT ${res}` : `SHOT IN ${res}`;
  $("end-text").textContent = perfect ? "All five answers. Every pixel in place." : `You found ${state.found.length} of 5 answers for ${fmt(sc)} points.`;
  const s = store.get().stats;
  $("stats").innerHTML = [[s.played, "Played"], [s.perfect, "In 4K"], [fmt(s.best), "Best"]]
    .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");
}

function shareText() {
  const sc = score(), tiles = board.answers.map((_, i) => state.found.includes(i) ? "■" : "□").join("");
  return `4K no. ${board.number}  ${fmt(sc)}/${fmt(MAX)} (${tier(sc / MAX)})\n${tiles}${state.strikes ? `  ${state.strikes} dead pixel${state.strikes > 1 ? "s" : ""}` : ""}\n${CONFIG.siteUrl}`;
}

function save(finished) {
  const all = store.get();
  all.boards[today] = state;
  if (finished) {
    all.stats.played++;
    if (state.found.length === 5) all.stats.perfect++;
    all.stats.best = Math.max(all.stats.best, score());
  }
  store.set(all);
}

function flash(cls) { const v = $("viewfinder"); v.classList.remove(cls); void v.offsetWidth; v.classList.add(cls); }
function say(text, cls = "") { const m = $("msg"); m.textContent = text; m.className = `bonus-msg ${cls}`; }

/* ---------- guessing ---------- */
$("form").addEventListener("submit", e => {
  e.preventDefault();
  const input = $("input"), g = input.value.trim(), { answers, pts } = board;
  if (!g || state.done) return;
  input.value = "";
  const i = match(g, answers);
  if (i >= 0) {
    if (state.found.includes(i)) return say(`"${answers[i][0]}" is already in the shot.`);
    state.found.push(i);
    const perfect = state.found.length === 5;
    if (perfect) state.done = true;
    say(perfect ? "Every answer. That's 4K." : `${answers[i][0]}: +${fmt(pts[i])} points. Resolution up.`, "good");
    save(perfect); render(i); setResolution(score() / MAX); flash("shutter");
    navigator.vibrate?.(perfect ? [20, 60, 20, 60, 40] : 18);
    if (perfect) setTimeout(() => $("frames").classList.add("cheer"), 700); // the rows ripple
  } else {
    if (state.tried.some(t => norm(t) === norm(g))) return say("You already tried that one.");
    state.strikes++; state.tried.push(g);
    const left = 3 - state.strikes;
    if (!left) state.done = true;
    say(left ? `Nobody said "${g}". Dead pixel. ${left} left.` : `Nobody said "${g}". Signal lost.`, "bad");
    save(!left); render(); flash("glitch");
  }
  if (!state.done) input.focus();
});

$("copy").addEventListener("click", () => {
  const btn = $("copy"), text = shareText();
  const done = () => { btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy result", 1600); };
  try { navigator.clipboard.writeText(text).then(done, () => say(text)); } catch { say(text); }
});

/* ---------- start: locked until today's photo is done ---------- */
$("no").textContent = `4K no. ${board.number}`;
if (!finishedDaily(today)) {
  $("locked").hidden = false;
} else {
  $("game").hidden = false;
  $("q").textContent = board.question;
  render(); setResolution(score() / MAX, true);
  if (reduced) draw(); else view.raf = requestAnimationFrame(loop); // the lights drift and pulse
}
