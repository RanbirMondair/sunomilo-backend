const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Get all matches for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT m.id, m.matched_at, m.is_active,
        CASE 
          WHEN m.user1_id = $1 THEN m.user2_id
          ELSE m.user1_id
        END as matched_user_id,
        u.name, u.age, u.profile_image_url, u.bio
       FROM matches m
       JOIN users u ON (
         (m.user1_id = $1 AND u.id = m.user2_id) OR
         (m.user2_id = $1 AND u.id = m.user1_id)
       )
       WHERE (m.user1_id = $1 OR m.user2_id = $1) AND m.is_active = true
       ORDER BY m.matched_at DESC`,
      [req.userId]
    );

    res.json({
      success: true,
      matches: result.rows
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Get match details
router.get('/:matchId', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { matchId } = req.params;

    // Verify user is part of match
    const matchResult = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [matchId, req.userId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const match = matchResult.rows[0];
    const otherUserId = match.user1_id === req.userId ? match.user2_id : match.user1_id;

    // Get other user details
    const userResult = await pool.query(
      'SELECT id, name, age, bio, location, profile_image_url FROM users WHERE id = $1',
      [otherUserId]
    );

    res.json({
      success: true,
      match: {
        ...match,
        user: userResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

// Unmatch
router.delete('/:matchId', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { matchId } = req.params;

    // Verify user is part of match
    const matchResult = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [matchId, req.userId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Soft delete (mark as inactive)
    await pool.query(
      'UPDATE matches SET is_active = false WHERE id = $1',
      [matchId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Unmatch error:', error);
    res.status(500).json({ error: 'Failed to unmatch' });
  }
});

module.exports = router;
