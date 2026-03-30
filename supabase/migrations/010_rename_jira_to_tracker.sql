-- Rename Jira-specific column names to generic tracker names
ALTER TABLE extracted_tasks RENAME COLUMN jira_issue_key TO tracker_issue_key;
ALTER TABLE extracted_tasks RENAME COLUMN jira_error TO tracker_error;
ALTER TABLE extracted_tasks RENAME COLUMN jira_project TO tracker_project;
