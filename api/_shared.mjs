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

// "Today in this server" scoreboard. Names are mentions (Discord shows them) but nobody gets pinged.
async function boardEmbed(date, guild) {
  const rows = await serverResults(date, guild);
  return {
    title: `Today in this server · Zoom Out no. ${puzzleNumber(date)}`,
    description: rows.map((r, i) => `**${i + 1}.** <@${r.user_id}> · ${r.won ? `solved at **${STEPS[r.guesses - 1]}×**` : "out of zooms"}`).join("\n") || "Nobody yet",
    footer: { text: `${rows.length} played · ${rows.filter(r => r.won).length} solved` },
    color: 0x2ed3a9,
  };
}

export { puzzleNumber };

// The player's own result in words (the card image shows the same), e.g. "@Nawar solved Zoom Out no. 4 at 8× (3/6)".
function resultText(date, user, guesses, won) {
  return won
    ? `<@${user}> solved **Zoom Out no. ${puzzleNumber(date)}** at **${STEPS[guesses - 1]}×** (${guesses}/6)`
    : `<@${user}> didn't get **Zoom Out no. ${puzzleNumber(date)}** this time (X/6)`;
}

// A player finished in Discord: post their result card straight away, like Wordle, with the
// up-to-date scoreboard underneath. The scoreboard only ever sits on the newest result
// message in the channel; the previous one keeps its card and loses the scoreboard.
export async function postFinish({ date, guild, channel, user, guesses, won, card }) {
  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    content: resultText(date, user, guesses, won),
    embeds: [await boardEmbed(date, guild)],
    components: [PLAY_BUTTONS],
    attachments: [{ id: 0, filename: "zoomout-result.png", description: won ? `Solved at ${STEPS[guesses - 1]}× zoom` : "Out of zooms" }],
    allowed_mentions: { parse: [] },
  }));
  form.append("files[0]", new Blob([card], { type: "image/png" }), "zoomout-result.png");
  const posted = await discordApi(`/channels/${channel}/messages`, { method: "POST", body: form });
  if (!posted.ok) { console.warn(`Couldn't post result in ${channel}: ${posted.status} ${await posted.text()}`); return false; }
  const { id } = await posted.json();

  // The newest result message in the channel holds the scoreboard. Message IDs grow over
  // time, so "newest" is simply the biggest ID; the swap is a conditional update, so two
  // players finishing at the same moment can't both take it.
  const key = `puzzle_date=eq.${date}&channel_id=eq.${encodeURIComponent(channel)}`;
  const holderId = async () => (await (await db(`discord_boards?${key}&select=message_id`)).json().catch(() => []))[0];
  let holds = false, previous = null;
  for (let attempt = 0; attempt < 6 && !holds; attempt++) {
    const row = await holderId();
    if (row?.message_id && BigInt(row.message_id) > BigInt(id)) break; // a newer result already holds it
    const res = row
      ? await db(`discord_boards?${key}&message_id=${row.message_id ? `eq.${row.message_id}` : "is.null"}`, {
          method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ message_id: id }) })
      : await db("discord_boards", {
          method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
          body: JSON.stringify({ puzzle_date: date, channel_id: channel, message_id: id }) });
    holds = res.ok && (await res.json()).length > 0;
    if (holds) previous = row?.message_id ?? null;
  }
  if (previous) await stripBoard(channel, previous);
  if (!holds) { await stripBoard(channel, id); return true; }

  // Refresh our scoreboard so it includes anyone who finished a moment before us,
  // then give it up again if an even newer result took over meanwhile.
  await discordApi(`/channels/${channel}/messages/${id}`, {
    method: "PATCH", body: JSON.stringify({ embeds: [await boardEmbed(date, guild)], components: [PLAY_BUTTONS], allowed_mentions: { parse: [] } }),
  });
  if ((await holderId())?.message_id !== id) await stripBoard(channel, id);
  return true;
}

// Remove the scoreboard and buttons from an older message, keeping its result line.
// Scoreboard-only messages (from before results were posted individually) are deleted.
async function stripBoard(channel, messageId) {
  const r = await discordApi(`/channels/${channel}/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ embeds: [], components: [] }) });
  if (r.status === 400) await discordApi(`/channels/${channel}/messages/${messageId}`, { method: "DELETE" });
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
      // FormData (file uploads) sets its own Content-Type.
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init.headers },
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
