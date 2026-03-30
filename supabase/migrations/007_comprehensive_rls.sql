-- ============================================================================
-- Comprehensive RLS policies — defense-in-depth
-- API routes use supabaseAdmin (bypasses RLS), so these are a safety net
-- in case any code path accidentally uses the anon/user client.
-- ============================================================================

-- ─── Users ────────────────────────────────────────────────────────────────────

-- (SELECT already handled in 005)

-- Users can update their own profile (display_name, preferences)
drop policy if exists users_update_self on users;
create policy users_update_self on users for update using (
  auth.uid() = id
) with check (
  auth.uid() = id
);

-- Only service role can delete users (no browser delete)
drop policy if exists users_delete on users;
create policy users_delete on users for delete using (false);


-- ─── Transcripts ──────────────────────────────────────────────────────────────

-- SELECT already exists from 001

-- Authenticated users can insert transcripts (upload)
drop policy if exists transcripts_insert on transcripts;
create policy transcripts_insert on transcripts for insert
  with check (auth.uid() is not null);

-- Admin can update transcript status
drop policy if exists transcripts_update on transcripts;
create policy transcripts_update on transcripts for update using (
  exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
);

-- No browser-side delete
drop policy if exists transcripts_delete on transcripts;
create policy transcripts_delete on transcripts for delete using (false);


-- ─── Extracted Tasks ──────────────────────────────────────────────────────────

-- SELECT already exists from 001

-- Authenticated users can update tasks they've claimed or admin can update any
drop policy if exists extracted_tasks_update on extracted_tasks;
create policy extracted_tasks_update on extracted_tasks for update using (
  claimed_by = auth.uid()
  or exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
);

-- Service role inserts tasks during processing; allow authenticated insert as fallback
drop policy if exists extracted_tasks_insert on extracted_tasks;
create policy extracted_tasks_insert on extracted_tasks for insert
  with check (auth.uid() is not null);

-- No browser-side delete
drop policy if exists extracted_tasks_delete on extracted_tasks;
create policy extracted_tasks_delete on extracted_tasks for delete using (false);


-- ─── Task Status History ──────────────────────────────────────────────────────

-- SELECT already exists from 001

-- Allow inserts from authenticated users (trigger runs as definer, but belt-and-suspenders)
drop policy if exists task_status_history_insert on task_status_history;
create policy task_status_history_insert on task_status_history for insert
  with check (auth.uid() is not null);

-- No updates or deletes on audit trail
drop policy if exists task_status_history_update on task_status_history;
create policy task_status_history_update on task_status_history for update using (false);

drop policy if exists task_status_history_delete on task_status_history;
create policy task_status_history_delete on task_status_history for delete using (false);


-- ─── Pipeline Config ──────────────────────────────────────────────────────────

-- Relax SELECT: all authenticated users can read config (not just admin)
-- API routes already enforce auth; this lets the browser client read if needed
drop policy if exists pipeline_config_select on pipeline_config;
create policy pipeline_config_select on pipeline_config for select using (
  auth.uid() is not null
);

-- UPDATE: any authenticated user (API routes enforce role checks separately)
drop policy if exists pipeline_config_update on pipeline_config;
create policy pipeline_config_update on pipeline_config for update using (
  auth.uid() is not null
);

-- INSERT (upsert needs this): any authenticated user
drop policy if exists pipeline_config_insert on pipeline_config;
create policy pipeline_config_insert on pipeline_config for insert
  with check (auth.uid() is not null);

-- No browser-side delete of config
drop policy if exists pipeline_config_delete on pipeline_config;
create policy pipeline_config_delete on pipeline_config for delete using (false);
