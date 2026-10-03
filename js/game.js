import { CONFIG } from "./config.js";
import { STEPS, norm, judge, drawView, isoDate, parseDate, daysBetween, esc } from "./core.js";

const RING_STEP = 34;          // degrees between labels on the zoom ring
const STORE_KEY = "zoomout-v1";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = id => document.getElementById(id);
const WORD = { hit: "Got it", near: "Close", miss: "No", skip: "Skipped" };
const touch = matchMedia("(pointer: coarse)").matches;

/* ---------------- wordmark ---------------- */
$("mark").innerHTML = "ZOOM OUT".split("").map((ch, i) => ch === " "
  ? `<span class="gap"></span>`
  : `<span class="${ch === "O" ? "o" : ""}" style="animation-delay:${i * 70}ms${ch === "O" ? `, ${i * 70}ms` : ""}">${ch}</span>`).join("");

/* ---------------- background lights ----------------
   Drawn once. The gentle drift is a CSS transform, so it costs nothing per frame.
   Only redrawn when the width changes, not when a phone's toolbar or keyboard moves. */
(function bokeh() {
  const c = $("bokeh"), ctx = c.getContext("2d");
  const hues = ["123,97,255", "46,211,169", "244,197,75", "255,92,141"];
  let seed = 42; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dots = Array.from({ length: 18 }, (_, i) => ({ x: rand(), y: rand(), r: 40 + rand() * 140, a: .05 + rand() * .08, h: hues[i % 4] }));
  let lastW = 0;
  function paint() {
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || Math.abs(w - lastW) < 2) return;
    lastW = w;
    const d = Math.min(devicePixelRatio || 1, 1.5);
    c.width = w * d; c.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    for (const p of dots) {
      const x = p.x * w, y = p.y * h, g = ctx.createRadialGradient(x, y, p.r * .55, x, y, p.r);
      g.addColorStop(0, `rgba(${p.h},${p.a})`); g.addColorStop(.9, `rgba(${p.h},${p.a * .6})`); g.addColorStop(1, `rgba(${p.h},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 7); ctx.fill();
    }
  }
  paint(); addEventListener("resize", paint);
})();

/* ---------------- the lens view ----------------
   The photo is drawn on a canvas, cropped to what's visible, instead of scaling a
   huge image layer. Zoom, blur and the iris opening are animated here, and the loop
   only runs while something is moving. */
const view = (() => {
  const canvas = $("photo"), ctx = canvas.getContext("2d");
  const soft = document.createElement("canvas"), sctx = soft.getContext("2d");
  const prev = document.createElement("canvas"), pctx = prev.getContext("2d"); // last frame, for crossfades
  const st = { z: 16, blur: 0, iris: 1, fade: 1, reveal: 1 };
  const tracks = new Map();
  let img = null, fx = .5, fy = .5, W = 0, H = 0, raf = 0, token = 0;

  function resize() {
    const d = Math.min(devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * d), h = Math.round(canvas.clientHeight * d);
    if (!w || (w === W && h === H)) return;
    W = canvas.width = soft.width = prev.width = w; H = canvas.height = soft.height = prev.height = h;
    paint();
  }
  function paint() {
    if (!W) return;
    ctx.fillStyle = "#05070A"; ctx.fillRect(0, 0, W, H);
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = st.reveal;
    if (st.iris < .999) { ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(0, st.iris) * W * .72, 0, 7); ctx.clip(); }
    if (st.blur > .02) {
      // Cheap blur: draw small, then scale back up.
      const k = 1 + st.blur * 16, sw = Math.max(6, Math.round(W / k)), sh = Math.max(6, Math.round(H / k));
      sctx.imageSmoothingQuality = "low";
      drawView(sctx, img, sw, sh, st.z, fx, fy);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(soft, 0, 0, sw, sh, 0, 0, W, H);
    } else {
      ctx.imageSmoothingQuality = "high";
      drawView(ctx, img, W, H, st.z, fx, fy);
    }
    ctx.restore();
    // Crossfade from the previous zoom level (used when the device asks for reduced motion).
    if (st.fade < .999) { ctx.globalAlpha = 1 - st.fade; ctx.drawImage(prev, 0, 0); ctx.globalAlpha = 1; }
  }
  function loop(now) {
    for (const [k, t] of tracks) {
      const p = Math.min(1, (now - t.start) / t.dur);
      st[k] = t.fn(p);
      if (p >= 1) tracks.delete(k);
    }
    paint();
    raf = tracks.size ? requestAnimationFrame(loop) : 0;
  }
  // "gentle" animations (fades) still run when the device asks for reduced motion.
  function animate(key, dur, fn, gentle = false) {
    if ((reduced && !gentle) || dur <= 0) { tracks.delete(key); st[key] = fn(1); return paint(); }
    tracks.set(key, { start: performance.now(), dur, fn });
    if (!raf) raf = requestAnimationFrame(loop);
  }
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  new ResizeObserver(resize).observe(canvas);

  return {
    // Load a puzzle photo and open the iris on it.
    async load(src, z, focusX, focusY) {
      const my = ++token;
      tracks.clear(); img = null; st.z = z; st.blur = 0; st.iris = 1; fx = focusX; fy = focusY;
      paint();
      const im = new Image();
      im.src = src;
      try { await im.decode(); } catch { await new Promise(r => { im.onload = r; im.onerror = r; }); }
      if (my !== token) return;
      img = im; resize();
      if (reduced) { st.reveal = 0; return animate("reveal", 600, t => t, true); }
      st.iris = 0; st.blur = 1;
      animate("iris", 1100, easeOut);
      animate("blur", 1100, t => 1 - easeOut(t));
    },
    // Zoom smoothly to a new level (interpolated in log space so every step feels even).
    zoomTo(z, dur = 1000) {
      const a = Math.log(st.z), b = Math.log(z);
      if (a === b) return;
      if (reduced) { // no zooming motion: fade between the two views instead
        if (W) { pctx.clearRect(0, 0, W, H); pctx.drawImage(canvas, 0, 0); }
        st.z = z; st.fade = 0;
        return animate("fade", 550, t => t, true);
      }
      animate("z", dur, t => Math.exp(a + (b - a) * easeOut(t)));
    },
    // Lose focus for a moment, like a camera hunting.
    hunt() { animate("blur", 900, t => .6 * (t < .3 ? t / .3 : 1 - easeOut((t - .3) / .7))); },
  };
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
  $("msg").textContent = ""; $("msg").className = "msg";
  $("guess-input").value = "";
  $("lens").classList.remove("win");
  view.load(puzzle.image, STEPS[step()], puzzle.focusX, puzzle.focusY);
  draw(true);
}

const step = () => game.status === "playing" ? Math.min(game.guesses.length, 5) : 5;

function draw(fresh) {
  const p = game.puzzle, s = step(), done = game.status !== "playing";
  if (!fresh) view.zoomTo(STEPS[s]);
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
  view.hunt();
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
  // On phones, close the keyboard so the zoom-out is visible, and bring the lens into view.
  if (touch) {
    $("guess-input").blur();
    setTimeout(() => {
      const r = $("lens").getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) $("lens").scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    }, 250);
  } else if (game.status === "playing") $("guess-input").focus();
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

/* ---------------- how to play ---------------- */
const help = (() => {
  const box = $("help"), sheet = box.querySelector(".help-sheet"), SEEN = "zoomout-help-seen";
  let back = null;
  function open() {
    if (!box.hidden) return;
    back = document.activeElement;
    box.classList.remove("closing"); box.hidden = false;
    document.documentElement.classList.add("no-scroll");
    sheet.scrollTop = 0;
    sheet.focus({ preventScroll: true });
  }
  function close() {
    if (box.hidden || box.classList.contains("closing")) return;
    try { localStorage.setItem(SEEN, "1"); } catch {}
    box.classList.add("closing");
    setTimeout(() => {
      box.hidden = true; box.classList.remove("closing");
      document.documentElement.classList.remove("no-scroll");
      if (back && back.focus) back.focus({ preventScroll: true });
    }, reduced ? 0 : 210);
  }
  box.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", e => {
    if (box.hidden) return;
    if (e.key === "Escape") return close();
    if (e.key === "Tab") { // keep keyboard focus inside the guide
      const f = [...sheet.querySelectorAll("button")], first = f[0], last = f[f.length - 1];
      if (document.activeElement === sheet) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  $("help-btn").addEventListener("click", open);
  // First visit: show it once, after the intro animation.
  let seen = true;
  try { seen = !!localStorage.getItem(SEEN) || Object.keys(store.get().results).length > 0; } catch {}
  return { firstVisit() { if (!seen) setTimeout(open, reduced ? 0 : 1300); } };
})();

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
  help.firstVisit();
  const todays = published.find(p => p.date === today);
  todays ? newGame(todays, "daily") : newGame(published[published.length - 1], "fallback");
})();
