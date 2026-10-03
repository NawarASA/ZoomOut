// "Faster than X% of players": sends each finished daily result to Supabase and
// reads back a summary for that day. Turned off when config.js has no Supabase details.
import { CONFIG } from "./config.js";

export const crowdEnabled = () => !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);

// A random ID per browser, so one person counts once per day. No personal data.
function playerId() {
  try {
    let id = localStorage.getItem("zoomout-player");
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem("zoomout-player", id); }
    return id;
  } catch { return null; }
}

function call(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  return fetch(`${CONFIG.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    method: "POST",
    headers: { apikey: CONFIG.supabaseKey, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
    signal: ctrl.signal,
  }).finally(() => clearTimeout(timer));
}

// Send a finished daily result once. Returns true if it's (now) counted.
export async function submitResult(date, guesses, won) {
  if (!crowdEnabled()) return false;
  const key = `zoomout-sent-${date}`;
  try { if (localStorage.getItem(key)) return true; } catch {}
  const player = playerId();
  if (!player) return false;
  try {
    const res = await call("results", { puzzle_date: date, player, guesses, won });
    if (res.ok || res.status === 409) { try { localStorage.setItem(key, "1"); } catch {} return true; } // 409 = already counted
  } catch {}
  return false;
}

// Summary for one day: how many players solved it at each zoom, and how many didn't.
export async function fetchStats(date) {
  if (!crowdEnabled()) return null;
  try {
    const res = await call("rpc/puzzle_stats", { d: date });
    if (!res.ok) return null;
    const rows = await res.json();
    const solvedAt = [0, 0, 0, 0, 0, 0];
    let lost = 0;
    for (const r of rows) {
      const n = Number(r.players) || 0;
      if (r.won && r.guesses >= 1 && r.guesses <= 6) solvedAt[r.guesses - 1] += n; else lost += n;
    }
    return { solvedAt, lost, total: solvedAt.reduce((a, b) => a + b, 0) + lost };
  } catch { return null; }
}

// How this result compares. `counted` = whether this player's own result is in the stats.
export function compare(stats, guesses, won, counted) {
  const solvedAt = stats.solvedAt.slice();
  let lost = stats.lost;
  if (counted) { if (won) solvedAt[guesses - 1] = Math.max(0, solvedAt[guesses - 1] - 1); else lost = Math.max(0, lost - 1); }
  const others = solvedAt.reduce((a, b) => a + b, 0) + lost;
  const worse = won ? solvedAt.slice(guesses).reduce((a, b) => a + b, 0) + lost : 0;
  const solved = stats.solvedAt.reduce((a, b) => a + b, 0);
  return {
    others,
    total: stats.total,
    betterThan: others ? Math.round(worse / others * 100) : 0,
    solvedPct: stats.total ? Math.round(solved / stats.total * 100) : 0,
  };
}
