const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// Sync profile_images array from profile_images table
router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.userId;

    // Get all images for this user from profile_images table
    const imagesResult = await pool.query(
      'SELECT image_url FROM profile_images WHERE user_id = $1 ORDER BY position',
      [userId]
    );

    const imageUrls = imagesResult.rows.map(row => row.image_url);

    // Update users table with array of image URLs
    await pool.query(
      'UPDATE users SET profile_images = $1 WHERE id = $2',
      [imageUrls, userId]
    );

    // Also update profile_image_url to first image for backwards compatibility
    if (imageUrls.length > 0) {
      await pool.query(
        'UPDATE users SET profile_image_url = $1 WHERE id = $2',
        [imageUrls[0], userId]
      );
    }

    res.json({
      success: true,
      message: 'Profile images synced',
      imageCount: imageUrls.length
    });
  } catch (error) {
    console.error('Sync images error:', error);
    res.status(500).json({ error: 'Failed to sync images' });
  }
});

module.exports = router;
