// A player finished the daily puzzle inside the Discord Activity: save it and update
// the "today in this server" scoreboard in that channel.
//
// Trust nothing from the browser except the player's own result:
// - who they are comes from Discord, using their access token;
// - which server and channel comes from Discord's record of the Activity session,
//   which also has to list them as a player (so nobody can post into other servers).
import { APP_ID, db, discordApi, swissDate, postFinish, puzzleNumber } from "./_shared.mjs";

const RESULTS = ["hit", "near", "miss", "skip"];

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SNOWFLAKE = /^\d{17,20}$/;

// Which server and channel the player is really in. First choice: Discord's record of the
// Activity session (it lists the players). If Discord doesn't know the session, check with the
// bot instead that the player is a member of that server and the channel belongs to it.
async function whereIsPlayer(b, userId) {
  const inst = await discordApi(`/applications/${APP_ID}/activity-instances/${encodeURIComponent(b.instance_id)}`);
  if (inst.ok) {
    const { location, users = [] } = await inst.json();
    if (!users.includes(userId)) return { error: "not in this activity" };
    return { guild_id: location?.guild_id ?? null, channel_id: location?.channel_id };
  }
  const why = `session lookup ${inst.status}`;
  if (!b.guild_id) return { guild_id: null };                     // DM: nothing to post anyway
  if (!SNOWFLAKE.test(b.guild_id) || !SNOWFLAKE.test(b.channel_id ?? "")) return { error: "unknown activity", detail: why };
  const [member, channel] = await Promise.all([
    discordApi(`/guilds/${b.guild_id}/members/${userId}`),
    discordApi(`/channels/${b.channel_id}`),
  ]);
  if (!member.ok || !channel.ok) return { error: "unknown activity", detail: `${why}, member ${member.status}, channel ${channel.status}` };
  if ((await channel.json()).guild_id !== b.guild_id) return { error: "unknown activity", detail: `${why}, channel is in another server` };
  return { guild_id: b.guild_id, channel_id: b.channel_id };
}

// Open https://zoomout.dev/api/discord-result to check that result cards can be drawn here.
export async function GET() {
  try {
    const { renderCard } = await import("./_card.mjs");
    const png = await renderCard({ number: 1, name: "Test", avatar: "https://cdn.discordapp.com/embed/avatars/0.png", won: true, guesses: 2, trail: ["near", "hit"] });
    return json({ card: "ok", bytes: png.length });
  } catch (e) {
    return json({ card: "error", message: String(e?.message || e).slice(0, 300) }, 500);
  }
}

export async function POST(request) {
  const b = await request.json().catch(() => null);
  const guesses = Number(b?.guesses), trail = b?.trail;
  if (!b || typeof b.access_token !== "string" || typeof b.instance_id !== "string" ||
      !Number.isInteger(guesses) || guesses < 1 || guesses > 6 || typeof b.won !== "boolean" ||
      ![swissDate(-1), swissDate(), swissDate(1)].includes(b.date) ||   // allow for players' time zones
      !Array.isArray(trail) || trail.length !== guesses || !trail.every(r => RESULTS.includes(r)) ||
      (trail.at(-1) === "hit") !== b.won) {
    return json({ error: "bad request" }, 400);
  }

  const me = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${b.access_token}` } });
  if (!me.ok) return json({ error: "not signed in" }, 401);
  const user = await me.json();

  const location = await whereIsPlayer(b, user.id);
  if (location.error) return json(location, 403);
  if (!location.guild_id) return json({ ok: true, board: false }); // DMs: nowhere to post a scoreboard

  // First result of the day counts; replays don't overwrite it or post again.
  const saved = await db("discord_results?on_conflict=puzzle_date,guild_id,user_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ puzzle_date: b.date, guild_id: location.guild_id, user_id: user.id, guesses, won: b.won }),
  });
  if (!saved.ok) return json({ error: "couldn't save" }, 500);
  if (!(await saved.json()).length) return json({ ok: true, posted: false, reason: "already posted" });

  // If anything below fails, forget the result again, so "Post to channel" can retry.
  const unsave = () => db(`discord_results?puzzle_date=eq.${b.date}&guild_id=eq.${encodeURIComponent(location.guild_id)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "DELETE" });
  try {
    // The card is drawn from Discord's copy of the name and avatar; neither is stored.
    // Loaded here, not at the top, so a problem with the image libraries can't break the rest.
    const { renderCard, avatarUrl } = await import("./_card.mjs");
    const card = await renderCard({
      number: puzzleNumber(b.date), name: user.global_name || user.username, avatar: avatarUrl(user),
      won: b.won, guesses, trail,
    });
    const result = await postFinish({ date: b.date, guild: location.guild_id, channel: location.channel_id, user: user.id, guesses, won: b.won, card });
    if (result.ok) return json({ ok: true, posted: true });
    await unsave();
    return json({ ok: false, posted: false, reason: result.status === 403 || result.status === 401 ? "no permission" : `discord said ${result.status}` });
  } catch (e) {
    console.warn("Posting the result failed", e);
    await unsave();
    return json({ ok: false, posted: false, reason: `server error: ${String(e?.message || e).slice(0, 120)}` }, 500);
  }
}
