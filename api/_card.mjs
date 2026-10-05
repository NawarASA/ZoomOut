// Draws a player's result card (PNG) for Discord, like Wordle's result images.
// Satori lays it out as SVG, resvg turns that into a PNG. Elements are plain objects instead
// of JSX, so no build step. Fonts are TTF copies of the site's fonts (Satori can't read woff2).
import { readFileSync } from "node:fs";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const STEPS = [16, 12, 8, 5, 2.5, 1]; // keep in sync with js/core.js
const font = file => readFileSync(new URL(`./_fonts/${file}`, import.meta.url));
const FONTS = [
  { name: "Display", data: font("BigShouldersDisplay-900.ttf"), weight: 900, style: "normal" },
  { name: "Mono", data: font("JetBrainsMono-700.ttf"), weight: 700, style: "normal" },
  { name: "Body", data: font("AtkinsonHyperlegible-700.ttf"), weight: 700, style: "normal" },
];
const COLOR = { hit: "#3DDC97", near: "#F5C04A", miss: "#FF6B5B", skip: "#6B7486" };
const COATING = "linear-gradient(135deg, #7B61FF, #2ED3A9 40%, #F4C54B 70%, #FF5C8D)";

const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat() } });
const text = (value, style) => ({ type: "div", props: { style: { display: "flex", ...style }, children: value } });

export function avatarUrl(user) {
  return user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
}

// { number, name, avatar, won, guesses, trail: ["near", "miss", "hit"] } -> PNG Buffer
export async function renderCard({ number, name, avatar, won, guesses, trail }) {
  const wordmark = h("div", { fontFamily: "Display", fontSize: 44, letterSpacing: 2, color: "#EDF1F7" },
    text("Z", {}), text("OO", { backgroundImage: COATING, backgroundClip: "text", color: "transparent" }),
    text("M ", { marginRight: 12 }), text("O", { backgroundImage: COATING, backgroundClip: "text", color: "transparent" }), text("UT", {}));

  const dots = STEPS.map((z, i) => {
    const r = trail[i];
    return h("div", { flexDirection: "column", alignItems: "center", gap: 10 },
      h("div", {
        width: 58, height: 58, borderRadius: 29,
        background: r ? COLOR[r] : "transparent",
        border: r ? "none" : "3px solid #2A3242",
        boxShadow: r === "hit" ? "0 0 28px rgba(61,220,151,.55)" : "none",
      }),
      text(`${z}×`, { fontFamily: "Mono", fontSize: 20, color: r ? "#C9D2E3" : "#4A5366" }));
  });

  const card = h("div", {
    width: 800, height: 420, padding: "34px 44px", flexDirection: "column", justifyContent: "space-between",
    backgroundColor: "#090C11",
    backgroundImage: "radial-gradient(circle at 12% 0%, rgba(123,97,255,.28), transparent 45%), radial-gradient(circle at 100% 100%, rgba(46,211,169,.18), transparent 45%)",
    fontFamily: "Body", color: "#EDF1F7",
  },
    h("div", { justifyContent: "space-between", alignItems: "center" },
      h("div", { alignItems: "center", gap: 18 },
        { type: "img", props: { src: avatar, width: 64, height: 64, style: { borderRadius: 32, border: "3px solid #2A3242" } } },
        h("div", { flexDirection: "column" },
          text(name, { fontSize: 30, maxWidth: 420, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }),
          text(`PUZZLE NO. ${number}`, { fontFamily: "Mono", fontSize: 18, letterSpacing: 3, color: "#8A94A6" }))),
      wordmark),
    h("div", { flexDirection: "column" },
      text(won ? `SOLVED AT ${STEPS[guesses - 1]}×` : "OUT OF ZOOMS", { fontFamily: "Display", fontSize: 92, lineHeight: 1, color: won ? "#EDF1F7" : "#FF8A7D" }),
      text(won ? `${guesses}/6 · ${["Ridiculous eye. First try.", "Sharp. Two zooms.", "Nicely done.", "Got there.", "Close call.", "Just made it."][guesses - 1]}` : "X/6 · Tomorrow's photo is yours.",
        { fontSize: 24, color: "#8A94A6", marginTop: 6 })),
    h("div", { justifyContent: "space-between" }, ...dots));

  const svg = await satori(card, { width: 800, height: 420, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1600 } }).render().asPng(); // 2x for sharp text
}
