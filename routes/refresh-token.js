const express = require('express');
const { generateToken, authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Refresh token endpoint
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Get user from database
    const result = await pool.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const newToken = generateToken(user.id, user.email);

    res.json({
      success: true,
      token: newToken,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

module.exports = router;
