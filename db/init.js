// Database initialization script
const { Pool } = require('pg');

async function initializeDatabase() {
  // Check if DATABASE_URL is provided
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  No DATABASE_URL provided, skipping database initialization');
    return null;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Create verification_codes table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        code VARCHAR(6) NOT NULL,
        request_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );
    `);

    // Create index on phone_number for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_phone_number ON verification_codes(phone_number);
    `);

    // Create index on expires_at for cleanup
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_expires_at ON verification_codes(expires_at);
    `);

    console.log('✅ Database tables initialized successfully');
    
    return pool;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

module.exports = { initializeDatabase };
