// Removes the sample puzzles and moves the remaining upcoming puzzles up,
// so they run on consecutive days starting today, in the same order.
//
//   node scripts/remove-samples.mjs --dry-run   show the plan, change nothing
//   node scripts/remove-samples.mjs             do it
import { renameSync, unlinkSync, existsSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { root, iso, readPuzzles } from "./lib.mjs";

const dryRun = process.argv.includes("--dry-run");
const puzzles = readPuzzles();
const today = iso(new Date());

const samples = puzzles.filter(p => p.credit === "Sample image");
const rest = puzzles.filter(p => p.credit !== "Sample image").sort((a, b) => a.date.localeCompare(b.date));
const past = rest.filter(p => p.date < today);
const upcoming = rest.filter(p => p.date >= today);

// New consecutive dates from today.
const day = new Date();
const moves = upcoming.map(p => {
  const date = iso(day); day.setDate(day.getDate() + 1);
  const ext = extname(p.image);
  return { p, date, from: p.image, to: `photos/${date}${ext}` };
});

if (dryRun) console.log("Dry run, nothing changed.\n");
for (const s of samples) console.log(`remove      ${s.date}  ${s.answers[0]}`);
for (const m of moves) console.log(`${m.p.date === m.date ? "keep  " : "move  "}      ${m.p.date} → ${m.date}  ${m.p.answers[0]}`);
if (!samples.length && moves.every(m => m.p.date === m.date)) { console.log("Nothing to change."); process.exit(0); }
if (dryRun) process.exit(0);

// Delete the sample photos.
for (const s of samples) { const f = join(root, s.image); if (existsSync(f)) unlinkSync(f); }
// Rename in two steps so no file overwrites another.
for (const m of moves) if (m.from !== m.to) renameSync(join(root, m.from), join(root, m.from + ".moving"));
for (const m of moves) if (m.from !== m.to) renameSync(join(root, m.from + ".moving"), join(root, m.to));
for (const m of moves) { m.p.date = m.date; m.p.image = m.to; }

writeFileSync(join(root, "puzzles.json"), JSON.stringify([...past, ...upcoming], null, 2) + "\n");
console.log(`\nDone. ${samples.length} sample(s) removed, ${upcoming.length} puzzle(s) now run from ${today}.`);
console.log("Run npm run check, then commit and push.");
