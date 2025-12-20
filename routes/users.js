const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const result = await pool.query(
      'SELECT id, email, phone, name, age, gender, country, bio, profile_image_url, location, interests, looking_for, min_age, max_age, relationship_type, max_distance, is_premium, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Get extended profile
    const profileResult = await pool.query(
      'SELECT * FROM profiles WHERE user_id = $1',
      [req.userId]
    );

    // Get profile images
    const imagesResult = await pool.query(
      'SELECT image_url FROM profile_images WHERE user_id = $1 ORDER BY position',
      [req.userId]
    );

    res.json({
      success: true,
      user: {
        ...user,
        profile: profileResult.rows[0] || null,
        images: imagesResult.rows.map(r => r.image_url)
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { name, age, gender, bio, location, interests, looking_for, min_age, max_age, relationship_type, max_distance } = req.body;

    const result = await pool.query(
      'UPDATE users SET name = $1, age = $2, gender = $3, bio = $4, location = $5, interests = $6, looking_for = $7, min_age = $8, max_age = $9, relationship_type = $10, max_distance = $11, updated_at = NOW() WHERE id = $12 RETURNING *',
      [name, age, gender, bio, location, interests, looking_for, min_age, max_age, relationship_type, max_distance, req.userId]
    );

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get user by ID (for viewing profiles)
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { userId } = req.params;

    // Check if user is blocked
    const blockedResult = await pool.query(
      'SELECT id FROM blocks WHERE (user_id = $1 AND blocked_user_id = $2) OR (user_id = $2 AND blocked_user_id = $1)',
      [req.userId, userId]
    );

    if (blockedResult.rows.length > 0) {
      return res.status(403).json({ error: 'User is blocked' });
    }

    const result = await pool.query(
      'SELECT id, name, age, gender, bio, location, interests, looking_for, profile_image_url FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get extended profile
    const profileResult = await pool.query(
      'SELECT * FROM profiles WHERE user_id = $1',
      [userId]
    );

    // Get profile images
    const imagesResult = await pool.query(
      'SELECT image_url FROM profile_images WHERE user_id = $1 ORDER BY position',
      [userId]
    );

    res.json({
      success: true,
      user: {
        ...result.rows[0],
        profile: profileResult.rows[0] || null,
        images: imagesResult.rows.map(r => r.image_url)
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get discover feed (users to swipe)
router.get('/discover/feed', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { limit = 10, offset = 0 } = req.query;

    // Get current user's gender and looking_for preference
    const currentUserResult = await pool.query(
      'SELECT gender, looking_for, country FROM users WHERE id = $1',
      [req.userId]
    );

    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = currentUserResult.rows[0];

    // Get users that match preferences
    const result = await pool.query(
      `SELECT u.id, u.name, u.age, u.gender, u.bio, u.location, u.profile_image_url, u.interests
       FROM users u
       WHERE u.id != $1
       AND u.gender IN (SELECT UNNEST(string_to_array($2, ',')))
       AND u.country = $3
       AND u.id NOT IN (
         SELECT liked_user_id FROM likes WHERE user_id = $1
       )
       AND u.id NOT IN (
         SELECT blocked_user_id FROM blocks WHERE user_id = $1
       )
       ORDER BY u.created_at DESC
       LIMIT $4 OFFSET $5`,
      [req.userId, currentUser.looking_for, currentUser.country, limit, offset]
    );

    // Get images for each user
    const users = await Promise.all(result.rows.map(async (user) => {
      const imagesResult = await pool.query(
        'SELECT image_url FROM profile_images WHERE user_id = $1 ORDER BY position LIMIT 5',
        [user.id]
      );
      return {
        ...user,
        images: imagesResult.rows.map(r => r.image_url)
      };
    }));

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get discover feed error:', error);
    res.status(500).json({ error: 'Failed to fetch discover feed' });
  }
});

module.exports = router;
