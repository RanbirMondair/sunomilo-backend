const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getCoordinatesFromLocation } = require('../services/geocoding');

// Update current location (GPS coordinates)
router.post('/update-current', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.userId;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Update current location
    await pool.query(
      `UPDATE users 
       SET current_latitude = $1, current_longitude = $2, location_updated_at = NOW()
       WHERE id = $3`,
      [latitude, longitude, userId]
    );

    res.json({ 
      success: true, 
      message: 'Location updated successfully',
      latitude,
      longitude
    });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Update home location (from profile location string)
router.post('/update-home', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.userId;
    const { location } = req.body;

    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    // Get coordinates from location string
    const coords = await getCoordinatesFromLocation(location);

    if (!coords) {
      return res.status(400).json({ error: 'Could not geocode location' });
    }

    // Update home location coordinates
    await pool.query(
      `UPDATE users 
       SET latitude = $1, longitude = $2, location = $3
       WHERE id = $4`,
      [coords.latitude, coords.longitude, location, userId]
    );

    res.json({ 
      success: true, 
      message: 'Home location updated successfully',
      location,
      latitude: coords.latitude,
      longitude: coords.longitude
    });
  } catch (error) {
    console.error('Home location update error:', error);
    res.status(500).json({ error: 'Failed to update home location' });
  }
});

// Get current location status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.userId;

    const result = await pool.query(
      `SELECT location, latitude, longitude, 
              current_latitude, current_longitude, location_updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const hasCurrentLocation = user.current_latitude && user.current_longitude;
    const hasHomeLocation = user.latitude && user.longitude;

    res.json({
      homeLocation: user.location,
      hasHomeCoordinates: hasHomeLocation,
      hasCurrentLocation: hasCurrentLocation,
      locationUpdatedAt: user.location_updated_at,
      usingCurrentLocation: hasCurrentLocation
    });
  } catch (error) {
    console.error('Location status error:', error);
    res.status(500).json({ error: 'Failed to get location status' });
  }
});

module.exports = router;
