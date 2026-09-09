-- ============================================================================
-- Badminton Boys — wipe the database back to empty
--
-- DESTRUCTIVE AND IRREVERSIBLE. This deletes every account, every player,
-- every match and every rating. There is no undo and Supabase keeps no
-- automatic backup on the free plan. Take one first if you might want the
-- season back:  Dashboard → Database → Backups.
--
-- What survives: the schema itself, and the one club row every player is
-- attached to. That row is deliberately kept — `bb_default_club()` points new
-- profiles at its hard-coded id, so deleting it would make every future
-- sign-up fail on a foreign key.
--
-- Paste into the Supabase SQL editor and run. Afterwards the first person to
-- sign in creates their account from scratch, exactly like a new deployment.
-- ============================================================================

begin;

-- App data. Order is only for readability — most of these cascade from
-- profiles anyway — but doing it explicitly means the counts below are honest.
delete from notifications;
delete from challenges;
delete from follows;
delete from matches;
delete from tournaments;
delete from club_members;
delete from profiles;

-- The accounts themselves. Sessions, refresh tokens and identities cascade
-- from here, so everyone signed in on a phone is signed out on next reload.
delete from auth.users;

commit;

-- Should all be zero.
select
  (select count(*) from auth.users)     as users,
  (select count(*) from profiles)       as players,
  (select count(*) from matches)        as matches,
  (select count(*) from club_members)   as memberships,
  (select count(*) from clubs)          as clubs_kept;
