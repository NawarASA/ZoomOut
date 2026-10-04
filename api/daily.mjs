// Posts the new puzzle to every server that ran /zoomout setup.
// Vercel runs this once a day around 8:00 Swiss time (the "crons" entry in vercel.json).
import { db, discordApi, reminder } from "./_shared.mjs";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const msg = await reminder();
  if (!msg) return new Response("No puzzle today, nothing posted.");

  const res = await db("discord_channels?select=guild_id,channel_id");
  if (!res.ok) return new Response(`Database error ${res.status}`, { status: 500 });

  let sent = 0, failed = 0;
  for (const { guild_id, channel_id } of await res.json()) {
    const r = await discordApi(`/channels/${channel_id}/messages`, { method: "POST", body: JSON.stringify(msg) });
    if (r.ok) { sent++; continue; }
    failed++;
    console.warn(`Couldn't post to server ${guild_id}: ${r.status} ${await r.text()}`);
    // The channel was deleted: forget it. (Other errors may be temporary, so keep those.)
    if (r.status === 404) await db(`discord_channels?guild_id=eq.${encodeURIComponent(guild_id)}`, { method: "DELETE" });
  }
  return new Response(`Posted to ${sent} server(s), ${failed} failed.`);
}
