-- ============================================================================
-- Badminton Boys — database schema
--
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Safe to re-run: everything is `if not exists` / `create or replace`.
--
-- Model: one deployment = one badminton community. Everyone who signs in sees
-- the same players, matches and leaderboards. Ratings are calculated on the
-- server, so no client can hand itself points.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  area        text not null default '',
  city        text not null default '',
  courts      int  not null default 4,
  admin_ids   uuid[] not null default '{}',
  announcement text,
  created_at  timestamptz not null default now()
);

create table if not exists profiles (
  id         uuid primary key default gen_random_uuid(),
  -- Null for "managed" players: people you added who have never signed in.
  -- When they later sign up with the same handle you can claim the row.
  user_id    uuid unique references auth.users(id) on delete set null,
  name       text not null,
  handle     text not null unique,
  emoji      text not null default '🏸',
  tint       text not null default '#C8FF2E',
  level      text not null default 'Intermediate'
             check (level in ('Beginner','Intermediate','Advanced','Competitive')),
  rating     int  not null default 1000,
  city       text not null default '',
  club_id    uuid references clubs(id) on delete set null,
  prefers    text not null default 'Both' check (prefers in ('Singles','Doubles','Both')),
  bio        text,
  role       text not null default 'player'
             check (role in ('player','scorer','organizer','admin')),
  created_by uuid references profiles(id) on delete set null,
  joined_at  timestamptz not null default now()
);

create table if not exists club_members (
  club_id    uuid not null references clubs(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (club_id, profile_id)
);

create table if not exists tournaments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  club_id    uuid references clubs(id) on delete set null,
  category   text not null default 'Singles',
  format     text not null default 'Group + Knockout',
  courts     int  not null default 2,
  starts_at  timestamptz not null default now(),
  player_ids uuid[] not null default '{}',
  stage      text not null default 'group',
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id            uuid primary key default gen_random_uuid(),
  type          text not null default 'Singles' check (type in ('Singles','Doubles')),
  team_a        uuid[] not null,
  team_b        uuid[] not null,
  format        jsonb not null default '{"bestOf":3,"pointsToWin":21,"winBy":2,"cap":30}',
  -- The match IS its rally list. Every score, serve and result is folded out of
  -- this array, on the client and in bb_match_result() below.
  rallies       jsonb not null default '[]',
  first_serve   text not null default 'A' check (first_serve in ('A','B')),
  status        text not null default 'created'
                check (status in ('created','confirmed','ready','live','awaiting_confirmation','disputed','completed')),
  competitive   boolean not null default true,
  court         text,
  club_id       uuid references clubs(id) on delete set null,
  tournament_id uuid references tournaments(id) on delete set null,
  round         text,
  scheduled_at  timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  ends_swapped  boolean not null default false,
  confirmations uuid[] not null default '{}',
  corrections   jsonb  not null default '[]',
  reactions     jsonb  not null default '{"fire":0,"clap":0,"wow":0}',
  invites_accepted uuid[] not null default '{}',
  notes         text,
  rating_delta  jsonb,
  disputes      jsonb not null default '[]',
  scorer_id     uuid references profiles(id) on delete set null,
  created_by    uuid references profiles(id) on delete set null,
  updated_at    timestamptz not null default now()
);

create table if not exists challenges (
  id       uuid primary key default gen_random_uuid(),
  from_id  uuid not null references profiles(id) on delete cascade,
  to_id    uuid not null references profiles(id) on delete cascade,
  type     text not null default 'Singles',
  best_of  int  not null default 3,
  at       timestamptz not null default now(),
  status   text not null default 'pending' check (status in ('pending','accepted','declined'))
);

create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followee_id uuid not null references profiles(id) on delete cascade,
  primary key (follower_id, followee_id)
);

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  icon       text not null default '🏸',
  text       text not null,
  link       text,
  read       boolean not null default false,
  at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists matches_status_idx      on matches (status);
create index if not exists matches_scheduled_idx   on matches (scheduled_at desc);
create index if not exists matches_team_a_idx      on matches using gin (team_a);
create index if not exists matches_team_b_idx      on matches using gin (team_b);
create index if not exists matches_tournament_idx  on matches (tournament_id);
create index if not exists notifications_owner_idx on notifications (profile_id, at desc);
create index if not exists challenges_to_idx       on challenges (to_id);
create index if not exists profiles_user_idx       on profiles (user_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The profile row belonging to whoever is calling.
create or replace function bb_me() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where user_id = auth.uid() limit 1;
$$;

create or replace function bb_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('organizer','admin') from profiles where user_id = auth.uid()), false);
$$;

create or replace function bb_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists matches_touch on matches;
create trigger matches_touch before update on matches
  for each row execute function bb_touch();

-- ---------------------------------------------------------------------------
-- The rules engine, server side.
--
-- A mirror of src/engine/scoring.ts. It exists so the server can decide a
-- result and a rating without trusting the client. The client keeps its own
-- copy for instant feedback; this one is authoritative.
-- ---------------------------------------------------------------------------

create or replace function bb_game_over(me int, them int, to_win int, win_by int, cap int)
returns boolean language sql immutable as $$
  select me >= cap or (me >= to_win and me - them >= win_by);
$$;

create or replace function bb_match_result(p_rallies jsonb, p_format jsonb)
returns table (winner text, games_a int, games_b int, points_a int, points_b int, finished boolean)
language plpgsql immutable as $$
declare
  to_win int := coalesce((p_format->>'pointsToWin')::int, 21);
  win_by int := coalesce((p_format->>'winBy')::int, 2);
  cap    int := coalesce((p_format->>'cap')::int, 30);
  best_of int := coalesce((p_format->>'bestOf')::int, 3);
  need   int := best_of / 2 + 1;
  a int := 0; b int := 0;
  ga int := 0; gb int := 0;
  pa int := 0; pb int := 0;
  r jsonb;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rallies, '[]'::jsonb)) loop
    -- Rallies played after the match was already decided are ignored, exactly
    -- as the client ignores them.
    exit when ga >= need or gb >= need;

    if r->>'by' = 'A' then a := a + 1; pa := pa + 1;
    else                   b := b + 1; pb := pb + 1;
    end if;

    if bb_game_over(a, b, to_win, win_by, cap) then
      ga := ga + 1; a := 0; b := 0;
    elsif bb_game_over(b, a, to_win, win_by, cap) then
      gb := gb + 1; a := 0; b := 0;
    end if;
  end loop;

  winner   := case when ga >= need then 'A' when gb >= need then 'B' else null end;
  games_a  := ga;
  games_b  := gb;
  points_a := pa;
  points_b := pb;
  finished := winner is not null;
  return next;
end $$;

-- ---------------------------------------------------------------------------
-- Scoring. Points are appended server side so two devices scoring the same
-- match can't overwrite each other's rallies.
-- ---------------------------------------------------------------------------

-- Who is allowed to move the score: the people on court, an assigned scorer,
-- whoever set the match up, or an organiser. Checked in code because the
-- scoring functions are `security definer` and so run past RLS.
-- The coalesce is load-bearing: an unassigned scorer_id makes `scorer_id =
-- bb_me()` null, which would make the whole OR null, and `if not null` is not
-- `if true` — the check would silently pass. RLS folds null to false for you;
-- plain plpgsql does not.
create or replace function bb_can_score(m matches) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    bb_me() = any(m.team_a)
    or bb_me() = any(m.team_b)
    or m.scorer_id = bb_me()
    or m.created_by = bb_me()
    or bb_is_admin(),
    false);
$$;

create or replace function bb_add_point(p_match uuid, p_side text)
returns matches language plpgsql security definer set search_path = public as $$
declare m matches; res record;
begin
  if p_side not in ('A','B') then raise exception 'side must be A or B'; end if;

  select * into m from matches where id = p_match for update;
  if not found then raise exception 'no such match'; end if;
  if not bb_can_score(m) then raise exception 'you are not scoring this match'; end if;

  select * into res from bb_match_result(m.rallies, m.format);
  if res.finished then return m; end if;

  update matches set
    rallies    = m.rallies || jsonb_build_object('by', p_side, 'at', (extract(epoch from now()) * 1000)::bigint),
    status     = 'live',
    started_at = coalesce(m.started_at, now())
  where id = p_match returning * into m;

  -- Did that point end it?
  select * into res from bb_match_result(m.rallies, m.format);
  if res.finished then
    update matches set status = 'awaiting_confirmation' where id = p_match returning * into m;
  end if;

  return m;
end $$;

create or replace function bb_undo_point(p_match uuid)
returns matches language plpgsql security definer set search_path = public as $$
declare m matches; n int;
begin
  select * into m from matches where id = p_match for update;
  if not found then raise exception 'no such match'; end if;
  if not bb_can_score(m) then raise exception 'you are not scoring this match'; end if;

  n := jsonb_array_length(m.rallies);
  if n = 0 then return m; end if;

  -- Drop the last rally. jsonb_agg has no inherent order, so the ordinality
  -- column has to be carried through and sorted on explicitly.
  update matches set
    rallies       = (select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
                     from jsonb_array_elements(m.rallies) with ordinality t(e, i)
                     where i < n),
    status        = case when m.status = 'awaiting_confirmation' then 'live' else m.status end,
    confirmations = '{}'
  where id = p_match returning * into m;

  return m;
end $$;

-- ---------------------------------------------------------------------------
-- Settlement. Mirrors src/engine/rating.ts. Only this function may move a
-- rating — the guard trigger below rejects everything else.
-- ---------------------------------------------------------------------------

-- Has one side signed off on the result?
--
-- Yes if any of its players confirmed — or if none of them has an account at
-- all. Most matches here are scored on one phone against friends who were added
-- as managed players; they can't tap "confirm" because they never sign in, and
-- without this a rating would never move.
create or replace function bb_side_signed_off(ids uuid[], confirmations uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from unnest(ids) x where x = any(confirmations))
      or not exists (select 1 from profiles where id = any(ids) and user_id is not null);
$$;

create or replace function bb_settle_match(p_match uuid)
returns matches language plpgsql security definer set search_path = public as $$
declare
  m matches; res record;
  base_k constant numeric := 32;
  ra numeric; rb numeric;
  spread numeric; margin numeric;
  deltas jsonb := '{}'::jsonb;
  pid uuid; side text; mine numeric; theirs numeric;
  played int; k numeric; expct numeric; d int; cur int;
begin
  select * into m from matches where id = p_match for update;
  if not found then raise exception 'no such match'; end if;
  if m.status = 'completed' then return m; end if;

  select * into res from bb_match_result(m.rallies, m.format);
  if not res.finished then raise exception 'match is not finished'; end if;

  -- Both sides must have signed off. One team cannot ratify its own win.
  if not (bb_side_signed_off(m.team_a, m.confirmations)
      and bb_side_signed_off(m.team_b, m.confirmations)) then
    raise exception 'result needs a confirmation from each side';
  end if;

  if not m.competitive then
    update matches set status = 'completed', completed_at = now(), rating_delta = '{}'::jsonb
    where id = p_match returning * into m;
    return m;
  end if;

  select coalesce(avg(rating), 1000) into ra from profiles where id = any(m.team_a);
  select coalesce(avg(rating), 1000) into rb from profiles where id = any(m.team_b);

  spread := abs(res.points_a - res.points_b)::numeric / greatest(1, res.points_a + res.points_b);
  margin := 0.85 + spread * 0.9;

  perform set_config('bb.settling', 'on', true);

  foreach pid in array (m.team_a || m.team_b) loop
    if pid = any(m.team_a) then side := 'A'; mine := ra; theirs := rb;
    else                         side := 'B'; mine := rb; theirs := ra;
    end if;

    select count(*) into played from matches x
      where x.status = 'completed' and pid = any(x.team_a || x.team_b);

    select rating into cur from profiles where id = pid;
    k := case
           when played < 10 then base_k * 1.6   -- placement matches move fast
           when cur > 1300  then base_k * 0.75  -- the top of the ladder is stickier
           else base_k
         end;

    expct := 1 / (1 + power(10, (theirs - mine) / 400));
    d := round(k * ((case when res.winner = side then 1 else 0 end) - expct) * margin);

    update profiles set rating = greatest(100, rating + d) where id = pid;
    deltas := deltas || jsonb_build_object(pid::text, d);
  end loop;

  perform set_config('bb.settling', 'off', true);

  update matches set status = 'completed', completed_at = now(), rating_delta = deltas
  where id = p_match returning * into m;

  return m;
end $$;

create or replace function bb_confirm_result(p_match uuid)
returns matches language plpgsql security definer set search_path = public as $$
declare m matches; me uuid;
begin
  me := bb_me();
  if me is null then raise exception 'not signed in'; end if;

  select * into m from matches where id = p_match for update;
  if not found then raise exception 'no such match'; end if;

  if not (me = any(m.team_a) or me = any(m.team_b) or bb_is_admin()) then
    raise exception 'only a player in this match can confirm it';
  end if;

  if not (me = any(m.confirmations)) then
    update matches set confirmations = m.confirmations || me where id = p_match returning * into m;
  end if;

  if bb_side_signed_off(m.team_a, m.confirmations)
     and bb_side_signed_off(m.team_b, m.confirmations) then
    m := bb_settle_match(p_match);
  end if;

  return m;
end $$;

-- Ratings are server business. A client UPDATE that tries to change one is
-- silently reverted rather than rejected, so ordinary profile edits still work.
create or replace function bb_guard_rating() returns trigger
language plpgsql as $$
begin
  if new.rating is distinct from old.rating
     and coalesce(current_setting('bb.settling', true), 'off') <> 'on' then
    new.rating := old.rating;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_rating on profiles;
create trigger profiles_guard_rating before update on profiles
  for each row execute function bb_guard_rating();

-- ---------------------------------------------------------------------------
-- Row level security
--
-- One community per deployment: any signed-in person reads everything. Writes
-- are scoped to what you own or take part in.
-- ---------------------------------------------------------------------------

alter table profiles      enable row level security;
alter table clubs         enable row level security;
alter table club_members  enable row level security;
alter table tournaments   enable row level security;
alter table matches       enable row level security;
alter table challenges    enable row level security;
alter table follows       enable row level security;
alter table notifications enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','clubs','club_members','tournaments','matches','challenges','follows','notifications'] loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t || '_read', t);
  end loop;
end $$;

-- Public spectating. A shared "watch this match" link has to open for someone
-- with no account at all, which needs read access to the match and to the names
-- of the people in it — and nothing else. Drop these two policies if you'd
-- rather the community be entirely private.
drop policy if exists matches_public_read on matches;
create policy matches_public_read on matches for select to anon
  using (status in ('live','awaiting_confirmation','completed'));

drop policy if exists profiles_public_read on profiles;
create policy profiles_public_read on profiles for select to anon using (true);

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert to authenticated
  with check (user_id = auth.uid() or (user_id is null and created_by = bb_me()));

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update to authenticated
  using (user_id = auth.uid() or created_by = bb_me() or bb_is_admin());

-- matches -------------------------------------------------------------------
drop policy if exists matches_insert on matches;
create policy matches_insert on matches for insert to authenticated
  with check (created_by = bb_me());

drop policy if exists matches_update on matches;
create policy matches_update on matches for update to authenticated
  using (
    bb_me() = any(team_a) or bb_me() = any(team_b)
    or scorer_id = bb_me() or created_by = bb_me() or bb_is_admin()
  );

drop policy if exists matches_delete on matches;
create policy matches_delete on matches for delete to authenticated
  using (created_by = bb_me() or bb_is_admin());

-- everything else -----------------------------------------------------------
drop policy if exists challenges_write on challenges;
create policy challenges_write on challenges for insert to authenticated
  with check (from_id = bb_me());

drop policy if exists challenges_update on challenges;
create policy challenges_update on challenges for update to authenticated
  using (to_id = bb_me() or from_id = bb_me());

drop policy if exists follows_write on follows;
create policy follows_write on follows for insert to authenticated with check (follower_id = bb_me());
drop policy if exists follows_delete on follows;
create policy follows_delete on follows for delete to authenticated using (follower_id = bb_me());

drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update to authenticated using (profile_id = bb_me());
drop policy if exists notifications_insert on notifications;
create policy notifications_insert on notifications for insert to authenticated with check (true);

drop policy if exists clubs_insert on clubs;
create policy clubs_insert on clubs for insert to authenticated with check (true);
drop policy if exists clubs_update on clubs;
create policy clubs_update on clubs for update to authenticated
  using (bb_me() = any(admin_ids) or bb_is_admin());

drop policy if exists club_members_write on club_members;
create policy club_members_write on club_members for insert to authenticated with check (profile_id = bb_me());
drop policy if exists club_members_delete on club_members;
create policy club_members_delete on club_members for delete to authenticated using (profile_id = bb_me());

drop policy if exists tournaments_insert on tournaments;
create policy tournaments_insert on tournaments for insert to authenticated with check (bb_is_admin());
drop policy if exists tournaments_update on tournaments;
create policy tournaments_update on tournaments for update to authenticated using (bb_is_admin());

-- ---------------------------------------------------------------------------
-- Realtime — this is what makes a spectator's phone follow the scorer's taps.
-- ---------------------------------------------------------------------------

do $$
begin
  begin execute 'alter publication supabase_realtime add table matches';       exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table profiles';      exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table challenges';    exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table notifications'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table clubs';         exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table tournaments';   exception when duplicate_object then null; end;
end $$;
