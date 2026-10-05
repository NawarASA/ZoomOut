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
// Discord username ("identify"), for the "who solved it today" scoreboard in the server.
// The game never waits for this; declining just means no scoreboard.
const signIn = (async () => {
  await discord.ready();
  const { code } = await discord.commands.authorize({
    client_id: CONFIG.discordClientId, response_type: "code", state: "", prompt: "none", scope: ["identify"],
  });
  const res = await fetch("/api/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
  if (!res.ok) throw new Error(`token exchange ${res.status}`);
  const { access_token } = await res.json();
  await discord.commands.authenticate({ access_token });
  return access_token;
})().catch(e => { console.warn("Discord sign-in skipped", e); return null; });

// Fired by game.js when today's puzzle is finished.
addEventListener("zoomout:daily-finished", async ({ detail }) => {
  const access_token = await signIn;
  if (!access_token) return;
  fetch("/api/discord-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token, instance_id: discord.instanceId, ...detail }),
  }).catch(() => {});
});
