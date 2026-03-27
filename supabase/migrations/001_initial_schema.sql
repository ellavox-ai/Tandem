-- ============================================================================
-- Ellavox Meeting Intelligence Pipeline — Initial Schema
-- ============================================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── Users ──────────────────────────────────────────────────────────────────

create table users (
  id             uuid primary key default uuid_generate_v4(),
  email          text not null unique,
  display_name   text not null,
  google_id      text unique,
  jira_account_id text,
  slack_user_id  text,
  role           text not null default 'member' check (role in ('admin', 'member')),
  preferences    jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_users_email on users(email);
create index idx_users_google_id on users(google_id) where google_id is not null;

-- ─── Transcripts ────────────────────────────────────────────────────────────

create table transcripts (
  id              uuid primary key default uuid_generate_v4(),
  provider        text not null check (provider in ('google-meet', 'zoom', 'ms-teams', 'manual')),
  external_id     text not null,
  meeting_title   text not null,
  meeting_date    timestamptz not null,
  duration        integer, -- seconds
  attendees       jsonb not null default '[]',
  utterance_count integer not null default 0,
  status          text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message   text,
  processed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (provider, external_id)
);

create index idx_transcripts_status on transcripts(status);
create index idx_transcripts_meeting_date on transcripts(meeting_date desc);

-- ─── Extracted Tasks ────────────────────────────────────────────────────────

create table extracted_tasks (
  id                    uuid primary key default uuid_generate_v4(),
  transcript_id         uuid not null references transcripts(id) on delete cascade,
  extracted_title       text not null,
  extracted_description text not null default '',
  inferred_assignees    jsonb not null default '[]',
  confidence            text not null check (confidence in ('high', 'medium', 'low')),
  missing_context       jsonb not null default '[]',
  source_quotes         jsonb not null default '[]',
  priority              text not null default 'P2' check (priority in ('P0', 'P1', 'P2', 'P3')),
  labels                jsonb not null default '[]',
  status                text not null default 'pending_interview' check (
    status in ('pending_interview', 'claimed', 'completed', 'dismissed', 'auto_created', 'expired', 'jira_failed')
  ),
  claimed_by            uuid references users(id),
  claimed_at            timestamptz,
  claim_expires_at      timestamptz,
  dismissed_reason      text,
  interview_responses   jsonb,
  jira_issue_key        text,
  jira_error            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_extracted_tasks_transcript on extracted_tasks(transcript_id);
create index idx_extracted_tasks_status on extracted_tasks(status);
create index idx_extracted_tasks_confidence on extracted_tasks(confidence);
create index idx_extracted_tasks_claimed_by on extracted_tasks(claimed_by) where claimed_by is not null;
create index idx_extracted_tasks_claim_expires on extracted_tasks(claim_expires_at) where status = 'claimed';

-- ─── Task Status History (Audit Trail) ──────────────────────────────────────

create table task_status_history (
  id          uuid primary key default uuid_generate_v4(),
  task_id     uuid not null references extracted_tasks(id) on delete cascade,
  old_status  text,
  new_status  text not null,
  changed_by  uuid references users(id),
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index idx_task_status_history_task on task_status_history(task_id);

-- ─── Pipeline Config ────────────────────────────────────────────────────────

create table pipeline_config (
  id          uuid primary key default uuid_generate_v4(),
  key         text not null unique,
  value       jsonb not null,
  updated_by  uuid references users(id),
  updated_at  timestamptz not null default now()
);

-- Insert default config
insert into pipeline_config (key, value) values
  ('confidence_auto_create_threshold', '["high"]'),
  ('interview_expiry_hours', '72'),
  ('claim_timeout_minutes', '30'),
  ('jira_default_project', '"SCRUM"'),
  ('active_providers', '["google-meet"]'),
  ('notification_channels', '{"slack": [], "email": []}'),
  ('duplicate_similarity_threshold', '0.7');

-- ─── Auto-update updated_at ─────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
  before update on users for each row execute function update_updated_at();

create trigger trg_transcripts_updated_at
  before update on transcripts for each row execute function update_updated_at();

create trigger trg_extracted_tasks_updated_at
  before update on extracted_tasks for each row execute function update_updated_at();

-- ─── Auto-record status changes ─────────────────────────────────────────────

create or replace function record_task_status_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into task_status_history (task_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, new.claimed_by);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_task_status_change
  after update on extracted_tasks for each row execute function record_task_status_change();

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table users enable row level security;
alter table transcripts enable row level security;
alter table extracted_tasks enable row level security;
alter table task_status_history enable row level security;
alter table pipeline_config enable row level security;

-- Users can read their own profile; admins can read all
create policy users_select on users for select using (
  auth.uid() = id
  or exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
);

-- Transcripts: members see meetings they attended; admins see all
create policy transcripts_select on transcripts for select using (
  exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
  or attendees @> jsonb_build_array(jsonb_build_object(
    'email', (select email from users where id = auth.uid())
  ))
);

-- Extracted tasks: accessible if user can see the transcript OR task is pending_interview
create policy extracted_tasks_select on extracted_tasks for select using (
  status = 'pending_interview'
  or exists (
    select 1 from transcripts t
    where t.id = transcript_id
    and (
      exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
      or t.attendees @> jsonb_build_array(jsonb_build_object(
        'email', (select email from users where id = auth.uid())
      ))
    )
  )
);

-- Task status history: same access as parent task
create policy task_status_history_select on task_status_history for select using (
  exists (
    select 1 from extracted_tasks et
    where et.id = task_id
    and (
      et.status = 'pending_interview'
      or exists (
        select 1 from transcripts t
        where t.id = et.transcript_id
        and (
          exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
          or t.attendees @> jsonb_build_array(jsonb_build_object(
            'email', (select email from users where id = auth.uid())
          ))
        )
      )
    )
  )
);

-- Pipeline config: admin only
create policy pipeline_config_select on pipeline_config for select using (
  exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
);

create policy pipeline_config_update on pipeline_config for update using (
  exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
);
