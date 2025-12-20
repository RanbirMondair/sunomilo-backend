-- Add name column to users table and populate from first_name and last_name

-- Add the name column
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Populate name column from existing first_name and last_name
UPDATE users 
SET name = CONCAT(first_name, ' ', last_name)
WHERE name IS NULL AND first_name IS NOT NULL AND last_name IS NOT NULL;

-- For users with only first_name
UPDATE users 
SET name = first_name
WHERE name IS NULL AND first_name IS NOT NULL AND last_name IS NULL;

-- For users with only last_name
UPDATE users 
SET name = last_name
WHERE name IS NULL AND first_name IS NULL AND last_name IS NOT NULL;
