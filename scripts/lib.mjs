// Shared helpers for the command-line scripts.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PHOTO_TYPES = [".jpg", ".jpeg", ".png", ".webp"];

export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Fingerprint of a file's contents, so the same photo is caught even under another name.
export const fileHash = path => createHash("sha1").update(readFileSync(path)).digest("hex");

// Plain form of an answer for comparing ("Tennis Ball!" -> "tennis ball").
export const plain = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// The close-guess list in near-words.json, keyed by main answer.
export function readNearWords() {
  const path = join(root, "near-words.json");
  if (!existsSync(path)) return new Map();
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return new Map(Object.entries(raw).filter(([k, v]) => !k.startsWith("_") && Array.isArray(v)).map(([k, v]) => [plain(k), v]));
}

// Add any close guesses from near-words.json to a puzzle. Returns how many were added.
export function applyNear(p, words) {
  const list = words.get(plain(p.answers?.[0] || ""));
  if (!list) return 0;
  const have = new Set((p.near || []).map(plain)), answers = new Set(p.answers.map(plain));
  const add = list.filter(w => !have.has(plain(w)) && !answers.has(plain(w)));
  p.near = [...(p.near || []), ...add];
  return add.length;
}

export function readPuzzles() {
  const path = join(root, "puzzles.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8"));
}
