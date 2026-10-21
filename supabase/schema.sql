-- Chat platform schema. Run once in the Supabase SQL editor.
-- Fully re-runnable: every statement is guarded (columns, tables, policies,
-- publication membership, trigger).

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  site_key text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id),
  visitor_id text not null,
  status text not null default 'open',
  last_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Visitor context, captured from the browser on first contact (D28).
  visitor_name text,
  visitor_email text,
  country text,
  flag text,
  browser text,
  os text,
  device text,
  timezone text,
  current_page text,
  -- Page-by-page journey, appended on every visitor message (D28). Capped
  -- at 20 steps by the API route; [{ id, label, path, at }].
  journey jsonb not null default '[]'
);
create index if not exists conversations_site_updated_idx
  on conversations (site_id, updated_at desc);
create index if not exists conversations_site_visitor_idx
  on conversations (site_id, visitor_id);

-- D28 migration: columns above are new for existing installs.
alter table conversations add column if not exists visitor_name text;
alter table conversations add column if not exists visitor_email text;
alter table conversations add column if not exists country text;
alter table conversations add column if not exists flag text;
alter table conversations add column if not exists browser text;
alter table conversations add column if not exists os text;
alter table conversations add column if not exists device text;
alter table conversations add column if not exists timezone text;
alter table conversations add column if not exists current_page text;
alter table conversations add column if not exists journey jsonb not null default '[]';

create table if not exists messages (
  -- Client-generated ids (the widget's uid()) double as dedup keys,
  -- so a retried POST can upsert instead of duplicating.
  id text primary key,
  conversation_id uuid not null references conversations (id) on delete cascade,
  author text not null check (author in ('visitor', 'agent')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx
  on messages (conversation_id, created_at);

-- Demo policies: wide open while there is no agent auth.
-- Tighten these (per-user / per-workspace) the moment auth lands.
alter table sites enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

drop policy if exists "demo: anon read sites" on sites;
create policy "demo: anon read sites" on sites for select to anon using (true);
drop policy if exists "demo: anon read conversations" on conversations;
create policy "demo: anon read conversations" on conversations for select to anon using (true);
drop policy if exists "demo: anon read messages" on messages;
create policy "demo: anon read messages" on messages for select to anon using (true);
drop policy if exists "demo: anon write messages" on messages;
create policy "demo: anon write messages" on messages for insert to anon with check (true);
drop policy if exists "demo: anon write conversations" on conversations;
create policy "demo: anon write conversations" on conversations for insert to anon with check (true);
drop policy if exists "demo: anon update conversations" on conversations;
create policy "demo: anon update conversations" on conversations for update to anon using (true);

-- Realtime publication: add only the tables that are missing, so re-running
-- the file after a partial failure never errors (D35).

-- D31 migration: presence/settings, read receipts, CSAT, attachments.
alter table sites add column if not exists timezone text not null default 'Asia/Kolkata';
alter table sites add column if not exists hours_start int not null default 9;
alter table sites add column if not exists hours_end int not null default 21;
alter table sites add column if not exists away_message text not null default 'We usually reply within a few hours.';
alter table sites add column if not exists welcome_message text not null default 'Hi! How can we help?';
alter table sites add column if not exists welcome_notify boolean not null default false;
alter table sites add column if not exists preset_messages jsonb not null default '[]'::jsonb;
alter table sites add column if not exists agent_online_at timestamptz;

alter table conversations add column if not exists agent_last_read_at timestamptz;
alter table conversations add column if not exists visitor_last_read_at timestamptz;
alter table conversations add column if not exists csat text;
alter table conversations add column if not exists csat_comment text;

alter table messages add column if not exists attachment_url text;
alter table messages add column if not exists attachment_name text;
alter table messages add column if not exists attachment_size text;
alter table messages add column if not exists attachment_type text;

-- Ephemeral typing state, one row per conversation (D31).
create table if not exists typing (
  conversation_id uuid primary key references conversations (id) on delete cascade,
  visitor_typing_at timestamptz,
  agent_typing_at timestamptz
);
alter table typing enable row level security;
drop policy if exists "demo: anon all typing" on typing;
create policy "demo: anon all typing" on typing for all to anon using (true) with check (true);

do $$
declare
  target text;
begin
  foreach target in array array['messages', 'conversations', 'typing'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table %I', target);
    end if;
  end loop;
end $$;

-- Attachments live in a public storage bucket; uploads are anon-allowed while
-- there is no auth (same demo posture as the tables).
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;
drop policy if exists "demo: anon upload chat attachments" on storage.objects;
create policy "demo: anon upload chat attachments" on storage.objects
  for insert to anon with check (bucket_id = 'chat-attachments');
drop policy if exists "demo: anon read chat attachments" on storage.objects;
create policy "demo: anon read chat attachments" on storage.objects
  for select to anon using (bucket_id = 'chat-attachments');

-- D37: agent profiles, exact-thread presence, live unread, persistent assignment.
create table if not exists agents (
  id text primary key,
  name text not null default 'You',
  avatar_url text,
  updated_at timestamptz not null default now()
);
alter table agents enable row level security;
drop policy if exists "demo: anon all agents" on agents;
create policy "demo: anon all agents" on agents for all to anon using (true) with check (true);

-- Heartbeat + settings need anon updates on the site row (this was missing).
drop policy if exists "demo: anon update sites" on sites;
create policy "demo: anon update sites" on sites for update to anon using (true);

alter table messages add column if not exists agent_name text;
alter table messages add column if not exists agent_avatar text;
alter table messages add column if not exists agent_id text;
alter table messages add column if not exists is_automated boolean not null default false;
alter table agents add column if not exists last_seen_at timestamptz;
alter table agents add column if not exists away_message text;
alter table typing add column if not exists agent_id text;
alter table typing add column if not exists agent_name text;
alter table typing add column if not exists agent_avatar text;
alter table conversations add column if not exists assignee text;
alter table conversations add column if not exists tags text[] not null default '{}';
alter table conversations add column if not exists unread_count int not null default 0;
alter table conversations add column if not exists last_agent_id text;

create table if not exists conversation_viewers (
  conversation_id uuid not null references conversations (id) on delete cascade,
  viewer_id text not null,
  name text not null,
  avatar_url text,
  agent_id text,
  last_seen_at timestamptz not null default now(),
  primary key (conversation_id, viewer_id)
);
alter table conversation_viewers enable row level security;
drop policy if exists "demo: anon all viewers" on conversation_viewers;
create policy "demo: anon all viewers" on conversation_viewers for all to anon using (true) with check (true);

alter table conversation_viewers add column if not exists avatar_url text;
alter table conversation_viewers add column if not exists agent_id text;

-- Dynamic tag registry (D46). The old hardcoded list is gone: tags are created
-- from the inbox and every surface reads this table. Existing conversations.tags
-- arrays are left untouched.
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index if not exists tags_site_name_key on tags (site_id, lower(name));
create index if not exists tags_site_name_idx on tags (site_id, name);

alter table tags enable row level security;
drop policy if exists "demo: anon all tags" on tags;
create policy "demo: anon all tags" on tags for all to anon using (true) with check (true);

-- One-time backfill so existing threads show sensible badges.
update conversations c
   set unread_count = (
     select count(*) from messages m
     where m.conversation_id = c.id
       and m.author = 'visitor'
       and (c.agent_last_read_at is null or m.created_at > c.agent_last_read_at)
   );

-- Message inserts maintain preview/timestamp/unread in one place (D35/D37).
-- The automated topic question and confirmation (D47) share the topic-ask-
-- namespace, so they must not replace the visitor's own message as the inbox
-- preview or bump the thread.
create or replace function public.touch_conversation() returns trigger
language plpgsql as $$
declare
  topic_note boolean;
begin
  topic_note := new.is_automated and new.id like 'topic-ask-%';
  update conversations
     set last_message = case
           when topic_note then last_message
           else coalesce(nullif(new.body, ''), new.attachment_name, 'Attachment')
         end,
         updated_at = case when topic_note then updated_at else new.created_at end,
         unread_count = case
           when new.author = 'visitor' then coalesce(unread_count, 0) + 1
           when new.is_automated then unread_count
           else 0
         end,
         last_agent_id = case
           when new.author = 'agent' and not new.is_automated then new.agent_id
           else last_agent_id
         end
   where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists messages_touch_conversation on messages;
create trigger messages_touch_conversation
  after insert on messages
  for each row execute function touch_conversation();

do $$
declare
  target text;
begin
  foreach target in array array['messages', 'conversations', 'typing', 'conversation_viewers', 'tags'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table %I', target);
    end if;
  end loop;
end $$;

-- One demo site so the snippet generator has a key immediately.
insert into sites (name, site_key)
values ('Demo site', 'site_demo_001')
on conflict (site_key) do nothing;
