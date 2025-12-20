-- Add missing columns to users table for dating preferences
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS min_age INTEGER DEFAULT 18,
ADD COLUMN IF NOT EXISTS max_age INTEGER DEFAULT 99,
ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS max_distance INTEGER DEFAULT 100;
