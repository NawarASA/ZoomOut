// 4K, the bonus round (4k.html): PeakPoll's survey game, camera edition.
// Name the 5 most popular answers to a survey question. Each one raises the resolution of
// a picture of the topic, from blocky 144p to a crisp 4K at 4,000 points. 3 wrong answers are dead
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

/* ---------- the viewfinder: today's photo at the current resolution ---------- */
const view = { img: null, shown: 0, raf: 0 };
function draw() {
  const cv = $("photo"); if (!view.img) return;
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (!w || !h) return;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const ctx = cv.getContext("2d"), img = view.img;
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / s, sh = h / s; // cover-crop
  const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
  if (view.shown >= 1) { ctx.imageSmoothingEnabled = true; ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h); return; }
  const cols = Math.max(6, Math.round(10 * Math.pow(2, view.shown * 5))), rows = Math.max(4, Math.round(cols * h / w));
  const small = draw.small || (draw.small = document.createElement("canvas"));
  small.width = cols; small.height = rows;
  const sc = small.getContext("2d"); sc.imageSmoothingEnabled = true; sc.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, w, h);
}
function setResolution(f, instant) {
  cancelAnimationFrame(view.raf);
  if (instant || reduced) { view.shown = f; draw(); return; }
  const from = view.shown, t0 = performance.now(), dur = 900;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    view.shown = from + (f - from) * (1 - Math.pow(1 - k, 3)); draw();
    if (k < 1) view.raf = requestAnimationFrame(step);
  };
  view.raf = requestAnimationFrame(step);
}
addEventListener("resize", draw);

/* ---------- drawing the board ---------- */
function render(hit = null) {
  const sc = score(), f = sc / MAX, { answers, pts } = board;
  $("res").textContent = tier(f);
  $("score").textContent = `${fmt(sc)} / ${fmt(MAX)}`;
  $("frames").innerHTML = answers.map((a, i) => {
    const found = state.found.includes(i), show = found || state.done;
    return `<li class="${found ? "found" : show ? "missed" : ""}${i === hit ? " hit" : ""}">
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
  $("end-title").textContent = perfect ? "Shot in 4K" : state.strikes >= 3 ? `Signal lost at ${res}` : `Shot in ${res}`;
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
  const img = new Image(); // the board's own illustration, sharpening as you score
  img.onload = () => { view.img = img; draw(); };
  img.src = board.image;
}
