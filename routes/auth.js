const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken, authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, phone, password, first_name, last_name, country } = req.body;
    const pool = req.app.locals.pool;

    // Validate input
    if (!email || !password || !first_name || !last_name || !country) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, phone, password_hash, first_name, last_name, country) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name',
      [email, phone || null, passwordHash, first_name, last_name, country]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        country: country
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = req.app.locals.pool;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, country FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        country: user.country
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.userId;

    const result = await pool.query(
      `SELECT id, email, first_name, last_name, country, location, bio, profile_image_url, profile_images,
              age, gender, looking_for, min_age, max_age, max_distance, relationship_type, interests,
              is_premium, latitude, longitude, current_latitude, current_longitude
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.userId;
    const { 
      first_name, last_name, bio, location, occupation, interests,
      age, gender, looking_for, min_age, max_age, max_distance, relationship_type
    } = req.body;

    // Update users table with all fields
    await pool.query(
      `UPDATE users SET 
        first_name = $1, 
        last_name = $2, 
        bio = $3, 
        location = $4, 
        age = $5,
        gender = $6,
        looking_for = $7,
        min_age = $8,
        max_age = $9,
        max_distance = $10,
        relationship_type = $11,
        interests = $12,
        updated_at = NOW() 
      WHERE id = $13`,
      [first_name, last_name, bio, location, age, gender, looking_for, 
       min_age, max_age, max_distance, relationship_type, interests, userId]
    );

    // Update or insert user_profiles
    await pool.query(
      `INSERT INTO user_profiles (user_id, occupation, interests) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO UPDATE SET occupation = $2, interests = $3`,
      [userId, occupation, interests]
    );

    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Verify token
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, is_premium FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Logout
router.post('/logout', authMiddleware, (req, res) => {
  // JWT is stateless, so logout is just a client-side operation
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
