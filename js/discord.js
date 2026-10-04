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

// Tells Discord the Activity has loaded. The game doesn't wait for it.
discord.ready().catch(e => console.warn("Discord handshake failed", e));
