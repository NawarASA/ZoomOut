// Shared by the Discord bot functions (api/discord.mjs, api/daily.mjs).
// Runs on Vercel, never in the browser. Files starting with _ aren't public URLs.
//
// Secrets come from Vercel → Project → Settings → Environment Variables:
//   DISCORD_PUBLIC_KEY    Developer Portal → General Information → Public Key
//   DISCORD_BOT_TOKEN     Developer Portal → Bot → Reset Token
//   SUPABASE_URL          Supabase → Project Settings → API → Project URL
//   SUPABASE_SECRET_KEY   Supabase → Project Settings → API Keys → secret (or legacy service_role) key
//   CRON_SECRET           any long random text; Vercel sends it with the daily job

export const SITE = "https://zoomout.dev";
const LAUNCH_DATE = "2026-10-03"; // keep in sync with js/config.js

// A date in Switzerland as "YYYY-MM-DD"; offsetDays -1 = yesterday.
export const swissDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date(Date.now() + offsetDays * 864e5));

const puzzleNumber = date => Math.round((Date.parse(date) - Date.parse(LAUNCH_DATE)) / 864e5) + 1;

// Call the Discord API as the bot, waiting and retrying if Discord says "slow down".
export async function discordApi(path, init = {}) {
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`https://discord.com/api/v10${path}`, {
      ...init,
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json", ...init.headers },
    });
    if (res.status !== 429) return res;
    const { retry_after = 1 } = await res.clone().json().catch(() => ({}));
    await new Promise(r => setTimeout(r, retry_after * 1000));
  }
  return res;
}

// Call the Supabase database with the secret key (bypasses row level security; server only).
export function db(path, init = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  return fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), // legacy service_role keys need this too
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

// Today's reminder message, or null if there's no puzzle for today.
export async function reminder() {
  const puzzles = await (await fetch(`${SITE}/puzzles.json`, { cache: "no-store" })).json();
  const today = swissDate(), yesterday = puzzles.find(p => p.date === swissDate(-1));
  if (!puzzles.some(p => p.date === today)) return null;
  const lines = ["A new mystery photo, starting at 16× zoom. You have six zooms to name it."];
  if (yesterday) lines.push(`Yesterday's answer: ||${yesterday.answers[0]}||`);
  return {
    embeds: [{ title: `Zoom Out no. ${puzzleNumber(today)} is live`, url: SITE, description: lines.join("\n\n"), color: 0x7b61ff }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 1, label: "Play", custom_id: "play" },
        { type: 2, style: 5, label: "Play in browser", url: SITE },
      ],
    }],
    allowed_mentions: { parse: [] },
  };
}
