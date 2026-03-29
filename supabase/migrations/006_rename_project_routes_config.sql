-- Rename config key from jira-specific to agnostic
UPDATE pipeline_config SET key = 'project_routes' WHERE key = 'jira_project_routes';

-- Seed if it doesn't exist yet
INSERT INTO pipeline_config (key, value)
VALUES ('project_routes', '[]')
ON CONFLICT (key) DO NOTHING;
