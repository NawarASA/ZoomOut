// Schedules every photo in new-photos/ onto the next free days.
//
//   npm run schedule                 schedule in file-name order
//   npm run schedule -- --shuffle    schedule in random order
//   npm run schedule -- --dry-run    show what would happen, change nothing
//
// The file name is the answer. Use - for spaces and + between alternative answers:
//   tennis-ball+ball.jpg   ->  answers: "tennis ball", "ball"
//   sim-card.png           ->  answers: "sim card"
import { readdirSync, renameSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { root, PHOTO_TYPES, iso, fileHash, plain, readPuzzles, readNearWords, applyNear, hasLocation } from "./lib.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const shuffle = args.includes("--shuffle");
const inbox = join(root, "new-photos");
const photosDir = join(root, "photos");

if (!existsSync(inbox)) mkdirSync(inbox);
let files = readdirSync(inbox).filter(f => PHOTO_TYPES.includes(extname(f).toLowerCase())).sort();
if (!files.length) {
  console.log("No photos in new-photos/. Add some, named by their answer (tennis-ball.jpg), and run this again.");
  process.exit(0);
}
if (shuffle) for (let i = files.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [files[i], files[j]] = [files[j], files[i]]; }

let puzzles;
try { puzzles = readPuzzles(); } catch (e) {
  console.error(`puzzles.json isn't valid JSON (${e.message}). Fix it with npm run check first.`);
  process.exit(1);
}

// What's already in the game.
let nearWords = new Map();
try { nearWords = readNearWords(); } catch { console.log("! near-words.json isn't valid JSON, so no close guesses were added."); }
const takenDates = new Set(puzzles.map(p => p.date));
const knownHashes = new Map();
for (const p of puzzles) {
  const path = join(root, p.image || "");
  if (p.image && existsSync(path)) knownHashes.set(fileHash(path), p.date);
}
const usedAnswers = new Map();
for (const p of puzzles) for (const a of p.answers || []) usedAnswers.set(plain(a), p.date);

// Free days from today onward, filling any gaps first.
const day = new Date();
function nextFreeDate() {
  while (takenDates.has(iso(day))) day.setDate(day.getDate() + 1);
  const d = iso(day);
  takenDates.add(d);
  return d;
}

const added = [], skipped = [];
for (const file of files) {
  const src = join(inbox, file);
  const name = basename(file, extname(file));
  const answers = [...new Set(name.split("+").map(a => a.replace(/[-_]+/g, " ").trim().toLowerCase()).filter(Boolean))];

  if (!answers.length) { skipped.push(`${file}: the file name has no answer in it`); continue; }
  if (hasLocation(src)) { skipped.push(`${file}: contains a GPS location. Run npm run photos first`); continue; }
  const hash = fileHash(src);
  if (knownHashes.has(hash)) { skipped.push(`${file}: this exact photo is already the puzzle on ${knownHashes.get(hash)}`); continue; }
  knownHashes.set(hash, "this batch");

  const date = nextFreeDate();
  const ext = extname(file).toLowerCase() === ".jpeg" ? ".jpg" : extname(file).toLowerCase();
  const image = `photos/${date}${ext}`;
  const entry = { date, image, answers, near: [], focusX: 0.5, focusY: 0.5 };
  applyNear(entry, nearWords);
  const repeat = answers.map(plain).find(a => usedAnswers.has(a));
  added.push({ file, entry, note: repeat ? `"${repeat}" was already the answer on ${usedAnswers.get(repeat)}` : "" });
  answers.forEach(a => usedAnswers.set(plain(a), date));
  puzzles.push(entry);

  if (!dryRun) renameSync(src, join(photosDir, `${date}${ext}`));
}

if (!dryRun && added.length) {
  puzzles.sort((a, b) => a.date.localeCompare(b.date));
  writeFileSync(join(root, "puzzles.json"), JSON.stringify(puzzles, null, 2) + "\n");
}

if (dryRun) console.log("Dry run, nothing changed.\n");
for (const { file, entry, note } of added) console.log(`${entry.date}  ${entry.answers.join(" / ").padEnd(28)} ← ${file}${entry.near.length ? "" : "   (no close guesses)"}${note ? `\n            ! ${note}` : ""}`);
for (const s of skipped) console.log(`skipped     ${s}`);
console.log(`\n${added.length} scheduled, ${skipped.length} skipped.`);
if (added.length) {
  console.log("Each new puzzle starts zoomed on the centre of the photo.");
  console.log("Close guesses come from near-words.json. To add some later, edit that file and run node scripts/add-near.mjs.");
  console.log("Then run npm run check.");
}
