// Verification Routes using Twilio Verify API
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const smsService = require('../services/smsService');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/verification/send-code
 * Send verification code to phone number using Twilio Verify
 */
router.post('/send-code', async (req, res) => {
  try {
    const { phoneNumber, countryCode } = req.body;

    // Validate input
    if (!phoneNumber || !countryCode) {
      return res.status(400).json({
        error: 'Phone number and country code are required'
      });
    }

    // Validate phone number and country
    try {
      smsService.validatePhoneNumber(phoneNumber, countryCode);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    // Format phone number
    const formattedPhone = smsService.formatPhoneNumber(phoneNumber, countryCode);

    // Check if phone number is already registered
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', formattedPhone)
      .single();

    if (existingUser) {
      return res.status(400).json({
        error: 'This phone number is already registered'
      });
    }

    // Send SMS via Twilio Verify (no need to store code - Twilio handles it!)
    try {
      const result = await smsService.sendVerificationSMS(phoneNumber, countryCode);
      
      res.json({
        success: true,
        message: 'Verification code sent to your phone',
        phoneNumber: formattedPhone,
        status: result.status
      });
    } catch (smsError) {
      console.error('SMS error:', smsError);
      return res.status(500).json({
        error: 'Failed to send SMS. Please try again.'
      });
    }
  } catch (error) {
    console.error('Error in send-code:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/verification/verify-code
 * Verify the code sent to phone number using Twilio Verify
 */
router.post('/verify-code', async (req, res) => {
  try {
    const { phoneNumber, countryCode, verificationCode } = req.body;

    // Validate input
    if (!phoneNumber || !verificationCode || !countryCode) {
      return res.status(400).json({
        error: 'Phone number, country code, and verification code are required'
      });
    }

    // Verify code via Twilio Verify
    try {
      const result = await smsService.verifyCode(phoneNumber, countryCode, verificationCode);
      
      if (result.success) {
        // Format phone number for storage
        const formattedPhone = smsService.formatPhoneNumber(phoneNumber, countryCode);
        
        res.json({
          success: true,
          message: 'Phone number verified successfully',
          phoneNumber: formattedPhone,
          countryCode: countryCode
        });
      } else {
        res.status(400).json({
          error: 'Invalid verification code',
          status: result.status
        });
      }
    } catch (verifyError) {
      console.error('Verification error:', verifyError);
      return res.status(400).json({
        error: 'Invalid or expired verification code'
      });
    }
  } catch (error) {
    console.error('Error in verify-code:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/verification/allowed-countries
 * Get list of allowed countries
 */
router.get('/allowed-countries', (req, res) => {
  try {
    const countries = smsService.getAllowedCountries();
    res.json({
      success: true,
      countries: countries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
