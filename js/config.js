// Site settings.
export const CONFIG = {
  // The day puzzle no. 1 went live (year-month-day).
  launchDate: "2026-10-03",

  // Your public address. It's added to the shared result text.
  siteUrl: "https://zoomout.dev",

  // Where the puzzle list lives (relative to index.html).
  puzzlesFile: "puzzles.json",

  // Cloudflare Web Analytics token. Leave empty to turn analytics off.
  // Cloudflare dashboard → Analytics & Logs → Web Analytics → Add a site → copy the token from the snippet.
  cloudflareAnalyticsToken: "0a221fdcfe0445dbbd72cb58f82e2072",

  // Supabase, for "faster than X% of players". Leave empty to turn it off.
  // Supabase dashboard → Project Settings → API (or "API Keys"): the Project URL and the
  // publishable / anon key. Both are safe to put here; they are meant to be public.
  supabaseUrl: "",
  supabaseKey: "",

  // Discord Activity (the game inside Discord). Discord Developer Portal → your app → Application ID.
  discordClientId: "1556278128228175872",
};
