-- Allow 'n8n' as a transcript provider
ALTER TABLE transcripts DROP CONSTRAINT IF EXISTS transcripts_provider_check;
ALTER TABLE transcripts ADD CONSTRAINT transcripts_provider_check
  CHECK (provider IN ('google-meet', 'zoom', 'ms-teams', 'manual', 'n8n'));
