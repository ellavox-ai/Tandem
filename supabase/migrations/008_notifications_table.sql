-- ============================================================================
-- In-app notifications
-- ============================================================================

create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references users(id) on delete cascade,
  type        text not null check (type in (
    'interview_needed',
    'claim_expiring',
    'interview_completed',
    'auto_pushed',
    'push_failed'
  )),
  title       text not null,
  body        text not null default '',
  link        text,
  read        boolean not null default false,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- user_id is nullable: null = broadcast to all users
create index idx_notifications_user on notifications(user_id) where user_id is not null;
create index idx_notifications_unread on notifications(user_id, read) where read = false;
create index idx_notifications_created on notifications(created_at desc);

-- RLS
alter table notifications enable row level security;

-- Users can read their own notifications + broadcasts (user_id is null)
create policy notifications_select on notifications for select using (
  user_id = auth.uid() or user_id is null
);

-- Users can update (mark read) their own notifications
create policy notifications_update on notifications for update using (
  user_id = auth.uid() or user_id is null
) with check (
  user_id = auth.uid() or user_id is null
);

-- Service role inserts; allow authenticated as fallback
create policy notifications_insert on notifications for insert
  with check (auth.uid() is not null);

-- No browser-side delete
create policy notifications_delete on notifications for delete using (false);

-- Enable Realtime for live bell updates
alter publication supabase_realtime add table notifications;
