// Discord sends every slash command and button click here.
// Developer Portal → General Information → Interactions Endpoint URL: https://zoomout.dev/api/discord
//
//   /zoomout play            open the game (the Activity)
//   /zoomout setup #channel  post the new puzzle there every morning (Manage Server only)
//   /zoomout stop            stop the daily posts (Manage Server only)
import { createPublicKey, verify } from "node:crypto";
import { db, discordApi, reminder } from "./_shared.mjs";

const EPHEMERAL = 64; // reply only the person who ran the command can see
const ADMINISTRATOR = 1n << 3n, MANAGE_GUILD = 1n << 5n;

const json = body => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
const reply = content => json({ type: 4, data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } } });
const launchActivity = () => json({ type: 12 });

// Open https://zoomout.dev/api/discord in a browser to see which settings the bot can find (never their values).
export function GET() {
  const set = name => Boolean(process.env[name]?.trim());
  return json({
    DISCORD_PUBLIC_KEY: /^[0-9a-f]{64}$/i.test(process.env.DISCORD_PUBLIC_KEY?.trim() ?? "") ? "ok" : set("DISCORD_PUBLIC_KEY") ? "set, but doesn't look like a public key (64 letters/digits)" : "missing",
    DISCORD_BOT_TOKEN: set("DISCORD_BOT_TOKEN") ? "ok" : "missing",
    SUPABASE_URL: set("SUPABASE_URL") ? "ok" : "missing",
    SUPABASE_SECRET_KEY: set("SUPABASE_SECRET_KEY") ? "ok" : "missing",
    CRON_SECRET: set("CRON_SECRET") ? "ok" : "missing",
  });
}

export async function POST(request) {
  const body = await request.text();
  if (!fromDiscord(request, body)) return new Response("Bad signature", { status: 401 });
  const i = JSON.parse(body);

  if (i.type === 1) return json({ type: 1 }); // Discord checking that this endpoint works
  if (i.type === 3 && i.data?.custom_id === "play") return launchActivity(); // "Play" button on a reminder

  if (i.type === 2 && i.data?.name === "zoomout") {
    const sub = i.data.options?.[0];
    if (sub?.name === "play") return launchActivity();
    if (sub?.name === "setup" || sub?.name === "stop") {
      if (!i.guild_id) return reply("This only works in a server.");
      const perms = BigInt(i.member?.permissions ?? 0);
      if (!(perms & (ADMINISTRATOR | MANAGE_GUILD))) return reply("You need the Manage Server permission for this.");
      return sub.name === "setup" ? setup(i.guild_id, sub.options?.find(o => o.name === "channel")?.value) : stop(i.guild_id);
    }
  }
  return reply("Sorry, I don't know that one.");
}

async function setup(guild, channel) {
  const saved = await db("discord_channels?on_conflict=guild_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ guild_id: guild, channel_id: channel }),
  }).catch(() => null);
  if (!saved?.ok) return reply("Couldn't save that right now. Please try again in a minute.");

  // Post today's reminder straight away, which also checks the bot can post there.
  const msg = await reminder().catch(() => null);
  if (msg) {
    const sent = await discordApi(`/channels/${channel}/messages`, { method: "POST", body: JSON.stringify(msg) });
    if (!sent.ok) return reply(`Saved, but I can't post in <#${channel}> yet. Make sure ZoomOut was added to this server with its bot, and has View Channel, Send Messages and Embed Links there.`);
  }
  return reply(`Done. The new puzzle will be posted in <#${channel}> every morning.`);
}

async function stop(guild) {
  const res = await db(`discord_channels?guild_id=eq.${encodeURIComponent(guild)}`, { method: "DELETE" }).catch(() => null);
  return reply(res?.ok ? "Daily posts are off for this server." : "Couldn't turn them off right now. Please try again in a minute.");
}

// Every request must be signed by Discord, or anyone could fake commands.
function fromDiscord(request, body) {
  const sig = request.headers.get("x-signature-ed25519"), ts = request.headers.get("x-signature-timestamp");
  if (!sig || !ts || !process.env.DISCORD_PUBLIC_KEY) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(process.env.DISCORD_PUBLIC_KEY.trim(), "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(ts + body), key, Buffer.from(sig, "hex"));
  } catch { return false; }
}
