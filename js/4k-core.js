// Shared by the 4K bonus page (js/4k.js) and its unlock card on the main page (js/bonus.js).
import { CONFIG } from "./config.js";
import { daysBetween } from "./core.js";
import { QUESTIONS } from "./4k-questions.js";

export const MAX = 4000;
const TIERS = [[0, "144p"], [.12, "240p"], [.25, "360p"], [.4, "480p"], [.55, "720p"], [.7, "1080p"], [.85, "1440p"], [1, "4K"]];
export const tier = f => TIERS.filter(([t]) => f >= t).at(-1)[1];
export const fmt = n => n.toLocaleString("en-US");

// Survey counts scaled so a board totals exactly 4,000 points (rounding goes to the top answer).
function points(answers) {
  const total = answers.reduce((s, a) => s + a[1], 0);
  const p = answers.map(a => Math.round(a[1] * MAX / total));
  p[0] += MAX - p.reduce((s, x) => s + x, 0);
  return p;
}

// The board for a day: same number as that day's Zoom Out puzzle; loops through the questions.
export function boardFor(date) {
  const number = daysBetween(CONFIG.launchDate, date) + 1;
  const [question, answers] = QUESTIONS[(number - 1) % QUESTIONS.length];
  const n = (number - 1) % QUESTIONS.length + 1; // the board's illustration (scripts/make-4k-images.mjs)
  return { date, number, question, answers, pts: points(answers), image: `images/4k/${String(n).padStart(2, "0")}.svg` };
}

const blank = () => ({ boards: {}, stats: { played: 0, perfect: 0, best: 0 } });
export const store = {
  get() { try { return JSON.parse(localStorage.getItem("zoomout-4k")) || blank(); } catch { return blank(); } },
  set(v) { try { localStorage.setItem("zoomout-4k", JSON.stringify(v)); } catch {} },
};
export const scoreOf = (board, state) => state.found.reduce((s, i) => s + board.pts[i], 0);

// Has the player finished today's daily Zoom Out puzzle? (game.js saves results under "zoomout-v1")
export function finishedDaily(date) {
  try { const r = JSON.parse(localStorage.getItem("zoomout-v1"))?.results?.[date]; return !!r && r.status !== "playing"; } catch { return false; }
}
