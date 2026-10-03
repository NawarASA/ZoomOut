-- Zoom Out: player results for "faster than X% of players".
-- Paste all of this into Supabase → SQL Editor → New query, and click Run. Running it twice is safe.

-- One row per player per day. "player" is a random ID made by the browser, not a name or email.
create table if not exists public.results (
  id          bigint generated always as identity primary key,
  puzzle_date date        not null,
  player      text        not null check (length(player) between 8 and 64),
  guesses     smallint    not null check (guesses between 1 and 6),
  won         boolean     not null,
  created_at  timestamptz not null default now(),
  unique (puzzle_date, player)
);

alter table public.results enable row level security;

-- Players may add their own result for roughly today (allowing for time zones), and nothing else:
-- they can't read, change or delete anyone's rows.
drop policy if exists "players can submit a result" on public.results;
create policy "players can submit a result" on public.results
  for insert to anon
  with check (puzzle_date between current_date - 1 and current_date + 1);

grant insert on public.results to anon;

-- The game only ever reads this summary: how many players solved it at each zoom, and how many didn't.
create or replace function public.puzzle_stats(d date)
returns table (guesses smallint, won boolean, players bigint)
language sql
stable
security definer
set search_path = public
as $$
  select r.guesses, r.won, count(*) as players
  from public.results r
  where r.puzzle_date = d
  group by r.guesses, r.won;
$$;

revoke all on function public.puzzle_stats(date) from public;
grant execute on function public.puzzle_stats(date) to anon;

-- Handy for you: totals per day (run on its own in the SQL Editor whenever you're curious).
-- select puzzle_date, count(*) as players, round(100.0 * avg(won::int)) as solved_pct,
--        round(avg(guesses) filter (where won), 1) as avg_zooms
-- from public.results group by puzzle_date order by puzzle_date desc;
