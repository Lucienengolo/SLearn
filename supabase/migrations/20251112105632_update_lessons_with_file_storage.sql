/*
  # Update Lessons Table for File Storage

  1. Changes
    - Add `video_file_url` column for uploaded video files
    - Add `pdf_notes_url` column for uploaded PDF notes
    - Add `file_upload_type` column to track if content is text/video/pdf
    - Keep existing columns for backward compatibility

  2. Important Notes
    - Files will be stored in Supabase Storage buckets
    - `video_url` remains for iframe embeds (YouTube, Vimeo)
    - `video_file_url` is for direct video uploads
    - Either `content`, `video_url`/`video_file_url`, or `pdf_notes_url` can be used
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lessons' AND column_name = 'video_file_url'
  ) THEN
    ALTER TABLE lessons ADD COLUMN video_file_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lessons' AND column_name = 'pdf_notes_url'
  ) THEN
    ALTER TABLE lessons ADD COLUMN pdf_notes_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lessons' AND column_name = 'file_upload_type'
  ) THEN
    ALTER TABLE lessons ADD COLUMN file_upload_type text CHECK (file_upload_type IN ('text', 'video', 'pdf', 'both'));
  END IF;
END $$;