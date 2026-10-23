create table if not exists visitor_sessions (
  session_id text primary key,
  site_id uuid not null references sites (id) on delete cascade,
  visitor_id text not null,
  visitor_name text,
  visitor_email text,
  country text,
  flag text,
  browser text,
  os text,
  device text,
  timezone text,
  current_page text,
  page_views integer not null default 1 check (page_views > 0),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists visitor_sessions_site_started_idx on visitor_sessions (site_id, started_at desc);
create index if not exists visitor_sessions_site_seen_idx on visitor_sessions (site_id, last_seen_at desc);
alter table visitor_sessions enable row level security;
drop policy if exists "demo: anon read visitor sessions" on visitor_sessions;
create policy "demo: anon read visitor sessions" on visitor_sessions for select to anon using (true);

create or replace function record_visitor_session(
  p_session_id text, p_site_id uuid, p_visitor_id text, p_view boolean,
  p_name text, p_email text, p_country text, p_flag text,
  p_browser text, p_os text, p_device text, p_timezone text, p_page text
) returns void language sql security definer set search_path = public as $$
  insert into visitor_sessions (
    session_id, site_id, visitor_id, visitor_name, visitor_email, country, flag,
    browser, os, device, timezone, current_page
  ) values (
    p_session_id, p_site_id, p_visitor_id, p_name, p_email, p_country, p_flag,
    p_browser, p_os, p_device, p_timezone, p_page
  )
  on conflict (session_id) do update set
    visitor_name = coalesce(nullif(excluded.visitor_name, ''), visitor_sessions.visitor_name),
    visitor_email = coalesce(nullif(excluded.visitor_email, ''), visitor_sessions.visitor_email),
    current_page = excluded.current_page,
    page_views = visitor_sessions.page_views + case when p_view then 1 else 0 end,
    last_seen_at = now();
$$;
revoke all on function record_visitor_session(text, uuid, text, boolean, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function record_visitor_session(text, uuid, text, boolean, text, text, text, text, text, text, text, text, text) to service_role;
