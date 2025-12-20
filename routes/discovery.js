const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Get discovery users (for swiping)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.userId;
    const { country, limit = 50 } = req.query;

    // Get users that:
    // 1. Are not the current user
    // 2. Have not been liked/passed by current user
    // 3. Match country filter (if provided)
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.age, u.gender, u.location, u.bio, u.profile_image_url
       FROM users u
       WHERE u.id != $1
       AND u.id NOT IN (
         SELECT liked_user_id FROM likes WHERE user_id = $1
       )
       ${country ? 'AND u.country = $3' : ''}
       ORDER BY RANDOM()
       LIMIT $2`,
      country ? [userId, limit, country] : [userId, limit]
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
