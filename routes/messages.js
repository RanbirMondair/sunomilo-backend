const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Send message
router.post('/:matchId', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { matchId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content required' });
    }

    // Verify user is part of match
    const matchResult = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [matchId, req.userId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Insert message
    const result = await pool.query(
      'INSERT INTO messages (match_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
      [matchId, req.userId, content]
    );

    // Emit via Socket.io
    const io = req.app.locals.io;
    io.to(`match_${matchId}`).emit('new_message', result.rows[0]);

    res.json({
      success: true,
      message: result.rows[0]
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages for a match
router.get('/:matchId', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { matchId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify user is part of match
    const matchResult = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [matchId, req.userId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get messages
    const result = await pool.query(
      `SELECT m.*, u.name, u.profile_image_url
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.match_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [matchId, limit, offset]
    );

    // Mark as read
    await pool.query(
      'UPDATE messages SET is_read = true WHERE match_id = $1 AND sender_id != $2',
      [matchId, req.userId]
    );

    res.json({
      success: true,
      messages: result.rows.reverse()
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get unread message count
router.get('/unread/count', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT COUNT(*) as unread_count
       FROM messages m
       WHERE m.match_id IN (
         SELECT id FROM matches WHERE user1_id = $1 OR user2_id = $1
       )
       AND m.sender_id != $1
       AND m.is_read = false`,
      [req.userId]
    );

    res.json({
      success: true,
      unread_count: parseInt(result.rows[0].unread_count)
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

module.exports = router;
