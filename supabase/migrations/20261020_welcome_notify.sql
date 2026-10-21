/*
D50: per-site welcome notification toggle.
Idempotent; safe to rerun.
*/
alter table sites
  add column if not exists welcome_notify boolean not null default false;
