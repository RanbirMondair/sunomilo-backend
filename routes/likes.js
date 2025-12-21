const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Like or dislike a user
router.post('/:userId', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;
    const { is_like = true } = req.body;

    if (parseInt(userId) === req.userId) {
      return res.status(400).json({ error: 'Cannot like yourself' });
    }

    // Check if user exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert or update like
    const result = await pool.query(
      `INSERT INTO likes (user_id, liked_user_id, is_like) 
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, liked_user_id) 
       DO UPDATE SET is_like = $3
       RETURNING *`,
      [req.userId, userId, is_like]
    );

    // Check for mutual like (match)
    if (is_like) {
      const mutualLike = await pool.query(
        'SELECT id FROM likes WHERE user_id = $1 AND liked_user_id = $2 AND is_like = true',
        [userId, req.userId]
      );

      if (mutualLike.rows.length > 0) {
        // Create match
        const matchResult = await pool.query(
          `INSERT INTO matches (user1_id, user2_id) 
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [Math.min(req.userId, userId), Math.max(req.userId, userId)]
        );

        if (matchResult.rows.length > 0) {
          return res.json({
            success: true,
            like: result.rows[0],
            matched: true,
            match: matchResult.rows[0]
          });
        }
      }
    }

    res.json({
      success: true,
      like: result.rows[0],
      matched: false
    });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to process like' });
  }
});

// Get likes received
router.get('/received', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT u.id, u.name, u.age, u.profile_image_url, u.bio
       FROM likes l
       JOIN users u ON l.user_id = u.id
       WHERE l.liked_user_id = $1 AND l.is_like = true
       ORDER BY l.created_at DESC`,
      [req.userId]
    );

    res.json({
      success: true,
      likes: result.rows
    });
  } catch (error) {
    console.error('Get likes error:', error);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

// Get likes sent
router.get('/sent', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT u.id, u.name, u.age, u.profile_image_url, u.bio
       FROM likes l
       JOIN users u ON l.liked_user_id = u.id
       WHERE l.user_id = $1 AND l.is_like = true
       ORDER BY l.created_at DESC`,
      [req.userId]
    );

    res.json({
      success: true,
      likes: result.rows
    });
  } catch (error) {
    console.error('Get sent likes error:', error);
    res.status(500).json({ error: 'Failed to fetch sent likes' });
  }
});

// Reset all likes for current user (for testing)
router.delete('/reset', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      'DELETE FROM likes WHERE user_id = $1 OR liked_user_id = $1',
      [req.userId]
    );

    res.json({
      success: true,
      message: `Deleted ${result.rowCount} likes`,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Reset likes error:', error);
    res.status(500).json({ error: 'Failed to reset likes' });
  }
});

module.exports = router;
