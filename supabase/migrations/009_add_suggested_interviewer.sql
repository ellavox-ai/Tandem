-- Add suggested_interviewer to extracted_tasks for interview routing
ALTER TABLE extracted_tasks
  ADD COLUMN IF NOT EXISTS suggested_interviewer jsonb;
