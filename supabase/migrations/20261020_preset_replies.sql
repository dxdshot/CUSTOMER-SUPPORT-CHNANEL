alter table public.messages
  add column if not exists is_automated boolean not null default false;

create or replace function public.touch_conversation() returns trigger
language plpgsql as $$
begin
  update conversations
     set last_message = coalesce(nullif(new.body, ''), new.attachment_name, 'Attachment'),
         updated_at = new.created_at,
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
