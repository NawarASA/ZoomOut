# Zoom Out

A daily photo guessing game. Every day there's one new photo, starting extremely zoomed in. Each wrong guess zooms out a step. Players get six zooms to name the object.

It's a plain static website (HTML, CSS and JavaScript, no build step), so it can be hosted for free.

## What's in the folder

| Path | What it is |
|---|---|
| `index.html` | The game |
| `maker.html` | Your private tool for turning photos into puzzles |
| `puzzles.json` | The list of puzzles, one per day |
| `photos/` | The puzzle photos, named by date (`2026-10-04.jpg`) |
| `new-photos/` | Drop photos here to schedule them automatically |
| `js/config.js` | Launch date and site address |
| `js/game.js` | Game logic and animations |
| `js/maker.js` | Puzzle maker logic |
| `js/core.js` | Guess checking and zoom maths, shared by both pages |
| `css/style.css` | All styling |
| `scripts/check-puzzles.mjs` | Checks the puzzle list for mistakes and repeats |
| `scripts/schedule.mjs` | Schedules everything in `new-photos/` onto the next free days |
| `scripts/prepare-photos.ps1` | Shrinks photos and strips their GPS location (`npm run photos`) |

The three puzzles included (tennis ball, button, pencil) are **drawn sample images** so you can test everything. Replace them with your own photos before launch.

## Run it on your computer

You need [Node.js](https://nodejs.org) installed (the LTS version).

```bash
cd zoom-out
npm run dev
```

Then open http://localhost:3000. The game page needs this local server: opening `index.html` by double-clicking won't load the puzzle list.

## Add many photos at once

The fastest way to build a backlog.

1. Name each photo by its answer. Use `-` for spaces and `+` between alternative answers:
   - `tennis-ball+ball.jpg` → answers "tennis ball" and "ball"
   - `sim-card.png` → answer "sim card"
2. Put them all in the `new-photos/` folder.
3. Run `npm run photos`. This turns each photo the right way up, shrinks it, and removes its hidden metadata, including the GPS location phones save. Photos that still have a location are refused by the next steps.
4. Add close guesses for each answer to `near-words.json` (see below).
5. Run `npm run schedule`.

Each photo gets the next free day (filling any gaps first), is moved into `photos/` and renamed to its date, and gets an entry in `puzzles.json`. Add `-- --shuffle` to schedule them in random order instead of alphabetical, or `-- --dry-run` to see the plan without changing anything.

Empty `new-photos/` before you upload the site by drag-and-drop, since the file names give away the answers. With GitHub it's ignored automatically.

It skips any photo that's already in the game, even under a different name, and warns you if an answer has been used before.

Scheduled photos start zoomed on the **centre** and have no close guesses. To fine-tune one, edit its `focusX`, `focusY` and `near` in `puzzles.json`. Use the puzzle maker to find good focus values: load the photo, tap the spot, and copy the numbers it shows.

Large phone photos load slowly. `npm run check` warns about anything over 2 MB. Running a photo through the puzzle maker shrinks it to about 0.5 MB.

## Close guesses (yellow)

A guess shows **yellow** when it's close but not right. There are two kinds:

- **Automatic:** any guess that shares a word with the answer, like "coffee" for *coffee cake* or "golf ball" for *tennis ball*. Singular and plural always match, so "mug" counts as correct for *mugs*.
- **Your list:** `near-words.json` holds close words for each answer, like "biscuit" and "brownie" for *cookie*. The key is the puzzle's main answer, the first one in its file name.

`npm run schedule` adds close words from that file to new photos automatically. If you edit the file later, apply the changes to puzzles already scheduled with:

```bash
node scripts/add-near.mjs
```

`npm run check` warns about any upcoming puzzle that has no close words yet.

## No repeats

`npm run check` stops you from showing the same photo twice:

- two puzzles on the same date
- two puzzles pointing to the same photo file
- the same photo saved twice under different names (it compares the actual image data)

It also warns, without blocking, when the same answer comes up again, for example two different tennis ball photos.

## Add a puzzle by hand

1. Run `npm run dev` and open http://localhost:3000/maker.html
2. Choose a photo. It's cropped to a square automatically.
3. Tap the detail the zoom should start on. The six small lenses show what players will see at each step.
4. Fill in the accepted answers, close guesses, and the date. The date defaults to the next free day.
5. Click **Download photo** and move the file into the `photos/` folder.
6. Click **Copy puzzle entry** and paste it into `puzzles.json`, inside the `[ ]` list. Put a comma between entries, but not after the last one.
7. Run `npm run check` to make sure nothing is broken and see how many days you have scheduled.

A puzzle entry looks like this:

```json
{
  "date": "2026-10-04",
  "image": "photos/2026-10-04.jpg",
  "answers": ["tennis ball", "ball"],
  "near": ["golf ball", "lemon", "racket"],
  "focusX": 0.43,
  "focusY": 0.39,
  "credit": "@nawar"
}
```

- `answers`: the first one is shown as the solution. Small typos are accepted automatically.
- `near`: guesses that get an amber "Close" instead of red.
- `focusX`, `focusY`: where the zoom starts, from 0 to 1 (0.5, 0.5 is the centre).
- `credit`: optional, shown after the puzzle is solved.

**Photo tips:** daylight near a window, sharp focus, highest resolution. Everyday objects with strange textures work best. Test each one on a friend: most people should get it around 4× or 2.4×.

## How the daily puzzle is picked

- The game shows the puzzle whose `date` matches the player's local date, so it switches at each player's midnight.
- If there's no puzzle for today, it shows the most recent one with a note. Keep a buffer so this never happens.
- Puzzles with a future date are never shown.
- Puzzle numbers count from `launchDate` in `js/config.js`. Set it to your real launch day.
- Past puzzles appear under **Past photos** and can be replayed. Only today's puzzle counts toward stats.
- Stats and streaks are saved in each player's browser.

## Player stats ("faster than X% of players")

Uses a free Supabase database. Until it's set up, the game simply doesn't show this section.

1. Sign up at https://supabase.com and create a new project (any name, a strong database password, region **Central EU (Frankfurt)** or the closest to your players).
2. In the project, open **SQL Editor → New query**, paste everything from `supabase/setup.sql`, and click **Run**.
3. Open **Project Settings → API Keys** (or **API**). Copy the **Project URL** and the **publishable** key (older projects call it the **anon public** key).
4. Paste both into `js/config.js` as `supabaseUrl` and `supabaseKey`, then commit and push.

Both values are meant to be public. The database only lets players add one result per day and read a summary; nobody can read, change or delete individual results.

Free Supabase projects pause after a week with no activity. Once people play daily that won't happen; if it does, click **Restore** in the dashboard.

## Analytics

Cloudflare Web Analytics is free and needs no cookie banner.

1. Cloudflare dashboard → **Analytics & Logs → Web Analytics → Add a site** → enter `zoomout.dev`.
2. Cloudflare shows a snippet with `"token": "…"`. Copy just the token.
3. Paste it into `js/config.js` as `cloudflareAnalyticsToken`, then commit and push.

Visits from the installed app are tagged `?source=app`, so you can see how many people play from their home screen.

## Install as an app

The site is installable (a "web app"): `manifest.webmanifest`, the icons in `icons/`, and `sw.js` for offline support. Players see an **Install app** card on the end screen. On Android and desktop Chrome it opens the install prompt; on iPhone it shows the two Safari steps. `sw.js` always loads fresh files when online and only uses saved copies offline, so new photos and deploys show up straight away.

## Link previews

`og-image.jpg` is the picture shown when someone shares zoomout.dev in WhatsApp, iMessage, Instagram, X or Discord. The tags are in the `<head>` of `index.html`. Some apps cache previews for days; to refresh one, use a preview debugger like https://www.opengraph.xyz.

## Before you launch

1. Replace the sample puzzles and photos with your own. `npm run check` warns you about any samples left.
2. Check `launchDate` and `siteUrl` in `js/config.js`.
3. Have at least 30, ideally 60, days of puzzles scheduled.
4. Set up analytics and player stats (above).

## Put it online (free)

**Netlify, easiest:** go to https://app.netlify.com/drop and drag the whole `zoom-out` folder onto the page. It's live in seconds. To update, drag it again.

**Vercel or Netlify with GitHub, best long term:**

1. Create a GitHub repository and upload the folder.
2. Sign in to https://vercel.com (or Netlify) with GitHub and import the repository. No build settings are needed.
3. Every time you push new puzzles, the site updates by itself.

Then buy a domain (around 10–15 CHF/EUR a year) and connect it in the Vercel or Netlify dashboard.

`maker.html` gets deployed too. That's harmless, because it only works in the browser and can't change the live site, but you can delete it from the deployed copy if you prefer.

## Known limits (fine for launch)

- **The answers are visible in `puzzles.json`**, including future ones, to anyone who looks. Most players never will. A small backend that checks guesses on the server fixes this later.
- Stats are per browser, so they don't follow players between devices. Accounts would fix this, which ties in with memberships later.
