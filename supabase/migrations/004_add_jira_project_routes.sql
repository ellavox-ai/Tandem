-- Seed the jira_project_routes config key
INSERT INTO pipeline_config (key, value)
VALUES ('jira_project_routes', '[]')
ON CONFLICT (key) DO NOTHING;

-- Persist routing decisions per task
ALTER TABLE extracted_tasks ADD COLUMN IF NOT EXISTS jira_project text;
