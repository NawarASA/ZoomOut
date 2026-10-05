// Private stats page (stats.html): how players did on each daily puzzle so far.
// Reads only the public per-day summary from Supabase, the same one the game uses.
import { CONFIG } from "./config.js";
import { STEPS, isoDate, daysBetween, esc } from "./core.js";
import { crowdEnabled, fetchStats } from "./crowd.js";

const $ = id => document.getElementById(id);
const today = isoDate(new Date());
const NEW_STEPS_FROM = "2026-10-04";
const OLD_STEPS = [16, 8, 4, 2.4, 1.5, 1];
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const shortDate = d => new Date(d + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

async function main() {
  if (!crowdEnabled()) { $("totals").innerHTML = `<p class="muted">Player stats aren't set up (no Supabase details in js/config.js).</p>`; return; }
  const puzzles = (await (await fetch(CONFIG.puzzlesFile, { cache: "no-store" })).json())
    .filter(p => p.date >= CONFIG.launchDate && p.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  const stats = await Promise.all(puzzles.map(p => fetchStats(p.date)));

  const days = puzzles.map((p, i) => ({ p, s: stats[i] || { solvedAt: [0, 0, 0, 0, 0, 0], lost: 0, total: 0 } }));
  const played = days.filter(d => d.s.total);
  const plays = played.reduce((a, d) => a + d.s.total, 0);
  const solved = played.reduce((a, d) => a + d.s.solvedAt.reduce((x, y) => x + y, 0), 0);
  $("totals").innerHTML = [
    ["Results", plays],
    ["Avg players a day", played.length ? (plays / played.length).toFixed(1) : "0"],
    ["Solved overall", `${pct(solved, plays)}%`],
    ["Days with players", `${played.length} of ${days.length}`],
  ].map(([k, v]) => `<div class="tile"><b>${v}</b><span>${k}</span></div>`).join("");

  $("days").innerHTML = days.map(day).join("");
  $("days").addEventListener("click", e => {
    const b = e.target.closest("button.reveal"); if (!b) return;
    b.replaceWith(Object.assign(document.createElement("span"), { textContent: b.dataset.answer }));
  });
}

function day({ p, s }) {
  const steps = p.date < NEW_STEPS_FROM ? OLD_STEPS : STEPS;
  const won = s.solvedAt.reduce((a, b) => a + b, 0);
  const avgStep = won ? s.solvedAt.reduce((a, n, i) => a + n * (i + 1), 0) / won : 0;
  const flag = s.total < 5 ? "" : pct(s.solvedAt[0], s.total) >= 25 ? `<b class="flag easy">Too easy</b>` : pct(won, s.total) < 50 ? `<b class="flag hard">Too hard</b>` : "";
  const answer = p.date === today
    ? `<button class="reveal" type="button" data-answer="${esc(p.answers[0])}">Show today's answer</button>`
    : `<span>${esc(p.answers[0])}</span>`;
  const cols = [...s.solvedAt.map((n, i) => ({ n, label: `${steps[i]}×`, cls: "solved", tip: `Solved at ${steps[i]}×` })), { n: s.lost, label: "Missed", cls: "missed", tip: "Didn't solve it" }];
  const max = Math.max(1, ...cols.map(c => c.n));
  return `<article class="day">
    <header>
      <div><span class="no">No. ${daysBetween(CONFIG.launchDate, p.date) + 1} · ${shortDate(p.date)}</span><h2>${answer}</h2></div>
      ${flag}
    </header>
    <p class="facts">${s.total
      ? `<b>${s.total}</b> player${s.total === 1 ? "" : "s"} · <b>${pct(won, s.total)}%</b> solved${won ? ` · average solve at guess <b>${avgStep.toFixed(1)}</b>` : ""}`
      : `No players yet`}</p>
    ${s.total ? `<div class="bars" role="table" aria-label="Players by zoom for puzzle ${esc(p.date)}">
      ${cols.map(c => `<div class="col ${c.cls}" role="row" title="${c.tip}: ${c.n} player${c.n === 1 ? "" : "s"} (${pct(c.n, s.total)}%)">
        <span class="n" role="cell">${c.n || ""}</span>
        <span class="bar" style="--h:${c.n / max}"></span>
        <span class="lbl" role="cell">${c.label}</span>
      </div>`).join("")}
    </div>` : ""}
  </article>`;
}

main().catch(e => { $("totals").innerHTML = `<p class="muted">Couldn't load the stats (${esc(e.message)}).</p>`; });
