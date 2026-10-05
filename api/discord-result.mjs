// A player finished the daily puzzle inside the Discord Activity: save it and update
// the "today in this server" scoreboard in that channel.
//
// Trust nothing from the browser except the player's own result:
// - who they are comes from Discord, using their access token;
// - which server and channel comes from Discord's record of the Activity session,
//   which also has to list them as a player (so nobody can post into other servers).
import { APP_ID, db, discordApi, swissDate, updateBoard } from "./_shared.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function POST(request) {
  const b = await request.json().catch(() => null);
  const guesses = Number(b?.guesses);
  if (!b || typeof b.access_token !== "string" || typeof b.instance_id !== "string" ||
      !Number.isInteger(guesses) || guesses < 1 || guesses > 6 || typeof b.won !== "boolean" ||
      ![swissDate(-1), swissDate(), swissDate(1)].includes(b.date)) {   // allow for players' time zones
    return json({ error: "bad request" }, 400);
  }

  const me = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${b.access_token}` } });
  if (!me.ok) return json({ error: "not signed in" }, 401);
  const user = await me.json();

  const inst = await discordApi(`/applications/${APP_ID}/activity-instances/${encodeURIComponent(b.instance_id)}`);
  if (!inst.ok) return json({ error: "unknown activity" }, 403);
  const { location, users = [] } = await inst.json();
  if (!users.includes(user.id)) return json({ error: "not in this activity" }, 403);
  if (!location?.guild_id) return json({ ok: true, board: false }); // DMs: nowhere to post a scoreboard

  // First result of the day counts; replays don't overwrite it.
  const saved = await db("discord_results?on_conflict=puzzle_date,guild_id,user_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ puzzle_date: b.date, guild_id: location.guild_id, user_id: user.id, guesses, won: b.won }),
  });
  if (!saved.ok) return json({ error: "couldn't save" }, 500);

  await updateBoard(b.date, location.guild_id, location.channel_id);
  return json({ ok: true, board: true });
}
