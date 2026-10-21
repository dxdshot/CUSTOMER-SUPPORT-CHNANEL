/*
D46/D47: dynamic tags and the visitor topic prompt.
Idempotent. Safe to run on its own or after supabase/schema.sql.
*/

/*
Tag registry. No rows are seeded: the old hardcoded list is gone.
Existing conversations.tags arrays stay as historical assignments and can be
re-created through the inbox.
*/
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade,
  name text not null check (
    name = btrim(name)
    and char_length(name) between 1 and 40
  ),
  created_at timestamptz not null default now()
);
create unique index if not exists tags_site_name_key
  on tags (site_id, lower(name));
create index if not exists tags_site_name_idx
  on tags (site_id, name);

alter table tags enable row level security;
drop policy if exists "demo: anon all tags" on tags;
create policy "demo: anon all tags"
  on tags for all to anon
  using (true) with check (true);

/*
Preserve tags already attached to conversations. This is a data migration,
not a preset list: only names actually in use are copied, one row per
case-insensitive spelling.
*/
insert into tags (site_id, name)
select distinct on (c.site_id, lower(btrim(t.tag)))
  c.site_id, btrim(t.tag)
from conversations c
cross join lateral unnest(c.tags) as t(tag)
where char_length(btrim(t.tag)) between 1 and 40
order by c.site_id, lower(btrim(t.tag)), btrim(t.tag)
on conflict do nothing;

/* New tags must appear in every open dashboard tab without a reload. */
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tags'
  ) then
    execute 'alter publication supabase_realtime add table tags';
  end if;
end $$;

/*
The topic question and its confirmation are inserted as automated agent
messages with ids topic-ask-<conversation> and topic-ask-ack-<conversation>.
The topic-ask- namespace is transcript-only: they survive reloads and are
visible to agents, but must not become the inbox preview or bump the thread.
The visitor's own message stays the last_message/updated_at value.
*/
create or replace function public.touch_conversation() returns trigger
language plpgsql as $$
declare
  topic_note boolean;
begin
  topic_note := new.is_automated and new.id like 'topic-ask-%';
  update conversations
     set last_message = case
           when topic_note then last_message
           else coalesce(
             nullif(new.body, ''),
             new.attachment_name,
             'Attachment'
           )
         end,
         updated_at = case
           when topic_note then updated_at
           else new.created_at
         end,
         unread_count = case
           when new.author = 'visitor'
             then coalesce(unread_count, 0) + 1
           when new.is_automated then unread_count
           else 0
         end,
         last_agent_id = case
           when new.author = 'agent' and not new.is_automated
             then new.agent_id
           else last_agent_id
         end
   where id = new.conversation_id;
  return new;
end $$;
