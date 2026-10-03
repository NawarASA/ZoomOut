import { CONFIG } from "./config.js";
import { STEPS, drawView, isoDate, parseDate } from "./core.js";

const $ = id => document.getElementById(id);
const SIZE = 1600;          // saved photos are 1600×1600 JPEGs
const mk = { blob: null, url: null, img: null, focusX: .5, focusY: .5 };
let taken = new Set();

$("mk-strip").innerHTML = STEPS.map(z => `<div class="thumb"><div><canvas></canvas></div>${z}×</div>`).join("");

/* What's already scheduled, and the next free day. */
(async () => {
  let list = [];
  try { list = await (await fetch(CONFIG.puzzlesFile, { cache: "no-store" })).json(); } catch {}
  taken = new Set(list.map(p => p.date));
  const today = isoDate(new Date());
  const last = [...taken].sort().pop();
  const next = last && last >= today ? parseDate(last) : new Date();
  if (last && last >= today) next.setDate(next.getDate() + 1);
  $("mk-date").value = isoDate(next);
  const ahead = [...taken].filter(d => d > today).length;
  $("schedule").innerHTML = list.length
    ? `<b>${list.length}</b> puzzles in the list. <b>${ahead}</b> scheduled after today${last ? `, the last on <b>${parseDate(last).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</b>` : ""}.`
    : "No puzzles in the list yet.";
  update();
})();

/* Load a photo, crop it to the centre square and scale it to SIZE. */
function load(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const img = new Image();
  img.onload = () => {
    const side = Math.min(img.width, img.height), c = document.createElement("canvas");
    c.width = c.height = SIZE;
    c.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
    URL.revokeObjectURL(img.src);
    c.toBlob(blob => {
      if (mk.url) URL.revokeObjectURL(mk.url);
      mk.blob = blob; mk.url = URL.createObjectURL(blob); mk.focusX = mk.focusY = .5;
      $("mk-img").src = mk.url;
      mk.img = c;
      $("mk-editor").hidden = false;
      update();
    }, "image/jpeg", 0.88);
  };
  img.src = URL.createObjectURL(file);
}
$("mk-file").addEventListener("change", e => load(e.target.files[0]));
const drop = $("drop");
["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => load(e.dataTransfer.files[0]));

$("mk-stage").addEventListener("click", e => {
  const b = $("mk-stage").getBoundingClientRect();
  mk.focusX = +((e.clientX - b.left) / b.width).toFixed(3);
  mk.focusY = +((e.clientY - b.top) / b.height).toFixed(3);
  update();
});
["mk-answers", "mk-near", "mk-credit", "mk-date"].forEach(id => $(id).addEventListener("input", update));

const split = v => v.split(",").map(s => s.trim()).filter(Boolean);
function entry() {
  const date = $("mk-date").value, e = { date, image: `photos/${date}.jpg`, answers: split($("mk-answers").value), near: split($("mk-near").value), focusX: mk.focusX, focusY: mk.focusY };
  const credit = $("mk-credit").value.trim();
  if (credit) e.credit = credit;
  return e;
}

function update() {
  $("mk-dot").style.left = mk.focusX * 100 + "%";
  $("mk-dot").style.top = mk.focusY * 100 + "%";
  if (mk.img) $("mk-strip").querySelectorAll("canvas").forEach((t, i) => {
    const d = Math.min(devicePixelRatio || 1, 2), w = Math.round(t.clientWidth * d) || 120;
    t.width = t.height = w;
    drawView(t.getContext("2d"), mk.img, w, w, STEPS[i], mk.focusX, mk.focusY);
  });
  $("mk-json").textContent = JSON.stringify(entry(), null, 2);
  const d = $("mk-date").value;
  $("mk-date-note").textContent = taken.has(d) ? "There's already a puzzle on this date." : "";
  $("mk-date-note").style.color = taken.has(d) ? "var(--miss)" : "";
}

$("mk-download").addEventListener("click", () => {
  if (!mk.blob) return;
  const a = document.createElement("a");
  a.href = mk.url; a.download = `${$("mk-date").value || "puzzle"}.jpg`;
  document.body.appendChild(a); a.click(); a.remove();
});

$("mk-copy").addEventListener("click", () => {
  const btn = $("mk-copy");
  if (!entry().answers.length) { $("mk-answers").focus(); $("mk-answers").placeholder = "Add at least one answer first"; return; }
  const text = JSON.stringify(entry(), null, 2);
  navigator.clipboard.writeText(text).then(
    () => { btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy puzzle entry", 1800); },
    () => { const r = document.createRange(); r.selectNodeContents($("mk-json")); getSelection().removeAllRanges(); getSelection().addRange(r); }
  );
});
