// Discord Activity sign-in: swaps the one-time code from discord.commands.authorize()
// for an access token. Needs the app's Client Secret, so it has to happen here, not in the browser.
import { APP_ID } from "./_shared.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function POST(request) {
  const { code } = await request.json().catch(() => ({}));
  if (typeof code !== "string" || !code) return json({ error: "missing code" }, 400);
  const res = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: APP_ID, client_secret: process.env.DISCORD_CLIENT_SECRET ?? "", grant_type: "authorization_code", code }),
  });
  if (!res.ok) { console.warn(`Token exchange failed: ${res.status} ${await res.text()}`); return json({ error: "exchange failed" }, 502); }
  const { access_token } = await res.json();
  return json({ access_token });
}
