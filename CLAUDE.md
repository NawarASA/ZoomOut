# Zoom Out — project notes for Claude

Zoom Out is a daily photo guessing game, live at https://zoomout.dev. Every day one photo starts at 16× zoom; each wrong guess (or "Zoom out") pulls back a step through 16×, 12×, 8×, 5×, 2.5×, 1× (`STEPS` in `js/core.js`; was 16/8/4/2.4/1.5/1 until 2026-10-04, players said it was too easy by the third guess). Six tries. Built and run by Nawar.

## How it's built
- Plain static site: HTML, CSS, vanilla JS modules. No framework, no build step.
- `index.html` game page · `maker.html` private puzzle maker · `css/style.css` all styles
- `js/game.js` game, lens view, how-to-play guide · `js/core.js` guess checking + `drawView` zoom crop (shared)
- `js/app.js` offline service worker registration, Cloudflare analytics loader, install-as-app button
- `js/crowd.js` "faster than X% of players" via Supabase REST (plain fetch, no SDK)
- `js/config.js` launch date, site URL, analytics token, Supabase URL/key (all public values)
- `puzzles.json` one entry per day: `date, image, answers[], near[], focusX, focusY, credit?`
- `photos/` named by date · `new-photos/` inbox for the scheduler (gitignored)
- `near-words.json` close guesses keyed by main answer
- `scripts/` Node CLI: `schedule.mjs` (file name = answer, `+` separates alternatives, `--shuffle`, `--dry-run`), `add-near.mjs`, `check-puzzles.mjs` (`npm run check`, also blocks photos with GPS), `remove-samples.mjs`, shared `lib.mjs`; `prepare-photos.ps1` (`npm run photos`, Windows PowerShell + System.Drawing)
- `privacy.html` / `terms.html` (contact hello@zoomout.dev via Cloudflare Email Routing; operator Nawar, Switzerland, FADP + GDPR). Keep them accurate when adding data-related features (e.g. Discord login, new services).
- `js/discord.js` Discord Activity "ZoomOut" (app ID 1556278128228175872, owned by team "Zoom Outers", verified by Discord 2026-10-04, so the name can only be changed via Discord support): loaded by `app.js` only inside Discord (`*.discordsays.com` / `frame_id`), calls `ready()`; `js/discord-sdk.js` is the vendored, esbuild-bundled `@discord/embedded-app-sdk` 2.5.0. Discord blocks all other hosts, so any new outside service needs a URL mapping in the Developer Portal plus `patchUrlMappings`. No Discord login yet (that would need a token-exchange function and the Client Secret in Vercel env vars, never in the repo).
- Discord bot (same app), no gateway/always-on server: `api/discord.mjs` is the Interactions Endpoint (`/zoomout play|setup|stop`, "Play" button → launch Activity, Ed25519 signature check with node:crypto); `api/daily.mjs` is a Vercel Cron (`vercel.json`, 06:00 UTC ≈ 8:00 Swiss) posting "Zoom Out no. X is live" + yesterday's answer in a spoiler to every channel in Supabase table `discord_channels`; shared code in `api/_shared.mjs`. Secrets only as Vercel env vars (`DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`). Register commands with `scripts/register-commands.mjs` (POSTs one command, never bulk-PUT, which would delete the Activity's Launch command).
- Fonts are self-hosted (`fonts/`, `css/fonts.css`), not Google Fonts: needed for Discord's CSP and avoids the EU privacy issue.
- `sw.js` network-first service worker (offline fallback only, never serves stale files when online)
- `manifest.webmanifest`, `icons/`, `og-image.jpg` (link preview), `supabase/setup.sql`
- Hosting: GitHub repo NawarASA/ZoomOut (private) → Vercel auto-deploys every push to `main`. Domain on Cloudflare, DNS records CNAME → Vercel, proxy OFF (grey cloud). `vercel.json` / `_headers` set cache headers.

## Decisions already made (don't undo without asking)
- Keep the current dark "camera lens" UI. A fuller camera theme (shutter button, film strip) was demoed and rejected.
- No emojis anywhere, including the share text.
- Zoom is drawn on a canvas with `drawView` (only the visible crop). Never go back to CSS-scaling the full image: it made phones lag badly.
- Background lights are drawn once and drifted with a CSS transform; only redraw on width change (phone toolbars/keyboard must not cause jitter).
- Reduced-motion users get gentle fades (photo crossfades between zoom levels), not zero animation.
- Close guesses (yellow): automatic when a guess shares a word with the answer; singular/plural always match; extra words come from `near-words.json`. Free word-association APIs (Datamuse) were tested and rejected as too noisy. Nawar sends new batches and Claude writes the near-words entries by hand.
- Memberships/paid puzzle making are postponed until there's a daily audience.
- Analytics: Cloudflare Web Analytics with manual token (not proxy auto-inject).

## Every new photo Nawar sends (always, without being asked)
1. Use the full-size original if there is one (e.g. in `Downloads`), not a chat-pasted copy. Save it into `new-photos/` named by its answers (`zeppelin+blimp+airship+dirigible.jpg`).
2. `npm run photos`: turns it upright, shrinks to max 2048 px, strips all metadata including GPS location. `schedule` and `check` refuse photos that still have GPS.
3. Write a `near-words.json` entry (key = main answer, 10–16 close guesses) by hand BEFORE scheduling, so the yellow guesses land in `puzzles.json`.
4. `node scripts/schedule.mjs`, then set `focusX`/`focusY` on an interesting, non-giveaway detail (render the 6 zoom steps to check), then `npm run check`.
5. Commit and push so Vercel deploys.

## Working with Nawar
- Windows + PowerShell, project folder `C:\Users\plate\Documents\zoom-out` (local Documents, not the OneDrive one). In PowerShell use `node scripts/schedule.mjs --shuffle` rather than `npm run schedule -- --shuffle` (PowerShell can drop the `--`).
- Prefers short, plain explanations and step-by-step commands. Test changes in a browser at phone size before calling them done.

## Open to-dos
- Set up Supabase (steps in README) so "faster than X%" switches on, ideally before the public launch.
- Next photo batch before 15 October (current puzzles run out then).
- Ideas not built yet: daily reveal-video export for TikTok/Reels, German version (UI + German answers), hint button, hard mode, hiding answers from `puzzles.json` (server-side checking).
