-- Workspace launcher size (D59). lg keeps the classic 56px circle.
alter table public.sites
  add column if not exists widget_size text not null default 'lg';
