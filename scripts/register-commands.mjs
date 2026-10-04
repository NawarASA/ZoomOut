// Creates or updates the bot's /zoomout command on Discord. Run once, and again after changing it.
// In PowerShell (the token is only used for this run, never saved):
//
//   $env:DISCORD_BOT_TOKEN = Read-Host "Bot token"; node scripts/register-commands.mjs
//
// The command is added on its own instead of replacing the whole list,
// so the Activity's "Launch" command that Discord made stays in place.
const APP_ID = "1556278128228175872";
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('No bot token. Run: $env:DISCORD_BOT_TOKEN = Read-Host "Bot token"; node scripts/register-commands.mjs');
  process.exit(1);
}

const command = {
  name: "zoomout",
  description: "Zoom Out, the daily zoomed-in photo game",
  integration_types: [0, 1], // server install and user install
  contexts: [0, 1, 2],       // servers, DMs with the bot, other DMs
  options: [
    { type: 1, name: "play", description: "Open today's puzzle" },
    {
      type: 1, name: "setup", description: "Post the new puzzle in a channel every morning (needs Manage Server)",
      options: [{ type: 7, name: "channel", description: "Where to post", required: true, channel_types: [0, 5] }],
    },
    { type: 1, name: "stop", description: "Stop the daily posts in this server (needs Manage Server)" },
  ],
};

const res = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
  method: "POST",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(command),
});
if (!res.ok) { console.error(`Discord said ${res.status}: ${await res.text()}`); process.exit(1); }
console.log("/zoomout play, setup and stop are registered. They can take a minute to appear in Discord.");
