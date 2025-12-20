const express = require('express');
const router = express.Router();
const pool = require('../db');

// Migration endpoint - add name column to users table
router.post('/add-name-column', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Starting migration: add name column');
    
    // Add name column
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)');
    console.log('✅ Name column added');
    
    // Populate name column from first_name and last_name
    const result = await client.query(`
      UPDATE users 
      SET name = CONCAT(first_name, ' ', last_name)
      WHERE name IS NULL AND first_name IS NOT NULL AND last_name IS NOT NULL
    `);
    console.log(`✅ Updated ${result.rowCount} rows`);
    
    // Get sample data
    const users = await client.query('SELECT id, first_name, last_name, name FROM users LIMIT 5');
    
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
  } finally {
    client.release();
  }
});

module.exports = router;
