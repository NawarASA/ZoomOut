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

export function readPuzzles() {
  const path = join(root, "puzzles.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8"));
}
