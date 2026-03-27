-- Store the formatted transcript text so AI interviews can reference it
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS full_text text;
