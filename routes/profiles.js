const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Get extended profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      'SELECT * FROM profiles WHERE user_id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      success: true,
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Create or update extended profile
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      height,
      religion,
      caste,
      education,
      occupation,
      income_range,
      marital_status,
      children,
      drinking,
      smoking,
      languages,
      family_values,
      looking_for_description
    } = req.body;

    // Check if profile exists
    const existingProfile = await pool.query(
      'SELECT id FROM profiles WHERE user_id = $1',
      [req.userId]
    );

    let result;
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      result = await pool.query(
        `UPDATE profiles SET 
          height = $1, religion = $2, caste = $3, education = $4, 
          occupation = $5, income_range = $6, marital_status = $7, 
          children = $8, drinking = $9, smoking = $10, languages = $11,
          family_values = $12, looking_for_description = $13, updated_at = NOW()
        WHERE user_id = $14 RETURNING *`,
        [
          height, religion, caste, education, occupation, income_range,
          marital_status, children, drinking, smoking, languages,
          family_values, looking_for_description, req.userId
        ]
      );
    } else {
      // Create new profile
      result = await pool.query(
        `INSERT INTO profiles (
          user_id, height, religion, caste, education, occupation, 
          income_range, marital_status, children, drinking, smoking, 
          languages, family_values, looking_for_description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          req.userId, height, religion, caste, education, occupation,
          income_range, marital_status, children, drinking, smoking,
          languages, family_values, looking_for_description
        ]
      );
    }

    res.json({
      success: true,
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload profile images
router.post('/images/upload', authMiddleware, upload.array('images', 5), async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedImages = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];

      // Upload to Cloudinary
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'sunomilo/profiles',
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      // Save to database
      const dbResult = await pool.query(
        'INSERT INTO profile_images (user_id, image_url, position) VALUES ($1, $2, $3) RETURNING *',
        [req.userId, uploadResult.secure_url, i]
      );

      uploadedImages.push(dbResult.rows[0]);
    }

    res.json({
      success: true,
      images: uploadedImages
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// Get profile images
router.get('/images', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      'SELECT * FROM profile_images WHERE user_id = $1 ORDER BY position',
      [req.userId]
    );

    res.json({
      success: true,
      images: result.rows
    });
  } catch (error) {
    console.error('Get images error:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Delete profile image
router.delete('/images/:imageId', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { imageId } = req.params;

    // Verify ownership
    const imageResult = await pool.query(
      'SELECT * FROM profile_images WHERE id = $1 AND user_id = $2',
      [imageId, req.userId]
    );

    if (imageResult.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete from Cloudinary
    const publicId = imageResult.rows[0].image_url.split('/').pop().split('.')[0];
    await cloudinary.uploader.destroy(`sunomilo/profiles/${publicId}`);

    // Delete from database
    await pool.query(
      'DELETE FROM profile_images WHERE id = $1',
      [imageId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;
