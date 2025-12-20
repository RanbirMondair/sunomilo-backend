const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// Get discovery users (for swiping)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.userId;
    const { country, limit = 50 } = req.query;

    // Get current user's preferences
    const userPrefs = await pool.query(
      `SELECT looking_for, min_age, max_age, relationship_type, interests, max_distance, gender
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userPrefs.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const prefs = userPrefs.rows[0];

    // Build dynamic WHERE conditions
    let conditions = ['u.id != $1'];
    let params = [userId, limit];
    let paramIndex = 3;

    // Filter by country
    if (country) {
      conditions.push(`u.country = $${paramIndex}`);
      params.push(country);
      paramIndex++;
    }

    // Filter by gender preference (looking_for)
    if (prefs.looking_for && prefs.looking_for !== 'all') {
      conditions.push(`u.gender = $${paramIndex}`);
      params.push(prefs.looking_for);
      paramIndex++;
    }

    // Filter by age range
    if (prefs.min_age) {
      conditions.push(`u.age >= $${paramIndex}`);
      params.push(prefs.min_age);
      paramIndex++;
    }

    if (prefs.max_age) {
      conditions.push(`u.age <= $${paramIndex}`);
      params.push(prefs.max_age);
      paramIndex++;
    }

    // Filter by relationship type (if user has preference)
    if (prefs.relationship_type) {
      conditions.push(`(u.relationship_type = $${paramIndex} OR u.relationship_type IS NULL)`);
      params.push(prefs.relationship_type);
      paramIndex++;
    }

    // Filter: User must be looking for current user's gender (or 'all')
    if (prefs.gender) {
      conditions.push(`(u.looking_for = $${paramIndex} OR u.looking_for = 'all')`);
      params.push(prefs.gender);
      paramIndex++;
    }

    // Exclude users already liked/passed
    conditions.push('u.id NOT IN (SELECT liked_user_id FROM likes WHERE user_id = $1)');

    const whereClause = conditions.join(' AND ');

    // Get users that match all filters
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.age, u.gender, u.location, u.bio, 
              u.profile_image_url, u.interests, u.relationship_type
       FROM users u
       WHERE ${whereClause}
       ORDER BY (u.profile_image_url IS NOT NULL) DESC, RANDOM()
       LIMIT $2`,
      params
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({ error: 'Failed to load discovery users' });
  }
});

// Like a user
router.post('/like', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.userId;
    const { liked_user_id } = req.body;

    if (!liked_user_id) {
      return res.status(400).json({ error: 'liked_user_id is required' });
    }

    // Check if already liked
    const existing = await pool.query(
      'SELECT id FROM likes WHERE user_id = $1 AND liked_user_id = $2',
      [userId, liked_user_id]
    );

    if (existing.rows.length > 0) {
      return res.json({ success: true, message: 'Already liked', match: false });
    }

    // Insert like
    await pool.query(
      'INSERT INTO likes (user_id, liked_user_id) VALUES ($1, $2)',
      [userId, liked_user_id]
    );

    // Check for match (mutual like)
    const mutualLike = await pool.query(
      'SELECT id FROM likes WHERE user_id = $1 AND liked_user_id = $2',
      [liked_user_id, userId]
    );

    let match = false;
    if (mutualLike.rows.length > 0) {
      // Create match
      await pool.query(
        `INSERT INTO matches (user1_id, user2_id) 
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [Math.min(userId, liked_user_id), Math.max(userId, liked_user_id)]
      );
      match = true;
    }

    res.json({ 
      success: true, 
      message: match ? 'It\'s a match! 💕' : 'Like saved',
      match 
    });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to save like' });
  }
});

module.exports = router;
