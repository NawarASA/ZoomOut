// Runs only when the game is opened as a Discord Activity (loaded by app.js).
// Discord shows the site through its own proxy and blocks every other server, so
// outside calls go through the URL mappings set in the Discord Developer Portal
// (Activities > URL Mappings). The game itself needs none: "/" maps to zoomout.dev.
//
// js/discord-sdk.js is @discord/embedded-app-sdk 2.5.0 (MIT), bundled into one file
// with esbuild so the site keeps working without a build step.
import { CONFIG } from "./config.js";
import { DiscordSDK, patchUrlMappings } from "./discord-sdk.js";

// "Faster than X%": needs the mapping /supabase -> <project>.supabase.co in the portal.
if (CONFIG.supabaseUrl) patchUrlMappings([{ prefix: "/supabase", target: new URL(CONFIG.supabaseUrl).host }]);

export const discord = new DiscordSDK(CONFIG.discordClientId);

// Tells Discord the Activity has loaded, then asks once for permission to see the player's
// Discord username ("identify"), for the result card and scoreboard in the channel.
// The game never waits for this; declining just means nothing is posted.
const ready = discord.ready();
let signIn = null; // Promise of { token } or { error }

function startSignIn(prompt) {
  signIn = (async () => {
    await ready;
    const { code } = await discord.commands.authorize({
      client_id: CONFIG.discordClientId, response_type: "code", state: "", prompt, scope: ["identify"],
    });
    const res = await fetch("/api/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (!res.ok) {
      const { reason } = await res.json().catch(() => ({}));
      throw new Error(`sign-in failed on the server (${res.status}${reason ? `, Discord said: ${reason}` : ""})`);
    }
    const { access_token } = await res.json();
    await discord.commands.authenticate({ access_token });
    return { token: access_token };
  })().catch(e => {
    console.warn("Discord sign-in skipped", e);
    const msg = String(e?.message || e);
    return { error: /cancel|denied|closed|4002/i.test(msg) ? "You didn't allow ZoomOut to see your Discord name, so it can't post your result." : `Couldn't sign in with Discord: ${msg}` };
  });
  return signIn;
}
startSignIn("none");

// "Post to channel" on the end screen, plus what happened.
const box = document.getElementById("discord-post"), btn = document.getElementById("discord-post-btn"), note = document.getElementById("discord-post-msg");
let todays = null;
const say = (text, cls = "") => { note.textContent = text; note.className = `discord-post-msg ${cls}`; };
const REASONS = {
  "not signed in": "Discord sign-in expired. Tap Post to channel to try again.",
  "not in this activity": "Discord says you're not in this Activity session. Reopen ZoomOut and try again.",
  "unknown activity": "Discord didn't recognise this Activity session. Reopen ZoomOut and try again.",
  "couldn't save": "The scoreboard database didn't answer. Try again in a minute.",
};

async function post(detail, { retrySignIn = false } = {}) {
  if (!discord.guildId) { say("Results are posted in servers only, not in DMs."); return; }
  btn.disabled = true; say("Posting your result…");
  let auth = await signIn;
  if (auth.error && retrySignIn) auth = await startSignIn("consent");
  if (auth.error) { say(auth.error, "err"); btn.disabled = false; return; }
  try {
    const res = await fetch("/api/discord-result", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: auth.token, instance_id: discord.instanceId, guild_id: discord.guildId, channel_id: discord.channelId, ...detail }),
    });
    const out = await res.json().catch(() => ({}));
    if (out.posted) { say("Posted to the channel.", "ok"); btn.hidden = true; return; }
    if (out.reason === "already posted") { say("Your result for today is already in the channel.", "ok"); btn.hidden = true; return; }
    if (out.reason === "no permission") say("ZoomOut's bot can't post in this channel. Ask an admin to give it View Channel, Send Messages, Embed Links and Attach Files here.", "err");
    else if (/member (403|404)|channel (403|404)/.test(out.detail || "")) say("ZoomOut's bot can't see this server or channel. Ask an admin to add the bot with the install link and allow it to View Channel here.", "err");
    else say(`${REASONS[out.error] || `Couldn't post your result (${out.error || out.reason || res.status}).`}${out.detail ? ` [${out.detail}]` : ""}`, "err");
  } catch (e) { say(`Couldn't reach ZoomOut: ${e.message}`, "err"); }
  btn.disabled = false;
}

// game.js: today's puzzle was just finished (post automatically) / its end screen is showing.
addEventListener("zoomout:daily-finished", ({ detail }) => { todays = detail; post(detail); });
addEventListener("zoomout:daily-end-shown", ({ detail }) => { todays = detail; box.hidden = false; });
btn.addEventListener("click", () => todays && post(todays, { retrySignIn: true }));
