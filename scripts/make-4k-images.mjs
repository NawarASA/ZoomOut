// Draws the 4K bonus-round illustrations: one SVG per board, matching js/4k-questions.js.
// Board N shows images/4k/NN.svg (01–30). Run again after editing a scene:
//   node scripts/make-4k-images.mjs
// Flat style, 800x500 (16:10, the viewfinder's shape). Keep them as hints of the topic,
// not a list of the answers: players see them sharpen as they score.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { root } from "./lib.mjs";

const W = 800, H = 500;
let uid = 0;
const id = p => `${p}${++uid}`;

/* ---------- building blocks ---------- */
const sky = (top, bottom) => { const g = id("s"); return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#${g})"/>`; };
const sun = (x, y, r, c, glow = .35) => `<circle cx="${x}" cy="${y}" r="${r * 1.9}" fill="${c}" opacity="${glow * .4}"/><circle cx="${x}" cy="${y}" r="${r * 1.4}" fill="${c}" opacity="${glow}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const moon = (x, y, r, bg) => `<circle cx="${x}" cy="${y}" r="${r * 1.6}" fill="#F4EBC8" opacity=".12"/><circle cx="${x}" cy="${y}" r="${r}" fill="#F4EBC8"/><circle cx="${x + r * .45}" cy="${y - r * .25}" r="${r * .9}" fill="${bg}"/>`;
function stars(n, seed, maxY = H * .6, c = "#fff") {
  let s = seed, out = "";
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) out += `<circle cx="${(rnd() * W).toFixed(1)}" cy="${(rnd() * maxY).toFixed(1)}" r="${(0.8 + rnd() * 1.8).toFixed(1)}" fill="${c}" opacity="${(0.4 + rnd() * .6).toFixed(2)}"/>`;
  return out;
}
const hill = (pts, c) => `<path d="M0 ${H} L${pts} L${W} ${H} Z" fill="${c}"/>`;
const cloud = (x, y, s, c = "#fff", o = .9) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}" opacity="${o}"><circle cx="0" cy="0" r="26"/><circle cx="30" cy="-12" r="32"/><circle cx="62" cy="0" r="24"/><rect x="0" y="-4" width="62" height="28" rx="12"/></g>`;
const pine = (x, y, s, c = "#1F6F4A", t = "#5A3B22") => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-5" y="0" width="10" height="22" fill="${t}"/><path d="M0 -90 L32 -30 L18 -30 L40 0 L-40 0 L-18 -30 L-32 -30 Z" fill="${c}"/></g>`;
const tree = (x, y, s, c = "#2E9E62") => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-7" y="-10" width="14" height="60" rx="4" fill="#6B4528"/><circle cx="0" cy="-40" r="40" fill="${c}"/><circle cx="-28" cy="-18" r="26" fill="${c}"/><circle cx="28" cy="-18" r="26" fill="${c}"/></g>`;
const palm = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 C 6 -60 14 -110 30 -160" stroke="#8A5A33" stroke-width="12" fill="none" stroke-linecap="round"/><g fill="#2BA65E"><path d="M30 -160 C 70 -170 100 -150 120 -120 C 90 -140 60 -145 30 -160Z"/><path d="M30 -160 C -10 -175 -45 -160 -60 -130 C -30 -150 0 -152 30 -160Z"/><path d="M30 -160 C 50 -200 85 -210 110 -200 C 80 -195 55 -185 30 -160Z"/><path d="M30 -160 C 10 -200 -25 -210 -50 -195 C -20 -192 5 -185 30 -160Z"/></g></g>`;
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
const NIGHT = "#0E1430";

/* ---------- the 30 scenes, in board order ---------- */
const scenes = [
  // 1 hike
  () => sky("#7EC8F2", "#D8F0FF") + sun(640, 90, 38, "#FFD34D") + hill("0 250 L170 110 L300 260 L430 90 L600 280 L720 160 L800 230", "#6C7FA8") +
    `<path d="M170 110 L200 160 L140 160 Z M430 90 L465 150 L398 150 Z" fill="#fff"/>` + hill("0 330 C 200 290 400 360 800 300", "#5DB86E") +
    `<path d="M380 500 C 360 440 470 410 430 360 C 400 330 470 320 450 300" stroke="#E8C98A" stroke-width="26" fill="none" stroke-linecap="round"/>` +
    pine(120, 380, 1) + pine(200, 400, 1.2) + pine(680, 390, 1.1) +
    `<g transform="translate(560 330)"><rect x="0" y="0" width="90" height="120" rx="22" fill="#E2552F"/><rect x="12" y="50" width="66" height="44" rx="10" fill="#C44121"/><path d="M15 0 C15 -40 75 -40 75 0" stroke="#7A2A14" stroke-width="10" fill="none"/></g>` +
    `<g transform="translate(680 390)"><rect x="0" y="0" width="34" height="70" rx="10" fill="#4FB6E8"/><rect x="6" y="-12" width="22" height="14" rx="4" fill="#2C6E9A"/></g>`,
  // 2 waking up
  () => sky("#FFB37A", "#FFE3B8") + sun(560, 210, 50, "#FFF2A8") + `<rect x="430" y="60" width="300" height="230" fill="none" stroke="#7A4B2A" stroke-width="16"/><line x1="580" y1="60" x2="580" y2="290" stroke="#7A4B2A" stroke-width="10"/>` +
    `<rect width="${W}" height="500" fill="#F1D3B3" opacity=".001"/><rect x="0" y="340" width="800" height="160" fill="#C9A27A"/>` +
    `<g><rect x="40" y="250" width="360" height="120" rx="18" fill="#FFFFFF"/><rect x="40" y="300" width="360" height="90" rx="14" fill="#7D9BE0"/><rect x="60" y="262" width="110" height="46" rx="20" fill="#E9EEF8"/><rect x="30" y="230" width="20" height="170" rx="6" fill="#7A4B2A"/></g>` +
    `<g transform="translate(470 360)"><rect width="200" height="16" rx="4" fill="#7A4B2A"/><rect x="20" y="16" width="14" height="80" fill="#7A4B2A"/><rect x="166" y="16" width="14" height="80" fill="#7A4B2A"/></g>` +
    `<g transform="translate(500 300)"><path d="M0 0 h50 v50 a14 14 0 0 1 -14 14 h-22 a14 14 0 0 1 -14 -14Z" fill="#fff"/><path d="M50 12 a14 14 0 0 1 0 26" stroke="#fff" stroke-width="7" fill="none"/><path d="M14 -8 c-6 -10 6 -16 0 -26 M30 -8 c-6 -10 6 -16 0 -26" stroke="#fff" stroke-width="4" fill="none" opacity=".7"/></g>` +
    `<g transform="translate(600 318)"><rect width="40" height="44" rx="6" fill="#30384A"/><rect x="5" y="5" width="30" height="34" rx="3" fill="#8FE3FF"/></g>`,
  // 3 beach
  () => sky("#5FC4F0", "#BFEAFF") + sun(130, 90, 40, "#FFE066") + cloud(520, 90, 1) + `<rect x="0" y="230" width="800" height="110" fill="#1F8FD1"/><path d="M0 250 q40 -10 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" stroke="#7FD3FF" stroke-width="4" fill="none"/>` +
    `<path d="M0 330 C 200 300 500 350 800 320 L800 500 L0 500 Z" fill="#F3D79A"/>` +
    `<g transform="translate(470 230)"><line x1="0" y1="0" x2="20" y2="230" stroke="#6B4528" stroke-width="7"/><path d="M-150 30 C -110 -40 110 -40 150 30 Z" fill="#E94B5B"/><path d="M-75 15 C -50 -35 0 -38 0 -38 C 0 -38 50 -35 75 15 Z" fill="#FFF"/></g>` +
    `<rect x="120" y="390" width="230" height="70" rx="8" fill="#3BB4A0" transform="rotate(-6 235 425)"/><rect x="120" y="406" width="230" height="14" fill="#fff" opacity=".7" transform="rotate(-6 235 425)"/>` +
    `<g transform="translate(620 420)" fill="#E2552F"><ellipse cx="0" cy="0" rx="34" ry="22"/><circle cx="-40" cy="-14" r="12"/><circle cx="40" cy="-14" r="12"/><rect x="-6" y="-34" width="4" height="14"/><rect x="2" y="-34" width="4" height="14"/></g>` +
    `<g transform="translate(450 450)"><path d="M0 0 L22 -30 L44 0 Z" fill="#F7B2C4"/><path d="M8 0 L22 -22 M22 0 L22 -26 M36 0 L22 -22" stroke="#D97E98" stroke-width="2"/></g>`,
  // 4 fears
  () => sky("#121224", "#2A1E3A") + moon(650, 90, 40, "#161629") + stars(40, 4, 250) +
    `<g stroke="#C9C9E0" stroke-width="1.6" fill="none" opacity=".75"><path d="M0 0 L200 160 M0 80 L200 160 M80 0 L200 160 M0 160 L200 160 M170 0 L200 160"/><path d="M40 32 Q60 56 64 51 M80 64 Q108 94 110 88 M120 96 Q150 120 160 128"/><path d="M30 24 Q24 50 0 48 M60 48 Q48 80 0 96 M100 80 Q80 110 0 144"/></g>` +
    `<line x1="290" y1="0" x2="290" y2="170" stroke="#C9C9E0" stroke-width="2"/><g transform="translate(290 190)" fill="#111"><ellipse rx="22" ry="26"/><circle cy="-30" r="14"/><g stroke="#111" stroke-width="5" fill="none"><path d="M-18 -10 L-48 -30 L-60 -10 M-18 0 L-52 0 L-62 20 M-18 10 L-46 30 L-54 50 M18 -10 L48 -30 L60 -10 M18 0 L52 0 L62 20 M18 10 L46 30 L54 50"/></g><circle cx="-5" cy="-33" r="3" fill="#E33"/><circle cx="5" cy="-33" r="3" fill="#E33"/></g>` +
    hill("0 420 C 200 400 500 440 800 410", "#0A0A14") +
    `<path d="M430 470 C 470 430 520 480 560 445 C 600 410 650 470 700 440" stroke="#3E8E3E" stroke-width="20" fill="none" stroke-linecap="round"/><circle cx="702" cy="438" r="14" fill="#3E8E3E"/><circle cx="706" cy="434" r="3" fill="#FF0"/>` +
    `<g fill="#FFF7A0"><ellipse cx="120" cy="330" rx="9" ry="5"/><ellipse cx="146" cy="330" rx="9" ry="5"/><ellipse cx="560" cy="300" rx="7" ry="4"/><ellipse cx="582" cy="300" rx="7" ry="4"/></g>`,
  // 5 yellow fruit
  () => sky("#FFF3C4", "#FFD98A") + `<ellipse cx="400" cy="420" rx="320" ry="40" fill="#E0A94A" opacity=".5"/>` +
    `<path d="M150 330 C 200 470 600 470 650 330 Z" fill="#B5643C"/><path d="M140 330 h520" stroke="#8E4A2A" stroke-width="14" stroke-linecap="round"/>` +
    `<g transform="translate(470 250)"><ellipse cx="0" cy="40" rx="60" ry="80" fill="#F2B632"/><path d="M-40 0 L40 80 M-40 80 L40 0 M-55 40 L55 40" stroke="#C9871E" stroke-width="5"/><path d="M0 -40 L-30 -110 M0 -40 L0 -125 M0 -40 L30 -110 M0 -40 L-50 -85 M0 -40 L50 -85" stroke="#3E9B4B" stroke-width="16" stroke-linecap="round"/></g>` +
    `<path d="M200 300 C 230 220 360 200 420 240 C 360 230 260 250 230 310 Z" fill="#FFE135"/><path d="M200 300 C 230 220 360 200 420 240" stroke="#C9A41A" stroke-width="4" fill="none"/>` +
    `<ellipse cx="300" cy="320" rx="52" ry="40" fill="#FFF04A"/><ellipse cx="350" cy="318" rx="10" ry="6" fill="#D6C21A"/>` +
    `<path d="M570 330 C 520 330 520 260 560 250 C 560 220 590 220 590 250 C 630 260 630 330 570 330 Z" fill="#D9E34A"/><path d="M575 225 l5 -18" stroke="#6B4528" stroke-width="5"/>`,
  // 6 mountain
  () => sky("#8AD0FF", "#E6F6FF") + cloud(110, 80, .9) + hill("0 300 L140 150 L250 270 L400 70 L560 290 L680 140 L800 260", "#7486A8") +
    `<path d="M400 70 L450 150 L420 140 L400 160 L380 140 L350 150 Z M140 150 L170 200 L110 200 Z M680 140 L712 190 L650 190 Z" fill="#fff"/>` +
    hill("0 360 C 250 320 550 380 800 330", "#4FA66A") + pine(80, 420, 1.2) + pine(160, 440, 1) + pine(700, 430, 1.3) + pine(620, 450, 1) +
    `<g fill="#8C8C96"><ellipse cx="330" cy="455" rx="60" ry="28"/><ellipse cx="400" cy="465" rx="40" ry="20"/></g>` +
    `<g transform="translate(500 405)" fill="#F4F1EA"><ellipse cx="0" cy="0" rx="40" ry="22"/><rect x="-30" y="12" width="8" height="30"/><rect x="22" y="12" width="8" height="30"/><circle cx="40" cy="-18" r="14"/><path d="M36 -30 q-6 -16 -16 -16 M46 -30 q4 -16 14 -14" stroke="#7A6A55" stroke-width="4" fill="none"/></g>`,
  // 7 packing
  () => sky("#B9C6FF", "#E9EDFF") + `<rect x="0" y="380" width="800" height="120" fill="#A7B3E6"/>` +
    `<g transform="translate(180 170)"><rect x="0" y="90" width="440" height="200" rx="20" fill="#2F4C8C"/><rect x="20" y="110" width="400" height="160" rx="14" fill="#5E7FC9"/><path d="M0 90 L60 -40 L500 -40 L440 90 Z" fill="#3A5BA3"/>` +
    `<rect x="40" y="130" width="140" height="90" rx="10" fill="#F7C6D9"/><rect x="200" y="140" width="120" height="80" rx="10" fill="#FFE6A3"/><rect x="330" y="130" width="70" height="110" rx="10" fill="#9BE3C9"/>` +
    `<rect x="70" y="230" width="90" height="30" rx="6" fill="#E94B5B"/><circle cx="345" cy="250" r="0"/></g>` +
    `<g transform="translate(560 410)"><rect width="70" height="90" rx="8" fill="#8A2537"/><circle cx="35" cy="40" r="16" fill="none" stroke="#E7C26B" stroke-width="4"/></g>` +
    `<g transform="translate(120 420) rotate(-20)"><rect width="110" height="12" rx="6" fill="#4FB6E8"/><rect x="96" y="-12" width="20" height="16" rx="4" fill="#fff"/></g>` +
    `<path d="M660 470 C 700 420 740 470 760 430" stroke="#30384A" stroke-width="7" fill="none"/><rect x="740" y="410" width="34" height="26" rx="5" fill="#30384A"/>`,
  // 8 farm
  () => sky("#7EC8F2", "#D9F1FF") + sun(680, 80, 36, "#FFD34D") + cloud(120, 70, .8) + hill("0 300 C 200 260 500 320 800 280", "#7CC46A") +
    `<g transform="translate(90 150)"><rect x="0" y="80" width="220" height="150" fill="#C8322F"/><path d="M-20 90 L110 0 L240 90 Z" fill="#9E2421"/><rect x="80" y="140" width="60" height="90" fill="#F4E9D8"/><path d="M80 140 L140 230 M140 140 L80 230" stroke="#C8322F" stroke-width="6"/><rect x="90" y="40" width="40" height="34" fill="#F4E9D8"/></g>` +
    `<path d="M0 400 h800 M0 430 h800" stroke="#B88A5A" stroke-width="8"/>` + Array.from({ length: 17 }, (_, i) => `<rect x="${i * 50}" y="380" width="10" height="70" fill="#9E7148"/>`).join("") +
    `<g transform="translate(470 320)"><ellipse cx="0" cy="0" rx="70" ry="42" fill="#fff"/><ellipse cx="-20" cy="-8" rx="22" ry="16" fill="#222"/><ellipse cx="30" cy="10" rx="16" ry="12" fill="#222"/><rect x="-50" y="25" width="12" height="40" fill="#fff"/><rect x="40" y="25" width="12" height="40" fill="#fff"/><ellipse cx="78" cy="-18" rx="26" ry="22" fill="#fff"/><ellipse cx="92" cy="-8" rx="14" ry="10" fill="#F2A3B0"/></g>` +
    `<g transform="translate(660 440)"><ellipse cx="0" cy="0" rx="26" ry="22" fill="#F4F1EA"/><circle cx="20" cy="-22" r="12" fill="#F4F1EA"/><path d="M20 -36 l-4 -8 l6 4 l4 -8 l2 10Z" fill="#E33"/><path d="M32 -22 l10 3 l-10 3Z" fill="#F2A12B"/></g>`,
  // 9 first date
  () => sky("#2A1B3D", "#4B2A55") + `<rect x="470" y="40" width="260" height="200" rx="12" fill="#1A2350"/>` + moon(600, 110, 34, "#1A2350") + stars(14, 9, 220) +
    `<rect x="0" y="330" width="800" height="170" fill="#3A1F2E"/><ellipse cx="400" cy="330" rx="330" ry="40" fill="#F4ECE0"/><rect x="70" y="330" width="660" height="80" fill="#F4ECE0"/>` +
    `<rect x="388" y="230" width="24" height="80" rx="6" fill="#FFF6E0"/><path d="M400 200 C 388 215 392 228 400 232 C 408 228 412 215 400 200 Z" fill="#FFB12E"/><circle cx="400" cy="220" r="40" fill="#FFB12E" opacity=".18"/>` +
    `<g fill="none" stroke="#E9E4F5" stroke-width="5"><path d="M260 240 C 255 290 315 290 310 240 Z" fill="#9C1B3A" fill-opacity=".85"/><path d="M285 285 v40 M265 325 h40"/><path d="M490 240 C 485 290 545 290 540 240 Z" fill="#9C1B3A" fill-opacity=".85"/><path d="M515 285 v40 M495 325 h40"/></g>` +
    `<path d="M380 390 c-20 -22 -50 0 -20 26 l40 30 l40 -30 c30 -26 0 -48 -20 -26 l-20 18 Z" fill="#FF5C8D" opacity=".85"/>`,
  // 10 Switzerland
  () => sky("#6FC0F5", "#E2F4FF") + hill("0 330 L220 190 L330 300 L470 60 L600 300 L800 200", "#8C9BB8") +
    `<path d="M470 60 L520 150 L490 140 L470 165 L452 140 L420 150 Z" fill="#fff"/>` + hill("0 380 C 250 340 550 400 800 350", "#5CB370") +
    `<g transform="translate(90 70)"><rect width="110" height="110" fill="#D52B1E"/><rect x="45" y="20" width="20" height="70" fill="#fff"/><rect x="20" y="45" width="70" height="20" fill="#fff"/></g>` +
    `<g transform="translate(110 400)"><rect width="170" height="70" rx="6" fill="#5A2E1E"/><path d="M0 0 h170 v70 h-170Z" fill="none" stroke="#7A4130" stroke-width="3"/><path d="M57 0 v70 M113 0 v70 M0 35 h170" stroke="#7A4130" stroke-width="3"/></g>` +
    `<g transform="translate(520 400)"><path d="M0 70 L160 70 L160 20 Z" fill="#F7CD4A"/><circle cx="110" cy="50" r="8" fill="#E2B12F"/><circle cx="140" cy="42" r="6" fill="#E2B12F"/></g>` +
    `<g transform="translate(400 440)"><circle r="36" fill="#E8EEF5" stroke="#5C6577" stroke-width="7"/><path d="M0 0 v-22 M0 0 h16" stroke="#222" stroke-width="4" stroke-linecap="round"/></g>`,
  // 11 keys
  () => sky("#202634", "#2E3648") + `<g transform="translate(60 60)">` + Array.from({ length: 14 }, (_, i) => `<rect x="${i * 48}" y="0" width="46" height="200" rx="4" fill="#F7F7F2"/>`).join("") +
    [0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map(i => `<rect x="${i * 48 + 32}" y="0" width="30" height="120" rx="3" fill="#15171C"/>`).join("") + `</g>` +
    `<g transform="translate(160 330)"><circle r="38" fill="none" stroke="#C9CED8" stroke-width="10"/>` +
    `<g transform="rotate(30)"><rect x="30" y="-8" width="130" height="16" rx="6" fill="#E7C26B"/><rect x="120" y="8" width="12" height="16" fill="#E7C26B"/><rect x="140" y="8" width="12" height="22" fill="#E7C26B"/><circle cx="34" cy="0" r="22" fill="#E7C26B"/></g>` +
    `<g transform="rotate(80)"><rect x="30" y="-7" width="110" height="14" rx="6" fill="#B9C2D0"/><rect x="104" y="7" width="10" height="16" fill="#B9C2D0"/><circle cx="34" cy="0" r="20" fill="#B9C2D0"/></g></g>` +
    `<g transform="translate(400 330)"><rect width="340" height="130" rx="14" fill="#3B4458"/>` + Array.from({ length: 30 }, (_, i) => `<rect x="${14 + (i % 10) * 32}" y="${14 + Math.floor(i / 10) * 34}" width="26" height="26" rx="5" fill="#59647D"/>`).join("") + `<rect x="80" y="${14 + 3 * 34 - 4}" width="180" height="20" rx="5" fill="#59647D"/></g>`,
  // 12 pizza
  () => sky("#3A2416", "#5C3A22") + `<circle cx="400" cy="250" r="230" fill="#7A4B2A" opacity=".4"/>` +
    `<circle cx="400" cy="250" r="200" fill="#E0A458"/><circle cx="400" cy="250" r="176" fill="#D9442B"/><circle cx="400" cy="250" r="168" fill="#F6D27A" opacity=".85"/>` +
    [[330, 170], [450, 160], [520, 250], [460, 340], [340, 330], [290, 250], [400, 250]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="26" fill="#B5302A"/><circle cx="${x - 6}" cy="${y - 6}" r="6" fill="#D9584E"/>`).join("") +
    [[390, 180], [500, 310], [300, 300], [420, 320]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M-16 0 a16 14 0 0 1 32 0 Z" fill="#E8DCC4"/><rect x="-5" y="0" width="10" height="12" fill="#E8DCC4"/></g>`).join("") +
    [[360, 230], [470, 220], [430, 280], [350, 380]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#2A2A2A" stroke-width="6"/>`).join("") +
    `<path d="M400 250 L400 50 M400 250 L573 150 M400 250 L573 350 M400 250 L400 450 M400 250 L227 350 M400 250 L227 150" stroke="#C9832E" stroke-width="3" opacity=".6"/>`,
  // 13 can't sleep
  () => sky(NIGHT, "#1C2550") + moon(130, 100, 44, NIGHT) + stars(60, 13, 300) +
    `<rect x="0" y="380" width="800" height="120" fill="#141A38"/>` +
    [[380, 230], [520, 180], [660, 230]].map(([x, y], i) => `<g transform="translate(${x} ${y}) rotate(${-12 + i * 12})"><ellipse rx="44" ry="30" fill="#F4F4F8"/><circle cx="-14" cy="-14" r="16" fill="#F4F4F8"/><circle cx="14" cy="-16" r="15" fill="#F4F4F8"/><ellipse cx="46" cy="-4" rx="16" ry="14" fill="#3A3A46"/><rect x="-28" y="22" width="7" height="22" fill="#3A3A46"/><rect x="20" y="22" width="7" height="22" fill="#3A3A46"/></g>`).join("") +
    `<path d="M300 380 v-60 M300 330 h200 M500 380 v-60 M300 355 h200" stroke="#6B4E36" stroke-width="10"/>` +
    `<g transform="translate(110 400)"><rect width="150" height="70" rx="12" fill="#2C2C3A"/><text x="75" y="48" font-family="monospace" font-size="38" font-weight="700" fill="#FF5C5C" text-anchor="middle">3:07</text></g>`,
  // 14 late for work
  () => sky("#93A4B8", "#C9D3DE") + cloud(80, 70, 1.2, "#7C8898") + cloud(520, 60, 1, "#8793A3") +
    `<g stroke="#9DB6D6" stroke-width="3" opacity=".7">` + Array.from({ length: 30 }, (_, i) => `<line x1="${(i * 53) % 800}" y1="${110 + (i * 37) % 120}" x2="${(i * 53) % 800 - 8}" y2="${130 + (i * 37) % 120}"/>`).join("") + `</g>` +
    `<g fill="#5E6B7E">` + [[20, 160, 90, 180], [120, 120, 80, 220], [210, 180, 110, 160], [560, 140, 90, 200], [660, 100, 120, 240]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join("") + `</g>` +
    `<rect x="0" y="340" width="800" height="160" fill="#3B3F48"/><path d="M0 420 h800" stroke="#E6D27A" stroke-width="6" stroke-dasharray="40 30"/>` +
    [[40, "#E94B5B"], [230, "#4F8BF0"], [420, "#F2B632"], [610, "#2ED3A9"]].map(([x, c]) => `<g transform="translate(${x} 360)"><rect width="150" height="44" rx="12" fill="${c}"/><path d="M24 0 L44 -28 H106 L126 0Z" fill="${c}"/><rect x="50" y="-22" width="50" height="20" rx="4" fill="#BFE6FF"/><circle cx="34" cy="46" r="14" fill="#222"/><circle cx="116" cy="46" r="14" fill="#222"/><circle cx="146" cy="16" r="6" fill="#FF3B3B"/></g>`).join("") +
    `<g transform="translate(400 220)"><circle r="56" fill="#fff" stroke="#30384A" stroke-width="8"/><path d="M0 0 v-38 M0 0 l28 14" stroke="#30384A" stroke-width="6" stroke-linecap="round"/></g>`,
  // 15 dessert
  () => sky("#FFD6E5", "#FFF0F5") + `<rect x="0" y="390" width="800" height="110" fill="#F2B8C6"/>` +
    `<g transform="translate(110 210)"><path d="M0 120 L200 120 L200 60 L0 0 Z" fill="#FFE8B8"/><path d="M0 0 L200 60 L200 80 L0 20 Z" fill="#F7A6C0"/><path d="M0 60 L200 110 L200 120 L0 70 Z" fill="#8A4B2E"/><circle cx="60" cy="0" r="18" fill="#E33"/><path d="M60 -18 q6 -20 18 -22" stroke="#3E9B4B" stroke-width="4" fill="none"/></g>` +
    `<g transform="translate(470 140)"><path d="M0 120 L50 300 L100 120 Z" fill="#E0A458"/><path d="M8 150 L92 150 M15 180 L85 180 M22 210 L78 210" stroke="#B87A35" stroke-width="4"/><circle cx="50" cy="105" r="52" fill="#FFE9F1"/><circle cx="18" cy="70" r="34" fill="#8FD6B5"/><circle cx="80" cy="66" r="36" fill="#7A4B2E"/></g>` +
    [[640, 420], [700, 450], [610, 470]].map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="34" fill="#D9A55B"/><circle cx="-10" cy="-8" r="5" fill="#5A2E1E"/><circle cx="12" cy="4" r="5" fill="#5A2E1E"/><circle cx="-2" cy="14" r="4" fill="#5A2E1E"/></g>`).join(""),
  // 16 kitchen drawer
  () => sky("#D9C2A3", "#CBAE8A") + `<rect x="90" y="60" width="620" height="380" rx="16" fill="#8A5A33"/><rect x="110" y="80" width="580" height="340" rx="10" fill="#F2E6D3"/>` +
    `<path d="M300 80 v340 M500 80 v340" stroke="#D9C6A8" stroke-width="10"/>` +
    [0, 1, 2].map(i => `<g transform="translate(${150 + i * 40} 110)"><rect x="-4" y="70" width="8" height="200" rx="4" fill="#AEB6C2"/><path d="M-16 0 v50 a16 16 0 0 0 32 0 v-50 M-6 0 v40 M6 0 v40" stroke="#AEB6C2" stroke-width="7" fill="none"/></g>`).join("") +
    [0, 1].map(i => `<g transform="translate(${360 + i * 60} 110)"><path d="M0 0 c26 30 26 140 0 170 Z" fill="#C9D0DB"/><rect x="-6" y="170" width="18" height="110" rx="6" fill="#30384A"/></g>`).join("") +
    [0, 1].map(i => `<g transform="translate(${560 + i * 60} 120)"><ellipse cx="0" cy="30" rx="22" ry="32" fill="#AEB6C2"/><rect x="-5" y="60" width="10" height="190" rx="5" fill="#AEB6C2"/></g>`).join("") +
    `<g transform="translate(520 360)"><rect width="60" height="26" rx="5" fill="#2D2D2D"/><rect x="40" width="20" height="26" fill="#E7C26B"/></g><circle cx="650" cy="380" r="22" fill="none" stroke="#E94B5B" stroke-width="5"/>`,
  // 17 ball sports
  () => sky("#5FB8F0", "#BFE6FF") + `<rect x="0" y="230" width="800" height="270" fill="#3E9E4F"/>` + Array.from({ length: 8 }, (_, i) => `<rect x="${i * 100}" y="230" width="50" height="270" fill="#47AD59"/>`).join("") +
    `<path d="M0 360 h800 M400 230 v270" stroke="#fff" stroke-width="5" opacity=".8"/><circle cx="400" cy="360" r="60" fill="none" stroke="#fff" stroke-width="5" opacity=".8"/>` +
    `<g transform="translate(220 380)"><circle r="60" fill="#fff"/><path d="M0 -22 L21 -7 L13 18 L-13 18 L-21 -7 Z" fill="#222"/><path d="M0 -22 L0 -60 M21 -7 L57 -18 M13 18 L35 49 M-13 18 L-35 49 M-21 -7 L-57 -18" stroke="#222" stroke-width="3"/></g>` +
    `<g transform="translate(560 330)"><circle r="70" fill="#E8742F"/><path d="M-70 0 h140 M0 -70 v140 M-50 -50 C -20 -20 -20 20 -50 50 M50 -50 C 20 -20 20 20 50 50" stroke="#5A2A12" stroke-width="4" fill="none"/></g>` +
    `<g transform="translate(400 140)"><circle r="34" fill="#D7F03C"/><path d="M-30 -14 C -10 -4 -10 14 -30 22 M30 -22 C 10 -14 10 4 30 14" stroke="#fff" stroke-width="4" fill="none"/></g>`,
  // 18 picnic
  () => sky("#8FD3FF", "#E2F5FF") + sun(680, 80, 34, "#FFE066") + hill("0 250 C 250 220 550 270 800 230", "#6CC167") + tree(130, 230, 1.4) +
    `<g transform="translate(400 380) skewX(-25)"><rect x="-200" y="-70" width="400" height="140" fill="#fff"/>` + Array.from({ length: 5 }, (_, i) => `<rect x="${-200 + i * 80}" y="-70" width="40" height="140" fill="#E94B5B" opacity=".75"/>`).join("") + Array.from({ length: 4 }, (_, i) => `<rect x="-200" y="${-70 + i * 35}" width="400" height="17" fill="#E94B5B" opacity=".45"/>`).join("") + `</g>` +
    `<g transform="translate(320 270)"><rect width="150" height="90" rx="10" fill="#B07A44"/><path d="M0 30 h150 M0 60 h150 M50 0 v90 M100 0 v90" stroke="#8A5A33" stroke-width="5"/><path d="M20 0 C 20 -60 130 -60 130 0" stroke="#8A5A33" stroke-width="9" fill="none"/></g>` +
    `<g transform="translate(520 360)"><path d="M0 40 L60 -20 L120 40 Z" fill="#F4E2B8"/><path d="M8 34 L60 -10 L112 34" stroke="#7BC86C" stroke-width="8" fill="none"/></g>` +
    `<circle cx="250" cy="420" r="22" fill="#E33"/><circle cx="285" cy="440" r="20" fill="#7BC86C"/>`,
  // 19 vacation
  () => sky("#3FB7F5", "#A9E4FF") + sun(640, 90, 42, "#FFE066") + `<rect x="0" y="260" width="800" height="240" fill="#F3D79A"/>` +
    `<path d="M100 330 h420 a30 30 0 0 1 30 30 v80 h-480 v-80 a30 30 0 0 1 30 -30 Z" fill="#1FB5D6"/><path d="M110 360 q30 -10 60 0 t60 0 t60 0 t60 0 t60 0 t60 0" stroke="#A8F0FF" stroke-width="4" fill="none"/>` +
    palm(620, 300, 1.2) + palm(720, 330, .9) +
    `<g transform="translate(580 380)"><path d="M0 40 L140 40 L180 -10" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M10 40 v34 M130 40 v34" stroke="#fff" stroke-width="7"/><path d="M0 34 L140 34 L172 -6" stroke="#4F8BF0" stroke-width="14" fill="none" stroke-linecap="round"/></g>` +
    `<g transform="translate(60 380)"><rect width="70" height="90" rx="8" fill="#E94B5B"/><rect x="22" y="-14" width="26" height="16" rx="4" fill="#8A2537"/><circle cx="22" cy="40" r="8" fill="#FFE066"/><rect x="38" y="56" width="22" height="14" fill="#fff"/></g>`,
  // 20 halloween
  () => sky("#1A0F2E", "#3B1E45") + moon(600, 110, 60, "#1A0F2E") + stars(30, 20, 260) +
    [[150, 90], [230, 140], [420, 70]].map(([x, y]) => `<path transform="translate(${x} ${y})" d="M0 0 q12 -18 24 0 q8 -12 16 -4 q6 -14 18 0 q-6 -4 -12 6 q-8 -8 -14 2 q-8 -12 -16 0 q-8 -10 -16 -4Z" fill="#000"/>`).join("") +
    hill("0 390 C 200 370 600 410 800 380", "#120A1E") +
    [[180, 410, 70], [330, 440, 50], [610, 420, 64]].map(([x, y, r]) => `<g transform="translate(${x} ${y})"><ellipse rx="${r}" ry="${r * .82}" fill="#F27A1E"/><path d="M${-r * .4} 0 a${r * .4} ${r * .8} 0 0 0 ${r * .8} 0 a${r * .4} ${r * .8} 0 0 0 ${-r * .8} 0" fill="none" stroke="#C9580E" stroke-width="4"/><rect x="-6" y="${-r * .95}" width="12" height="18" rx="3" fill="#4A6B2A"/><path d="M${-r * .45} ${-r * .15} l${r * .18} ${-r * .2} l${r * .18} ${r * .2}Z M${r * .1} ${-r * .15} l${r * .18} ${-r * .2} l${r * .18} ${r * .2}Z M${-r * .4} ${r * .2} q${r * .4} ${r * .3} ${r * .8} 0" fill="#3B1600"/></g>`).join("") +
    `<g transform="translate(450 230)" opacity=".92"><path d="M0 0 C 0 -70 90 -70 90 0 L90 90 L75 78 L60 90 L45 78 L30 90 L15 78 L0 90 Z" fill="#F4F1FF"/><circle cx="30" cy="-6" r="7" fill="#222"/><circle cx="60" cy="-6" r="7" fill="#222"/></g>`,
  // 21 collecting
  () => sky("#F2E8D5", "#E6D7BC") + `<rect x="420" y="60" width="330" height="380" rx="10" fill="#8A5A33"/><path d="M420 180 h330 M420 300 h330" stroke="#6B4528" stroke-width="12"/>` +
    [["#E94B5B", 0], ["#4F8BF0", 1], ["#2ED3A9", 2], ["#F2B632", 3], ["#7B61FF", 4], ["#FF8C6E", 5], ["#3E9B4B", 6]].map(([c, i]) => `<rect x="${440 + i * 42}" y="${80 + (i % 2) * 10}" width="34" height="${92 - (i % 2) * 10}" rx="3" fill="${c}"/>`).join("") +
    [0, 1, 2, 3, 4].map(i => `<rect x="${440 + i * 60}" y="210" width="50" height="78" rx="6" fill="${["#fff", "#FFE6A3", "#C9E7FF", "#F7C6D9", "#D8F3E4"][i]}" stroke="#30384A" stroke-width="3"/>`).join("") +
    `<g transform="translate(470 330)"><path d="M0 60 h120 v-30 c-20 -10 -40 -30 -50 -30 h-40 l-30 40 Z" fill="#E94B5B"/><path d="M0 60 h120" stroke="#fff" stroke-width="8"/></g>` +
    `<g transform="translate(60 80)">` + Array.from({ length: 9 }, (_, i) => `<g transform="translate(${(i % 3) * 110} ${Math.floor(i / 3) * 120})"><rect width="96" height="106" fill="#fff" stroke="#C9B48F" stroke-width="5" stroke-dasharray="6 4"/><rect x="12" y="12" width="72" height="62" fill="${["#E94B5B", "#4F8BF0", "#2ED3A9", "#F2B632", "#7B61FF", "#FF8C6E", "#3E9B4B", "#C95FD0", "#4FB6E8"][i]}"/></g>`).join("") + `</g>` +
    [0, 1, 2, 3].map(i => `<ellipse cx="${300 + i * 6}" cy="${450 - i * 12}" rx="40" ry="12" fill="#E7C26B" stroke="#B9902F" stroke-width="3"/>`).join(""),
  // 22 baking
  () => sky("#FBE7D0", "#F3D3B0") + `<rect x="0" y="360" width="800" height="140" fill="#C9A27A"/>` +
    `<g transform="translate(70 160)"><path d="M10 0 h120 l20 200 h-160 Z" fill="#F4EEE2"/><rect x="20" y="70" width="120" height="60" fill="#C8A26A"/><text x="80" y="110" font-family="sans-serif" font-size="26" font-weight="700" fill="#fff" text-anchor="middle">FLOUR</text></g>` +
    [[300, 360], [345, 365], [325, 330]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="24" ry="30" fill="#F7EBD8"/>`).join("") +
    `<g transform="translate(420 250)"><path d="M0 0 h160 c0 90 -30 120 -80 120 c-50 0 -80 -30 -80 -120 Z" fill="#7EC4E8"/><ellipse cx="80" cy="0" rx="80" ry="16" fill="#5AA9D6"/><path d="M100 -60 l-20 70" stroke="#AEB6C2" stroke-width="6"/><ellipse cx="104" cy="-74" rx="14" ry="22" fill="none" stroke="#AEB6C2" stroke-width="5"/></g>` +
    `<g transform="translate(620 290)"><rect width="140" height="90" rx="10" fill="#30384A"/><rect x="14" y="26" width="112" height="52" rx="6" fill="#FF8C3A" opacity=".85"/><circle cx="30" cy="12" r="6" fill="#AEB6C2"/><circle cx="54" cy="12" r="6" fill="#AEB6C2"/></g>` +
    `<rect x="230" y="400" width="100" height="40" rx="6" fill="#FFE57A"/>`,
  // 23 uniforms
  () => sky("#26324A", "#3A4866") + `<rect x="0" y="400" width="800" height="100" fill="#1C2436"/><rect x="60" y="80" width="680" height="16" rx="8" fill="#8A5A33"/>` +
    [[150, "#24325C"], [330, "#C8322F"], [510, "#F4F7FB"], [690, "#2E3E5C"]].map(([x, c]) => `<g transform="translate(${x} 96)"><path d="M0 0 v18" stroke="#AEB6C2" stroke-width="5"/><path d="M-60 40 L0 18 L60 40 L70 290 L-70 290 Z" fill="${c}"/><path d="M0 18 L-20 80 L0 70 L20 80 Z" fill="${c === "#F4F7FB" ? "#D9DFEA" : "#00000033"}"/></g>`).join("") +
    `<g transform="translate(150 240)"><path d="M0 -24 l8 16 l18 2 l-13 12 l4 18 l-17 -9 l-17 9 l4 -18 l-13 -12 l18 -2Z" fill="#E7C26B"/></g>` +
    `<path d="M300 220 h60 M300 250 h60" stroke="#F2E26B" stroke-width="10"/>` +
    `<g transform="translate(510 230)"><rect x="-8" y="-26" width="16" height="52" fill="#E94B5B"/><rect x="-26" y="-8" width="52" height="16" fill="#E94B5B"/></g>` +
    `<g transform="translate(690 210)" fill="#E7C26B"><path d="M-40 0 h80 l-10 8 h-60Z"/><circle r="10"/></g>`,
  // 24 cold
  () => sky("#9FD4F5", "#E9F7FF") + `<g fill="#fff" opacity=".9">` + Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % 800}" cy="${(i * 53) % 330}" r="${2 + (i % 3)}"/>`).join("") + `</g>` +
    hill("0 300 C 200 260 500 320 800 280", "#F4FAFF") + `<path d="M0 300 C 200 260 500 320 800 280" stroke="#D3E6F5" stroke-width="6" fill="none"/>` +
    `<g transform="translate(220 380)"><circle cy="20" r="62" fill="#fff"/><circle cy="-70" r="44" fill="#fff"/><circle cx="-14" cy="-78" r="5" fill="#222"/><circle cx="14" cy="-78" r="5" fill="#222"/><path d="M0 -66 l28 6 l-28 6Z" fill="#F27A1E"/><path d="M-40 -34 q40 18 80 0 l0 16 q-40 18 -80 0Z" fill="#E94B5B"/><circle cy="0" r="5" fill="#222"/><circle cy="24" r="5" fill="#222"/></g>` +
    [[520, 400], [600, 420], [560, 360]].map(([x, y]) => `<rect x="${x}" y="${y}" width="64" height="64" rx="10" fill="#BFE8FF" opacity=".85" stroke="#fff" stroke-width="4"/>`).join("") +
    `<g transform="translate(690 120)" stroke="#fff" stroke-width="7" stroke-linecap="round"><path d="M0 -50 v100 M-43 -25 l86 50 M-43 25 l86 -50"/><path d="M-12 -38 l12 10 l12 -10 M-12 38 l12 -10 l12 10" fill="none"/></g>`,
  // 25 waking at night
  () => sky("#0B1026", "#141B3A") + `<rect x="480" y="50" width="240" height="180" fill="#0F1A40" stroke="#2A3360" stroke-width="12"/>` + moon(600, 120, 34, "#0F1A40") + stars(10, 25, 220, "#fff") +
    `<rect x="0" y="340" width="800" height="160" fill="#10152E"/>` +
    `<g><rect x="40" y="260" width="380" height="110" rx="16" fill="#2A3260"/><rect x="40" y="300" width="380" height="80" rx="14" fill="#38407A"/><rect x="60" y="270" width="120" height="44" rx="20" fill="#4A5290"/></g>` +
    `<g transform="translate(470 330)"><rect width="150" height="70" rx="10" fill="#1E2340"/><text x="75" y="48" font-family="monospace" font-size="36" font-weight="700" fill="#3DDC97" text-anchor="middle">3:12</text></g>` +
    `<g transform="translate(660 330)"><path d="M0 0 h40 l-6 70 h-28 Z" fill="#BFE8FF" opacity=".5" stroke="#E9F7FF" stroke-width="3"/></g>` +
    `<circle cx="545" cy="365" r="90" fill="#3DDC97" opacity=".05"/>`,
  // 26 gym
  () => sky("#2B2F3A", "#3A404E") + `<rect x="0" y="380" width="800" height="120" fill="#22252E"/><rect x="0" y="380" width="800" height="8" fill="#E94B5B"/>` +
    `<g transform="translate(400 200)"><rect x="-260" y="-8" width="520" height="16" rx="6" fill="#AEB6C2"/>` + [-230, -200, 200, 230].map((x, i) => `<rect x="${x - 14}" y="${i % 3 ? -70 : -55}" width="28" height="${i % 3 ? 140 : 110}" rx="8" fill="#15171C"/>`).join("") + `</g>` +
    [[140, 430], [270, 440]].map(([x, y]) => `<g transform="translate(${x} ${y})"><rect x="-40" y="-6" width="80" height="12" rx="5" fill="#AEB6C2"/><rect x="-50" y="-24" width="20" height="48" rx="6" fill="#E94B5B"/><rect x="30" y="-24" width="20" height="48" rx="6" fill="#E94B5B"/></g>`).join("") +
    `<g transform="translate(520 300)"><path d="M0 80 L220 80 L200 0 Z" fill="#444A5A"/><rect x="-10" y="80" width="250" height="16" rx="6" fill="#15171C"/><path d="M200 0 v-90 h-30" stroke="#AEB6C2" stroke-width="10" fill="none"/></g>` +
    `<g transform="translate(400 420)"><rect width="34" height="60" rx="8" fill="#4FB6E8"/><rect x="8" y="-10" width="18" height="12" rx="3" fill="#2C6E9A"/></g>`,
  // 27 Paris
  () => sky("#FF9A6B", "#FFD9A8") + sun(160, 260, 70, "#FFE7A3", .3) + hill("0 400 C 250 380 550 410 800 390", "#6B4E6E") +
    `<g transform="translate(470 400)" fill="#3A2A44"><path d="M-110 0 L-30 -200 L-14 -320 L-6 -430 L6 -430 L14 -320 L30 -200 L110 0 L70 0 C 40 -70 -40 -70 -70 0 Z"/><rect x="-46" y="-205" width="92" height="14"/><rect x="-24" y="-320" width="48" height="12"/></g>` +
    `<g transform="translate(160 400)" fill="#4E3A58"><rect x="-80" y="-150" width="160" height="150"/><path d="M-40 0 v-70 a40 40 0 0 1 80 0 v70Z" fill="#FFD9A8"/><rect x="-90" y="-170" width="180" height="24"/></g>` +
    `<rect x="0" y="440" width="800" height="60" fill="#4F7AA8"/><path d="M0 455 q50 -8 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0" stroke="#9CC4E8" stroke-width="3" fill="none"/>`,
  // 28 feet
  () => sky("#E8E1D8", "#D9CFC2") + `<rect x="60" y="120" width="680" height="16" rx="6" fill="#8A5A33"/><rect x="60" y="290" width="680" height="16" rx="6" fill="#8A5A33"/><rect x="60" y="120" width="16" height="340" fill="#8A5A33"/><rect x="724" y="120" width="16" height="340" fill="#8A5A33"/>` +
    `<g transform="translate(110 120)"><path d="M0 0 h50 l10 -40 c40 6 80 20 100 40 h0 v0 Z" fill="#4F8BF0"/><path d="M0 0 h160" stroke="#fff" stroke-width="8"/></g>` +
    `<g transform="translate(330 120)"><path d="M0 0 v-80 h40 v50 c50 0 80 10 90 30 Z" fill="#7A4B2A"/><path d="M0 0 h130" stroke="#4A2A14" stroke-width="8"/></g>` +
    `<g transform="translate(540 120)"><path d="M0 0 c 0 -10 140 -10 140 0 Z" fill="#E7C26B"/><path d="M30 -6 c 20 -30 60 -30 80 0" stroke="#C9A04A" stroke-width="8" fill="none"/></g>` +
    `<g transform="translate(110 290)"><path d="M0 0 c 0 -40 130 -50 150 0 Z" fill="#F7A6C0"/><circle cx="110" cy="-22" r="16" fill="#fff"/></g>` +
    `<g transform="translate(360 290)"><path d="M0 -110 h40 v70 c40 0 60 20 60 40 h-100 Z" fill="#2ED3A9"/><path d="M0 -90 h40 M0 -70 h40" stroke="#fff" stroke-width="6"/></g>` +
    `<g transform="translate(560 290)"><path d="M0 -110 h40 v70 c40 0 60 20 60 40 h-100 Z" fill="#F2B632"/><path d="M0 -90 h40 M0 -70 h40" stroke="#fff" stroke-width="6"/></g>` +
    `<rect x="60" y="440" width="680" height="20" rx="6" fill="#B79A78"/>`,
  // 29 phone in bed
  () => sky("#0A0F24", "#121A38") + stars(20, 29, 200) + `<rect x="0" y="300" width="800" height="200" fill="#151B3C"/>` +
    `<path d="M80 300 C 150 230 650 230 720 300 L720 440 L80 440 Z" fill="#2E3770"/><path d="M80 330 C 200 290 600 290 720 330" stroke="#3E4890" stroke-width="10" fill="none"/>` +
    `<ellipse cx="300" cy="260" rx="64" ry="54" fill="#E9C2A0"/><path d="M240 250 c 10 -60 110 -60 120 0" fill="#3A2416"/>` +
    `<g transform="translate(400 210) rotate(-8)"><rect width="70" height="120" rx="12" fill="#1E2330"/><rect x="6" y="10" width="58" height="96" rx="6" fill="#8FE3FF"/></g><circle cx="435" cy="270" r="140" fill="#8FE3FF" opacity=".08"/>` +
    [[520, 140, "#FF5C8D"], [600, 200, "#2ED3A9"], [530, 250, "#F2B632"]].map(([x, y, c]) => `<g transform="translate(${x} ${y})"><rect width="70" height="44" rx="14" fill="${c}"/><path d="M14 44 l-6 14 l18 -14Z" fill="${c}"/><circle cx="22" cy="22" r="5" fill="#fff"/><circle cx="36" cy="22" r="5" fill="#fff"/><circle cx="50" cy="22" r="5" fill="#fff"/></g>`).join(""),
  // 30 planets
  () => sky("#05061A", "#0E1240") + stars(140, 30, 500) +
    `<circle cx="160" cy="330" r="110" fill="#D9A066"/><path d="M60 290 h200 M52 330 h216 M60 370 h200" stroke="#B8774A" stroke-width="12" opacity=".7"/><ellipse cx="200" cy="370" rx="26" ry="14" fill="#C2553A"/>` +
    `<g transform="translate(480 170)"><ellipse rx="150" ry="32" fill="none" stroke="#E2C88A" stroke-width="12" transform="rotate(-14)"/><circle r="70" fill="#E8C877"/><path d="M-145 34 A150 32 -14 0 0 145 -34" stroke="#E2C88A" stroke-width="12" fill="none" transform="rotate(-14) translate(0 0)" opacity="0"/></g>` +
    `<g transform="translate(660 380)"><circle r="56" fill="#3A7BD5"/><path d="M-30 -30 c 20 10 30 30 10 50 c -10 10 -30 0 -40 -10 Z M20 -40 c 20 10 30 40 10 50 Z" fill="#3E9B4B"/></g>` +
    `<circle cx="360" cy="400" r="30" fill="#C1440E"/><circle cx="350" cy="392" r="6" fill="#9A3209"/>` + `<circle cx="80" cy="90" r="22" fill="#E9D6A8"/>`,
];

mkdirSync(join(root, "images/4k"), { recursive: true });
scenes.forEach((scene, i) => writeFileSync(join(root, "images/4k", `${String(i + 1).padStart(2, "0")}.svg`), svg(scene())));
console.log(`Wrote ${scenes.length} illustrations to images/4k/`);
