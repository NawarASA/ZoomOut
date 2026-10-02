import { CONFIG } from "./config.js";
import { STEPS, norm, judge, placeZoom, isoDate, parseDate, daysBetween, esc } from "./core.js";

const RING_STEP = 34;          // degrees between labels on the zoom ring
const STORE_KEY = "zoomout-v1";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = id => document.getElementById(id);
const WORD = { hit: "Got it", near: "Close", miss: "No", skip: "Skipped" };

/* ---------------- wordmark ---------------- */
$("mark").innerHTML = "ZOOM OUT".split("").map((ch, i) => ch === " "
  ? `<span class="gap"></span>`
  : `<span class="${ch === "O" ? "o" : ""}" style="animation-delay:${i * 70}ms${ch === "O" ? `, ${i * 70}ms` : ""}">${ch}</span>`).join("");

/* ---------------- drifting bokeh background ---------------- */
(function bokeh() {
  const c = $("bokeh"), ctx = c.getContext("2d");
  const hues = ["123,97,255", "46,211,169", "244,197,75", "255,92,141"];
  let W, H, dots;
  function size() {
    const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    c.width = W * d; c.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    dots = Array.from({ length: 20 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: 40 + Math.random() * 140, a: .04 + Math.random() * .08, h: hues[i % 4], vx: (Math.random() - .5) * .15, vy: (Math.random() - .5) * .15 }));
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const d of dots) {
      d.x += d.vx; d.y += d.vy;
      if (d.x < -d.r) d.x = W + d.r; if (d.x > W + d.r) d.x = -d.r;
      if (d.y < -d.r) d.y = H + d.r; if (d.y > H + d.r) d.y = -d.r;
      const g = ctx.createRadialGradient(d.x, d.y, d.r * .55, d.x, d.y, d.r);
      g.addColorStop(0, `rgba(${d.h},${d.a})`); g.addColorStop(.9, `rgba(${d.h},${d.a * .6})`); g.addColorStop(1, `rgba(${d.h},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
    }
    if (!reduced) requestAnimationFrame(frame);
  }
  size(); addEventListener("resize", () => { size(); if (reduced) frame(); }); frame();
})();

/* ---------------- engraved zoom ring ---------------- */
(function buildRing() {
  const majors = STEPS.map((_, i) => i * RING_STEP);
  const angles = majors.map(a => [a, true]);
  for (let a = -180; a < 180; a += 5) if (majors.every(m => Math.abs(m - a) > 2)) angles.push([a, false]);
  let html = "";
  for (const [a, major] of angles) {
    const r1 = major ? 233 : 238, r2 = 245, t = a * Math.PI / 180;
    html += `<line class="tick${major ? " major" : ""}" x1="${250 + r1 * Math.sin(t)}" y1="${250 - r1 * Math.cos(t)}" x2="${250 + r2 * Math.sin(t)}" y2="${250 - r2 * Math.cos(t)}"/>`;
  }
  STEPS.forEach((z, i) => {
    const a = i * RING_STEP, t = a * Math.PI / 180, r = 216, x = 250 + r * Math.sin(t), y = 250 - r * Math.cos(t);
    html += `<text class="lbl" id="lbl${i}" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" transform="rotate(${a} ${x} ${y})">${z}×</text>`;
  });
  $("dial").innerHTML = html;
})();

/* ---------------- saved results (this browser only) ---------------- */
const store = {
  get() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { results: {} }; } catch { return { results: {} }; } },
  set(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch {} },
};

/* ---------------- game ---------------- */
const today = isoDate(new Date());
const number = p => daysBetween(CONFIG.launchDate, p.date) + 1;
const shortDate = s => parseDate(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
let published = [], game;

function newGame(puzzle, mode) {
  game = { puzzle, mode, guesses: [], status: "playing" };
  if (mode === "daily") {
    const saved = store.get().results[puzzle.date];
    if (saved) { game.guesses = saved.guesses; game.status = saved.status; }
  }
  const img = $("photo");
  img.src = puzzle.image;
  $("msg").textContent = ""; $("msg").className = "msg";
  $("guess-input").value = "";
  $("lens").classList.remove("win");
  img.style.transition = "none";
  draw(true);
  void img.offsetWidth; img.style.transition = "";
  $("frame").classList.remove("hunt");
  restart($("frame"), "open");
}

const step = () => game.status === "playing" ? Math.min(game.guesses.length, 5) : 5;

function draw(fresh) {
  const p = game.puzzle, s = step(), done = game.status !== "playing";
  placeZoom($("photo"), STEPS[s], p.focusX, p.focusY);
  $("lens").classList.toggle("done", done);
  $("lens").classList.toggle("win", game.status === "won");
  const mag = $("mag");
  if (mag.textContent !== `${STEPS[s]}×`) { mag.textContent = `${STEPS[s]}×`; if (!fresh) restart(mag, "bump"); }

  $("dial").style.transform = `rotate(${-s * RING_STEP}deg)`;
  STEPS.forEach((_, i) => {
    const g = game.guesses[i];
    $("lbl" + i).setAttribute("class", "lbl " + (g ? g.result : (!done && i === s ? "current" : "")));
  });

  const list = $("guesses");
  if (fresh || list.children.length > game.guesses.length) list.innerHTML = "";
  game.guesses.slice(list.children.length).forEach((g, k) => {
    const i = list.children.length, li = document.createElement("li");
    li.className = g.result;
    if (fresh) li.style.animationDelay = `${k * 80}ms`;
    li.innerHTML = `<span class="z">${STEPS[i]}×</span><span class="t">${g.text ? esc(g.text) : "no guess"}</span><span class="r">${WORD[g.result]}</span>`;
    list.appendChild(li);
  });

  $("guess-form").hidden = done;
  $("rules").hidden = done;
  $("meta").textContent = `Puzzle no. ${number(p)}  ·  ${parseDate(p.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;
  $("banner").hidden = game.mode !== "fallback";

  const past = published.filter(q => q.date < today).reverse();
  $("archive").hidden = !past.length;
  $("archive-list").innerHTML =
    (published.some(q => q.date === today) ? `<button type="button" data-date="${today}" aria-pressed="${game.mode === "daily"}">Today</button>` : "") +
    past.map(q =>`<button type="button" data-date="${q.date}" aria-pressed="${game.mode !== "daily" && game.puzzle === q}">No. ${number(q)} · ${shortDate(q.date)}</button>`).join("");

  const wasHidden = $("end").hidden;
  $("end").hidden = !done;
  if (done && (wasHidden || fresh)) drawEnd();
}

function drawEnd() {
  const won = game.status === "won", n = game.guesses.length, answer = game.puzzle.answers[0];
  $("end-kicker").textContent = won ? `Solved at ${STEPS[n - 1]}× zoom` : "Out of zooms";
  $("end-title").innerHTML = answer.split(" ").map((w, i) => `<span style="animation-delay:${200 + i * 140}ms">${esc(w)}</span>`).join(" ");
  $("end-verdict").textContent = won
    ? ["Ridiculous eye. First try.", "Sharp. Two zooms.", "Nicely done.", "Got there.", "Close call.", "Just made it."][n - 1]
    : game.mode === "daily" ? "Tomorrow's photo is yours." : "Try another from the archive.";
  $("credit").hidden = !game.puzzle.credit;
  $("credit").textContent = game.puzzle.credit ? `Photo: ${game.puzzle.credit}` : "";
  $("trail").innerHTML = STEPS.map((z, i) => {
    const g = game.guesses[i];
    return `<div><i class="${g ? g.result : ""}" style="animation-delay:${400 + i * 90}ms"></i>${z}×</div>`;
  }).join("");
  $("share").textContent = shareText();
  $("countdown").hidden = game.mode !== "daily";

  if (game.mode === "daily") {
    const res = store.get().results, dates = Object.keys(res), wins = dates.filter(d => res[d].status === "won").length;
    let streak = 0;
    for (let d = parseDate(game.puzzle.date); res[isoDate(d)]?.status === "won"; d.setDate(d.getDate() - 1)) streak++;
    $("stats").innerHTML = [[dates.length, "Played"], [dates.length ? Math.round(wins / dates.length * 100) + "%" : "–", "Solved"], [streak, "Streak"]]
      .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");
    $("stats").hidden = false;
  } else $("stats").hidden = true;
}

function shareText() {
  const score = game.status === "won" ? `${game.guesses.length}/6` : "X/6";
  const trail = game.guesses.map((g, i) => `${STEPS[i]}× ${WORD[g.result].toLowerCase()}`).join("  ·  ");
  return `Zoom Out no. ${number(game.puzzle)}  ${score}\n${trail}${CONFIG.siteUrl ? `\n${CONFIG.siteUrl}` : ""}`;
}

function finish() {
  const last = game.guesses[game.guesses.length - 1];
  if (last && last.result === "hit") game.status = "won";
  else if (game.guesses.length >= 6) game.status = "lost";
  if (game.status !== "playing" && game.mode === "daily") {
    const s = store.get();
    s.results[game.puzzle.date] = { status: game.status, guesses: game.guesses };
    store.set(s);
  }
}

function say(text, cls) { const m = $("msg"); m.textContent = text; m.className = "msg " + (cls || ""); restart(m, "pop"); }

function react(result) {
  if (result === "hit") return restart($("flash"), "go");
  $("frame").classList.remove("open");
  restart($("frame"), "hunt");
  if (result === "miss") restart($("lens"), "shake");
  if (result === "near") restart($("lens"), "near-pulse");
}

$("guess-form").addEventListener("submit", e => {
  e.preventDefault();
  if (!game || game.status !== "playing") return;
  const text = $("guess-input").value.trim();
  if (!norm(text)) return say("Type a guess first.");
  if (game.guesses.some(g => g.text && norm(g.text) === norm(text))) return say("You already tried that one.");
  const result = judge(text, game.puzzle);
  game.guesses.push({ text, result });
  $("guess-input").value = "";
  finish(); react(result); draw();
  if (game.status === "won") say("Got it!", "hit");
  else if (game.status === "lost") say("That was your last zoom.", "miss");
  else say(result === "near" ? "Close. Pulling back…" : "Not that. Pulling back…", result);
  if (game.status === "playing") $("guess-input").focus();
});

$("skip-btn").addEventListener("click", () => {
  if (!game || game.status !== "playing") return;
  game.guesses.push({ text: "", result: "skip" });
  finish(); react("skip"); draw();
  if (game.status === "lost") say("That was your last zoom.", "miss");
});

$("copy-btn").addEventListener("click", () => {
  const btn = $("copy-btn");
  const fallback = () => {
    const r = document.createRange(); r.selectNodeContents($("share"));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    btn.textContent = "Selected. Press Ctrl/⌘+C";
  };
  try {
    navigator.clipboard.writeText(shareText()).then(() => { btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy result", 1800); }, fallback);
  } catch { fallback(); }
});

$("archive-list").addEventListener("click", e => {
  const b = e.target.closest("button[data-date]"); if (!b) return;
  const p = published.find(q => q.date === b.dataset.date);
  newGame(p, p.date === today ? "daily" : "archive");
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
});

function tick() {
  const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const t = Math.max(0, Math.floor((next - now) / 1000)), p = n => String(n).padStart(2, "0");
  $("countdown").textContent = `Next photo in ${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
  if (game && game.mode === "daily" && isoDate(now) !== today && game.status !== "playing") location.reload();
}
setInterval(tick, 1000); tick();

/* ---------------- start ---------------- */
function showError(html) {
  $("play").hidden = true;
  $("error").innerHTML = html;
  $("error").hidden = false;
}

(async () => {
  let all;
  try {
    const res = await fetch(CONFIG.puzzlesFile, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    all = await res.json();
  } catch {
    return showError(location.protocol === "file:"
      ? "The puzzle list can't load when the page is opened as a file.<br>Run <code>npm run dev</code> in the project folder and open the address it prints."
      : "The puzzle list couldn't be loaded. Refresh the page to try again.");
  }
  published = all.filter(p => p.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  if (!published.length) {
    const first = all.map(p => p.date).sort()[0];
    return showError(first ? `The first photo arrives on <b>${parseDate(first).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</b>.` : "No puzzles yet.");
  }
  const todays = published.find(p => p.date === today);
  todays ? newGame(todays, "daily") : newGame(published[published.length - 1], "fallback");
})();
