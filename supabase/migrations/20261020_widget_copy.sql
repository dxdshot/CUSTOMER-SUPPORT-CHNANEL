alter table public.sites
  add column if not exists welcome_message text not null default 'Hi! How can we help?';

alter table public.sites
  add column if not exists preset_messages jsonb not null default '[]'::jsonb;
