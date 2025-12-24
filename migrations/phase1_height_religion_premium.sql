-- PHASE 1: Height, Religion, and Basic Premium System
-- Date: 2025-12-24

-- Add height and religion to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS height INT DEFAULT NULL COMMENT 'Height in cm (140-220)',
ADD COLUMN IF NOT EXISTS religion VARCHAR(50) DEFAULT NULL COMMENT 'Religion: Hindu, Muslim, Sikh, Christian, Jain, Parsi, Buddhist, Jewish, No Religion, Spiritual, Other',
ADD COLUMN IF NOT EXISTS min_height INT DEFAULT 140 COMMENT 'Minimum height preference in cm',
ADD COLUMN IF NOT EXISTS max_height INT DEFAULT 220 COMMENT 'Maximum height preference in cm',
ADD COLUMN IF NOT EXISTS religion_preference TEXT DEFAULT NULL COMMENT 'JSON array of acceptable religions';

-- Add basic premium subscription fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_type ENUM('free', 'premium') DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_start DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subscription_end DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS daily_likes_used INT DEFAULT 0 COMMENT 'Likes used today (reset daily for FREE users)',
ADD COLUMN IF NOT EXISTS daily_likes_reset_at DATETIME DEFAULT NULL;

-- Update existing users to have default values
UPDATE users SET 
  min_height = 140,
  max_height = 220,
  subscription_type = 'free',
  daily_likes_used = 0
WHERE min_height IS NULL OR subscription_type IS NULL;
