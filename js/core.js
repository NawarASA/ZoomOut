// Shared game logic used by both the game and the puzzle maker.

// Zoom level for each of the six steps, from closest to the full photo.
export const STEPS = [16, 8, 4, 2.4, 1.5, 1];

// Turn a guess into a plain comparable form: lowercase, no accents,
// no punctuation, no "a/an/the".
export const norm = s => s.toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]/g, " ")
  .replace(/\b(a|an|the|some)\b/g, " ")
  .replace(/\s+/g, " ").trim();

// Edit distance, used to forgive small typos.
export function lev(a, b) {
  const n = b.length, d = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= n; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[n];
}

// Same text, ignoring spaces, with 1 typo allowed from 5 letters and 2 from 9.
export function close(a, b) {
  if (a === b || a.replace(/ /g, "") === b.replace(/ /g, "")) return true;
  const L = Math.max(a.length, b.length), tol = L >= 9 ? 2 : L >= 5 ? 1 : 0;
  return tol > 0 && lev(a, b) <= tol;
}

// Singular and plural count as the same word: mug/mugs, cookie/cookies, glass/glasses.
function forms(w) {
  const f = new Set([w]);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) f.add(w.slice(0, -1));
  if (w.length > 4 && w.endsWith("es")) f.add(w.slice(0, -2));
  if (w.length > 4 && w.endsWith("ies")) f.add(w.slice(0, -3) + "y");
  return f;
}
function sameWord(a, b) {
  if (a === b) return true;
  const fa = forms(a);
  for (const x of forms(b)) if (fa.has(x)) return true;
  return a.length >= 5 && b.length >= 5 && close(a, b); // a typo inside one word
}
// Whole guess matches, word by word, allowing plurals.
function samePhrase(a, b) {
  const wa = a.split(" "), wb = b.split(" ");
  return wa.length === wb.length && wa.every((w, i) => sameWord(w, wb[i]));
}
// Guess and answer share a meaningful word: "coffee" for coffee cake, "golf ball" for tennis ball.
const FILLER = new Set(["and", "with", "for", "from", "made", "piece", "thing", "object", "kind", "type", "one", "some", "very", "big", "small"]);
function shareWord(a, b) {
  const wb = b.split(" ").filter(w => w.length >= 3 && !FILLER.has(w));
  return a.split(" ").some(w => w.length >= 3 && !FILLER.has(w) && wb.some(x => sameWord(w, x)));
}

// "hit" = correct, "near" = close (yellow), "miss" = wrong.
export function judge(guess, puzzle) {
  const g = norm(guess);
  const answers = puzzle.answers.map(norm), near = (puzzle.near || []).map(norm);
  if (answers.some(a => close(g, a) || samePhrase(g, a))) return "hit";
  if (near.some(n => close(g, n) || samePhrase(g, n) || (n.length >= 3 && n.split(" ").length === 1 && shareWord(g, n)))) return "near";
  if (answers.some(a => shareWord(g, a))) return "near";
  return "miss";
}

// Draw the part of the photo visible at zoom z, centred on the focus point
// (fx, fy from 0 to 1) and never past the photo's edge. Only the visible
// crop is drawn, so this stays cheap on phones at any zoom level.
export function drawView(ctx, img, w, h, z, fx, fy) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const side = Math.min(iw, ih), ox = (iw - side) / 2, oy = (ih - side) / 2;
  const s = side / z;
  const cl = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const sx = cl(ox + fx * side - s / 2, ox, ox + side - s);
  const sy = cl(oy + fy * side - s / 2, oy, oy + side - s);
  ctx.drawImage(img, sx, sy, s, s, 0, 0, w, h);
}

// Dates as local "YYYY-MM-DD" strings, so a new puzzle starts at the player's midnight.
export const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
