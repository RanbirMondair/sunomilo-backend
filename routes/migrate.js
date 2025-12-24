const express = require('express');
const router = express.Router();

// Migration endpoint - add name column to users table
router.post('/add-name-column', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    if (!pool) {
      return res.status(500).json({
        success: false,
        error: 'Database pool not available'
      });
    }
    
    console.log('Starting migration: add name column');
    
    // Add name column
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)');
    console.log('✅ Name column added');
    
    // Populate name column from first_name and last_name
    const result = await pool.query(`
      UPDATE users 
      SET name = CONCAT(first_name, ' ', last_name)
      WHERE name IS NULL AND first_name IS NOT NULL AND last_name IS NOT NULL
    `);
    console.log(`✅ Updated ${result.rowCount} rows`);
    
    // Get sample data
    const users = await pool.query('SELECT id, first_name, last_name, name FROM users LIMIT 5');
    
    res.json({
      success: true,
      message: 'Migration completed successfully',
      rowsUpdated: result.rowCount,
      sampleUsers: users.rows
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Phase 1 Migration: Height, Religion, and Premium System
router.post('/phase1', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    if (!pool) {
      return res.status(500).json({
        success: false,
        error: 'Database pool not available'
      });
    }
    
    console.log('🔄 Starting Phase 1 Migration...');
    
    const results = [];
    
    // Add height and religion columns
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS height INT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS religion VARCHAR(50) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS min_height INT DEFAULT 140,
        ADD COLUMN IF NOT EXISTS max_height INT DEFAULT 220,
        ADD COLUMN IF NOT EXISTS religion_preference TEXT DEFAULT NULL
      `);
      results.push({ step: 'height_religion', status: 'success' });
      console.log('✅ Height and religion columns added');
    } catch (err) {
      results.push({ step: 'height_religion', status: 'error', error: err.message });
    }
    
    // Add premium subscription columns
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS subscription_type ENUM('free', 'premium') DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS subscription_start DATE DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS subscription_end DATE DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS daily_likes_used INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS daily_likes_reset_at TIMESTAMP DEFAULT NULL
      `);
      results.push({ step: 'premium_columns', status: 'success' });
      console.log('✅ Premium subscription columns added');
    } catch (err) {
      results.push({ step: 'premium_columns', status: 'error', error: err.message });
    }
    
    // Update existing users to have default values
    try {
      const updateResult = await pool.query(`
        UPDATE users SET 
          min_height = 140,
          max_height = 220,
          subscription_type = 'free',
          daily_likes_used = 0
        WHERE min_height IS NULL OR subscription_type IS NULL
      `);
      results.push({ step: 'update_defaults', status: 'success', rowsUpdated: updateResult.rowCount });
      console.log(`✅ Updated ${updateResult.rowCount} users with default values`);
    } catch (err) {
      results.push({ step: 'update_defaults', status: 'error', error: err.message });
    }
    
    // Verify columns
    const verifyResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('height', 'religion', 'min_height', 'max_height', 'religion_preference', 'subscription_type', 'daily_likes_used')
      ORDER BY column_name
    `);
    
    console.log('✅ Phase 1 Migration completed!');
    
    res.json({
      success: true,
      message: 'Phase 1 migration completed',
      results,
      newColumns: verifyResult.rows.map(r => r.column_name)
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
