const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Connected to database');
    
    // Add name column
    console.log('Adding name column...');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)');
    console.log('✅ Name column added');
    
    // Populate name column from first_name and last_name
    console.log('Populating name column...');
    const result = await client.query(`
      UPDATE users 
      SET name = CONCAT(first_name, ' ', last_name)
      WHERE name IS NULL AND first_name IS NOT NULL AND last_name IS NOT NULL
    `);
    console.log(`✅ Updated ${result.rowCount} rows`);
    
    // Check the result
    const users = await client.query('SELECT id, first_name, last_name, name FROM users LIMIT 5');
    console.log('\nSample users:');
    console.table(users.rows);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
