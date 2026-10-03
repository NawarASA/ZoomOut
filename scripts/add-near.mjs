// Fills in close guesses (shown yellow) for every puzzle from near-words.json.
// Existing close guesses are kept; words that are already answers are skipped.
//
//   node scripts/add-near.mjs
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { root, readPuzzles, readNearWords, applyNear } from "./lib.mjs";

let words;
try { words = readNearWords(); } catch (e) {
  console.error(`near-words.json isn't valid JSON (${e.message}).`);
  console.error("Check for a missing comma between lines, or a comma after the last one.");
  process.exit(1);
}
const puzzles = readPuzzles();
let changed = 0;
const missing = [];
for (const p of puzzles) {
  const n = applyNear(p, words);
  if (n) { changed++; console.log(`${p.date}  ${p.answers[0].padEnd(16)} +${n} close guesses`); }
  if (!p.near || !p.near.length) missing.push(`${p.date} ${p.answers[0]}`);
}
if (changed) writeFileSync(join(root, "puzzles.json"), JSON.stringify(puzzles, null, 2) + "\n");
console.log(`\n${changed} puzzle(s) updated.`);
if (missing.length) {
  console.log(`\nNo close guesses yet for: ${missing.join(", ")}`);
  console.log(`Add them to near-words.json, keyed by the answer, and run this again.`);
}
