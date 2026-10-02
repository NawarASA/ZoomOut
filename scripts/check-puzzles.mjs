// Checks puzzles.json for mistakes and shows how many days of puzzles are left.
// Run with: npm run check
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { root, iso, fileHash, plain } from "./lib.mjs";

const errors = [], warnings = [];

let list;
try {
  list = JSON.parse(readFileSync(join(root, "puzzles.json"), "utf8"));
} catch (e) {
  console.error(`✗ puzzles.json isn't valid JSON: ${e.message}`);
  console.error("  Common causes: a missing comma between entries, or a comma after the last one.");
  process.exit(1);
}
if (!Array.isArray(list)) { console.error("✗ puzzles.json must be a list: [ {...}, {...} ]"); process.exit(1); }

const seen = new Set(), imagePaths = new Map(), hashes = new Map(), answers = new Map();
list.forEach((p, i) => {
  const where = `Entry ${i + 1}${p && p.date ? ` (${p.date})` : ""}`;
  if (!p || typeof p !== "object") return errors.push(`${where}: not an object`);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "")) errors.push(`${where}: date must look like 2026-10-04`);
  else if (seen.has(p.date)) errors.push(`${where}: two puzzles on the same date`);
  seen.add(p.date);

  if (!p.image) errors.push(`${where}: missing "image"`);
  else {
    const path = join(root, p.image);
    if (imagePaths.has(p.image)) errors.push(`${where}: uses the same photo file as ${imagePaths.get(p.image)}`);
    else if (!existsSync(path)) errors.push(`${where}: photo not found at ${p.image}`);
    else {
      const h = fileHash(path);
      if (hashes.has(h) && hashes.get(h) !== p.date) errors.push(`${where}: same photo as ${hashes.get(h)}, saved under a different name`);
      hashes.set(h, p.date);
      const mb = statSync(path).size / 1e6;
      if (mb > 2) warnings.push(`${where}: photo is ${mb.toFixed(1)} MB and will load slowly. Run it through the puzzle maker to shrink it.`);
    }
    if (!imagePaths.has(p.image)) imagePaths.set(p.image, p.date);
  }

  if (!Array.isArray(p.answers) || !p.answers.length || p.answers.some(a => typeof a !== "string" || !a.trim())) errors.push(`${where}: "answers" needs at least one answer`);
  else {
    const main = plain(p.answers[0]);
    if (answers.has(main)) warnings.push(`${where}: "${p.answers[0]}" was already the answer on ${answers.get(main)}`);
    answers.set(main, p.date);
  }
  if (p.near !== undefined && !Array.isArray(p.near)) errors.push(`${where}: "near" must be a list`);
  for (const k of ["focusX", "focusY"]) if (typeof p[k] !== "number" || p[k] < 0 || p[k] > 1) errors.push(`${where}: ${k} must be a number from 0 to 1`);
  if (p.credit === "Sample image") warnings.push(`${where}: still a sample puzzle. Replace it before launch.`);
});

const today = iso(new Date());
const dates = [...seen].filter(Boolean).sort();
const last = dates[dates.length - 1];
const gaps = [];
if (last && last >= today) for (let d = new Date(); iso(d) <= last; d.setDate(d.getDate() + 1)) if (!seen.has(iso(d))) gaps.push(iso(d));

for (const w of warnings) console.log(`! ${w}`);
for (const e of errors) console.log(`✗ ${e}`);
if (warnings.length || errors.length) console.log("");
console.log(`${list.length} puzzles in the list.`);
console.log(seen.has(today) ? "Today's puzzle is ready." : "No puzzle for today. Players will see the most recent one.");
if (last >= today) {
  const daysLeft = Math.round((new Date(last) - new Date(today)) / 864e5);
  console.log(`Puzzles scheduled until ${last} (${daysLeft} more day${daysLeft === 1 ? "" : "s"}).`);
} else console.log("Nothing scheduled after today.");
if (gaps.length) console.log(`Missing days: ${gaps.join(", ")}`);
console.log(errors.length ? `\n${errors.length} problem(s) to fix.` : "\nAll good.");
process.exit(errors.length ? 1 : 0);
