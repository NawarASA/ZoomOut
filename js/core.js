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

// Same word, ignoring spaces, with 1 typo allowed from 5 letters and 2 from 9.
export function close(a, b) {
  if (a === b || a.replace(/ /g, "") === b.replace(/ /g, "")) return true;
  const L = Math.max(a.length, b.length), tol = L >= 9 ? 2 : L >= 5 ? 1 : 0;
  return tol > 0 && lev(a, b) <= tol;
}

// "hit" = correct, "near" = one of the close guesses, "miss" = wrong.
export function judge(guess, puzzle) {
  const g = norm(guess);
  if (puzzle.answers.some(a => close(g, norm(a)))) return "hit";
  const near = (puzzle.near || []).some(a => {
    const n = norm(a);
    return close(g, n) || (n.length > 3 && ` ${g} `.includes(` ${n} `));
  });
  return near ? "near" : "miss";
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
