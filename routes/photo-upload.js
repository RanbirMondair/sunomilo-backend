const express = require('express');
const router = express.Router();
const multer = require('multer');
const authenticateToken = require('../middleware/auth');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Configure S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Upload photos
router.post('/upload-photos', authenticateToken, upload.array('photos', 6), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Get current photos
    const result = await pool.query(
      'SELECT profile_images FROM users WHERE id = $1',
      [userId]
    );

    let currentPhotos = [];
    try {
      currentPhotos = result.rows[0]?.profile_images || [];
      if (typeof currentPhotos === 'string') {
        currentPhotos = JSON.parse(currentPhotos);
      }
    } catch (e) {
      currentPhotos = [];
    }

    // Check total count
    if (currentPhotos.length + files.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 photos allowed' });
    }

    // Upload each file to S3
    const uploadedUrls = [];
    
    for (const file of files) {
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `profile-photos/${userId}/${uuidv4()}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME || 'sunomilo-uploads',
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read'
      });

      await s3Client.send(command);

      const photoUrl = `https://${process.env.S3_BUCKET_NAME || 'sunomilo-uploads'}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`;
      uploadedUrls.push(photoUrl);
    }

    // Update database
    const newPhotos = [...currentPhotos, ...uploadedUrls];
    
    await pool.query(
      'UPDATE users SET profile_images = $1 WHERE id = $2',
      [newPhotos, userId]
    );

    res.json({
      message: 'Photos uploaded successfully',
      profile_images: newPhotos
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// Delete photo
router.delete('/delete-photo', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;
    const { photoUrl } = req.body;

    if (!photoUrl) {
      return res.status(400).json({ error: 'Photo URL required' });
    }

    // Get current photos
    const result = await pool.query(
      'SELECT profile_images FROM users WHERE id = $1',
      [userId]
    );

    let currentPhotos = [];
    try {
      currentPhotos = result.rows[0]?.profile_images || [];
      if (typeof currentPhotos === 'string') {
        currentPhotos = JSON.parse(currentPhotos);
      }
    } catch (e) {
      currentPhotos = [];
    }

    // Remove photo from array
    const newPhotos = currentPhotos.filter(url => url !== photoUrl);

    // Delete from S3
    try {
      const urlParts = photoUrl.split('/');
      const fileName = urlParts.slice(-3).join('/'); // profile-photos/userId/filename

      const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME || 'sunomilo-uploads',
        Key: fileName
      });

      await s3Client.send(command);
    } catch (s3Error) {
      console.error('S3 delete error:', s3Error);
      // Continue even if S3 delete fails
    }

    // Update database
    await pool.query(
      'UPDATE users SET profile_images = $1 WHERE id = $2',
      [newPhotos, userId]
    );

    res.json({
      message: 'Photo deleted successfully',
      profile_images: newPhotos
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
