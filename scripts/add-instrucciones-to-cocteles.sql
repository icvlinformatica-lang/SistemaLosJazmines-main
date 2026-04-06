-- Add instrucciones column to cocteles table if it doesn't exist
ALTER TABLE cocteles ADD COLUMN IF NOT EXISTS instrucciones TEXT;
