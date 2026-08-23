-- CreatorBridge packages include exactly two revision rounds. Existing signed
-- contract snapshots remain immutable; this normalizes active package offers.
update public.packages set revisions = 2 where revisions is distinct from 2;

alter table public.packages
  alter column revisions set default 2,
  alter column revisions set not null;

alter table public.packages
  drop constraint if exists packages_revisions_exactly_two;

alter table public.packages
  add constraint packages_revisions_exactly_two check (revisions = 2);
