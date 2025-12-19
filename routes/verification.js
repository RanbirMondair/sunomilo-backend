// Verification Routes for SMS Verification
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const smsService = require('../services/smsService');
const auth = require('../middleware/auth');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/verification/send-code
 * Send verification code to phone number
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

    // Generate verification code
    const verificationCode = smsService.generateVerificationCode();

    // Delete old verification codes for this phone number
    await supabase
      .from('sms_verification_codes')
      .delete()
      .eq('phone_number', formattedPhone);

    // Store verification code in database
    const { data, error } = await supabase
      .from('sms_verification_codes')
      .insert([
        {
          phone_number: formattedPhone,
          country_code: countryCode,
          verification_code: verificationCode,
          attempts: 0,
          max_attempts: 3,
          is_verified: false
        }
      ])
      .select();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to store verification code' });
    }

    // Send SMS
    try {
      await smsService.sendVerificationSMS(phoneNumber, countryCode, verificationCode);
    } catch (smsError) {
      console.error('SMS error:', smsError);
      // Delete the verification code if SMS fails
      await supabase
        .from('sms_verification_codes')
        .delete()
        .eq('phone_number', formattedPhone);
      
      return res.status(500).json({
        error: 'Failed to send SMS. Please try again.'
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent to your phone',
      phoneNumber: formattedPhone
    });
  } catch (error) {
    console.error('Error in send-code:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/verification/verify-code
 * Verify the code sent to phone number
 */
router.post('/verify-code', async (req, res) => {
  try {
    const { phoneNumber, verificationCode } = req.body;

    // Validate input
    if (!phoneNumber || !verificationCode) {
      return res.status(400).json({
        error: 'Phone number and verification code are required'
      });
    }

    // Get verification record
    const { data: verificationRecord, error: fetchError } = await supabase
      .from('sms_verification_codes')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !verificationRecord) {
      return res.status(400).json({
        error: 'No verification code found for this phone number'
      });
    }

    // Check if code has expired
    const expiresAt = new Date(verificationRecord.expires_at);
    if (new Date() > expiresAt) {
      return res.status(400).json({
        error: 'Verification code has expired'
      });
    }

    // Check attempt limit
    if (verificationRecord.attempts >= verificationRecord.max_attempts) {
      return res.status(400).json({
        error: 'Too many failed attempts. Please request a new code.'
      });
    }

    // Verify code
    if (verificationRecord.verification_code !== verificationCode) {
      // Increment attempts
      await supabase
        .from('sms_verification_codes')
        .update({ attempts: verificationRecord.attempts + 1 })
        .eq('id', verificationRecord.id);

      return res.status(400).json({
        error: 'Invalid verification code',
        attemptsRemaining: verificationRecord.max_attempts - verificationRecord.attempts - 1
      });
    }

    // Mark as verified
    const { error: updateError } = await supabase
      .from('sms_verification_codes')
      .update({ is_verified: true })
      .eq('id', verificationRecord.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Failed to verify code' });
    }

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      phoneNumber: phoneNumber,
      countryCode: verificationRecord.country_code
    });
  } catch (error) {
    console.error('Error in verify-code:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/verification/resend-code
 * Resend verification code
 */
router.post('/resend-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Get the last verification record
    const { data: verificationRecord } = await supabase
      .from('sms_verification_codes')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!verificationRecord) {
      return res.status(400).json({
        error: 'No verification request found for this phone number'
      });
    }

    // Generate new code
    const newCode = smsService.generateVerificationCode();

    // Update with new code
    const { error: updateError } = await supabase
      .from('sms_verification_codes')
      .update({
        verification_code: newCode,
        attempts: 0,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      })
      .eq('id', verificationRecord.id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to resend code' });
    }

    // Send SMS
    try {
      await smsService.sendVerificationSMS(
        phoneNumber.replace(verificationRecord.country_code === 'DE' ? '+49' : 
                           verificationRecord.country_code === 'AT' ? '+43' : '+41', ''),
        verificationRecord.country_code,
        newCode
      );
    } catch (smsError) {
      console.error('SMS error:', smsError);
      return res.status(500).json({ error: 'Failed to send SMS' });
    }

    res.json({
      success: true,
      message: 'New verification code sent to your phone'
    });
  } catch (error) {
    console.error('Error in resend-code:', error);
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
