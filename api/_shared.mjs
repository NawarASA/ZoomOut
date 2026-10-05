// Shared by the Discord bot functions (api/discord.mjs, api/daily.mjs).
// Runs on Vercel, never in the browser. Files starting with _ aren't public URLs.
//
// Secrets come from Vercel → Project → Settings → Environment Variables:
//   DISCORD_PUBLIC_KEY    Developer Portal → General Information → Public Key
//   DISCORD_BOT_TOKEN     Developer Portal → Bot → Reset Token
//   SUPABASE_URL          Supabase → Project Settings → API → Project URL
//   SUPABASE_SECRET_KEY   Supabase → Project Settings → API Keys → secret (or legacy service_role) key
//   CRON_SECRET           any long random text; Vercel sends it with the daily job
//   DISCORD_CLIENT_SECRET Developer Portal → OAuth2 → Client Secret (for "who solved it today")

export const SITE = "https://zoomout.dev";
export const APP_ID = "1556278128228175872";
const LAUNCH_DATE = "2026-10-03"; // keep in sync with js/config.js
const STEPS = [16, 12, 8, 5, 2.5, 1]; // keep in sync with js/core.js

// A date in Switzerland as "YYYY-MM-DD"; offsetDays -1 = yesterday.
export const swissDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date(Date.now() + offsetDays * 864e5));

const puzzleNumber = date => Math.round((Date.parse(date) - Date.parse(LAUNCH_DATE)) / 864e5) + 1;
const PLAY_BUTTONS = {
  type: 1,
  components: [
    { type: 2, style: 1, label: "Play", custom_id: "play" },
    { type: 2, style: 5, label: "Play in browser", url: SITE },
  ],
};

// Everyone in one server who finished a day's puzzle in Discord, fastest first.
async function serverResults(date, guild) {
  const res = await db(`discord_results?puzzle_date=eq.${date}&guild_id=eq.${encodeURIComponent(guild)}&select=user_id,guesses,won&order=won.desc,guesses.asc,created_at.asc`);
  return res.ok ? res.json() : [];
}

// "Who solved it today": one message per channel per day, edited as more people finish.
// Names are shown as mentions (Discord displays them) but nobody gets pinged.
export async function updateBoard(date, guild, channel) {
  const rows = await serverResults(date, guild);
  if (!rows.length) return;
  const lines = rows.map(r => `<@${r.user_id}> · ${r.won ? `solved at **${STEPS[r.guesses - 1]}×**` : "out of zooms"}`);
  const msg = {
    embeds: [{
      title: `Zoom Out no. ${puzzleNumber(date)} · today in this server`,
      description: lines.join("\n"),
      footer: { text: `${rows.length} played · ${rows.filter(r => r.won).length} solved` },
      color: 0x2ed3a9,
    }],
    components: [PLAY_BUTTONS],
    allowed_mentions: { parse: [] },
  };

  const key = `puzzle_date=eq.${date}&channel_id=eq.${encodeURIComponent(channel)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const [board] = await (await db(`discord_boards?${key}&select=message_id`)).json().catch(() => []);
    if (board?.message_id) {
      const edited = await discordApi(`/channels/${channel}/messages/${board.message_id}`, { method: "PATCH", body: JSON.stringify(msg) });
      if (edited.ok) return;
      if (edited.status !== 404) return;                 // no permission etc.: give up quietly
      await db(`discord_boards?${key}`, { method: "DELETE" }); // message was deleted: post a new one
      continue;
    }
    if (board) { await new Promise(r => setTimeout(r, 1200)); continue; } // someone else is posting it right now
    // Claim the board for this channel and day, so two players finishing at once don't post twice.
    const claim = await db("discord_boards", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ puzzle_date: date, channel_id: channel }),
    });
    if (!claim.ok || !(await claim.json()).length) continue;
    const posted = await discordApi(`/channels/${channel}/messages`, { method: "POST", body: JSON.stringify(msg) });
    if (!posted.ok) { await db(`discord_boards?${key}`, { method: "DELETE" }); return; }
    const { id } = await posted.json();
    await db(`discord_boards?${key}`, { method: "PATCH", body: JSON.stringify({ message_id: id }) });
    return;
  }
}

// Line for the morning post: how this server did yesterday.
export async function yesterdayLine(guild) {
  const rows = await serverResults(swissDate(-1), guild).catch(() => []);
  if (!rows.length) return null;
  const best = rows[0];
  return `Yesterday in this server: ${rows.length} played` +
    (best.won ? `, fastest was <@${best.user_id}> at ${STEPS[best.guesses - 1]}×.` : ", nobody solved it.");
}

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
    components: [PLAY_BUTTONS],
    allowed_mentions: { parse: [] },
  };
}

// The morning post for one server: today's reminder plus how the server did yesterday.
export async function reminderFor(base, guild) {
  const line = await yesterdayLine(guild);
  if (!line) return base;
  const [embed] = base.embeds;
  return { ...base, embeds: [{ ...embed, description: `${embed.description}\n\n${line}` }] };
}
