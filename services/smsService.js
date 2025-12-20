// SMS Service using Vonage SMS API with alphanumeric sender ID and PostgreSQL storage
const { Vonage } = require('@vonage/server-sdk');
const { Pool } = require('pg');

// Country codes mapping
const ALLOWED_COUNTRIES = {
  'DE': { code: '+49', name: 'Deutschland' },
  'AT': { code: '+43', name: 'Österreich' },
  'CH': { code: '+41', name: 'Schweiz' }
};

// Alphanumeric Sender ID (mandatory for AT/DE/CH)
const SENDER_ID = 'SunoMilo';

class SMSService {
  constructor() {
    // Initialize Vonage client
    this.vonage = new Vonage({
      apiKey: process.env.VONAGE_API_KEY,
      apiSecret: process.env.VONAGE_API_SECRET
    });
    
    // Initialize PostgreSQL connection pool
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      console.log('✅ Vonage SMS Service initialized with Sender ID:', SENDER_ID);
      console.log('✅ PostgreSQL connection pool initialized');
    } else {
      console.warn('⚠️  No DATABASE_URL provided, verification will not work!');
    }
  }

  /**
   * Generate a random 6-digit verification code
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Validate phone number and country
   */
  validatePhoneNumber(phoneNumber, countryCode) {
    // Check if country is allowed
    if (!ALLOWED_COUNTRIES[countryCode]) {
      throw new Error(`Country ${countryCode} is not supported. Only DE, AT, CH allowed.`);
    }

    // Remove spaces and dashes
    const cleanPhone = phoneNumber.replace(/[\s\-]/g, '');

    // Check if phone number is valid (basic validation)
    if (!/^\d{6,15}$/.test(cleanPhone)) {
      throw new Error('Invalid phone number format');
    }

    return cleanPhone;
  }

  /**
   * Format phone number with country code
   */
  formatPhoneNumber(phoneNumber, countryCode) {
    const cleanPhone = this.validatePhoneNumber(phoneNumber, countryCode);
    return ALLOWED_COUNTRIES[countryCode].code + cleanPhone;
  }

  /**
   * Store verification code in database
   */
  async storeVerificationCode(phoneNumber, code, requestId) {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    try {
      // Delete any existing code for this phone number
      await this.pool.query(
        'DELETE FROM verification_codes WHERE phone_number = $1',
        [phoneNumber]
      );

      // Insert new verification code
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      
      await this.pool.query(
        `INSERT INTO verification_codes (phone_number, code, request_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [phoneNumber, code, requestId, expiresAt]
      );

      console.log(`✅ Verification code stored in database for ${phoneNumber}`);
    } catch (error) {
      console.error('❌ Failed to store verification code:', error);
      throw error;
    }
  }

  /**
   * Get verification code from database
   */
  async getVerificationCode(phoneNumber) {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.pool.query(
        `SELECT code, request_id, expires_at 
         FROM verification_codes 
         WHERE phone_number = $1`,
        [phoneNumber]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('❌ Failed to get verification code:', error);
      throw error;
    }
  }

  /**
   * Delete verification code from database
   */
  async deleteVerificationCode(phoneNumber) {
    if (!this.pool) {
      return;
    }

    try {
      await this.pool.query(
        'DELETE FROM verification_codes WHERE phone_number = $1',
        [phoneNumber]
      );
      console.log(`✅ Verification code deleted for ${phoneNumber}`);
    } catch (error) {
      console.error('❌ Failed to delete verification code:', error);
    }
  }

  /**
   * Send SMS verification code using Vonage SMS API with alphanumeric sender ID
   */
  async sendVerificationSMS(phoneNumber, countryCode) {
    try {
      // Validate and format phone number
      const fullPhoneNumber = this.formatPhoneNumber(phoneNumber, countryCode);

      // Generate verification code
      const verificationCode = this.generateVerificationCode();

      console.log(`Sending verification to ${fullPhoneNumber} via Vonage SMS API`);
      console.log(`Using alphanumeric Sender ID: ${SENDER_ID}`);

      // Send SMS via Vonage SMS API with alphanumeric sender ID
      const from = SENDER_ID;
      // Remove + prefix for Vonage API (it expects numbers without +)
      const to = fullPhoneNumber.replace(/^\+/, '');
      const text = `Your SunoMilo verification code is: ${verificationCode}\n\nThis code expires in 10 minutes.`;
      
      // Use the SMS client from vonage instance
      const response = await this.vonage.sms.send({ to, from, text });

      console.log('Vonage SMS response:', JSON.stringify(response, null, 2));
      if (response.messages && response.messages[0]) {
        console.log('First message:', JSON.stringify(response.messages[0], null, 2));
      }

      // Check if SMS was sent successfully
      if (response.messages && response.messages[0].status === '0') {
        const requestId = response.messages[0]['message-id'];
        
        // Store verification code in database
        await this.storeVerificationCode(fullPhoneNumber, verificationCode, requestId);

        console.log(`✅ SMS sent successfully! Message ID: ${requestId}`);
        
        return {
          success: true,
          requestId: requestId,
          status: 'sent',
          phoneNumber: fullPhoneNumber
        };
      } else {
        const errorText = response.messages[0]['error-text'] || 'Unknown error';
        console.error(`❌ SMS failed with status: ${response.messages[0].status}, error: ${errorText}`);
        throw new Error(`Failed to send SMS: ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Vonage SMS sending failed:', error);
      console.error('Error details:', error.response?.data || error.message);
      throw new Error(`Failed to send SMS: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Verify the code sent to phone number
   */
  async verifyCode(phoneNumber, countryCode, code, requestId) {
    try {
      const fullPhoneNumber = this.formatPhoneNumber(phoneNumber, countryCode);
      
      console.log(`Verifying code for phone: ${fullPhoneNumber}, request ID: ${requestId}`);

      // Get stored verification code from database
      const storedData = await this.getVerificationCode(fullPhoneNumber);

      if (!storedData) {
        console.error('❌ No verification code found for this phone number');
        return {
          success: false,
          errorText: 'No verification code found. Please request a new code.',
          status: 'not_found'
        };
      }

      // Check if code has expired
      if (new Date() > new Date(storedData.expires_at)) {
        await this.deleteVerificationCode(fullPhoneNumber);
        console.error('❌ Verification code expired');
        return {
          success: false,
          errorText: 'Verification code has expired. Please request a new code.',
          status: 'expired'
        };
      }

      // Check if code matches
      if (storedData.code !== code) {
        console.error('❌ Invalid verification code');
        return {
          success: false,
          errorText: 'Invalid verification code. Please try again.',
          status: 'invalid'
        };
      }

      // Code is valid - remove it from database
      await this.deleteVerificationCode(fullPhoneNumber);
      
      console.log(`✅ Verification successful for ${fullPhoneNumber}`);
      
      return {
        success: true,
        status: 'verified',
        phoneNumber: fullPhoneNumber
      };
    } catch (error) {
      console.error('❌ Verification check failed:', error);
      
      return {
        success: false,
        errorText: error.message || 'Verification failed',
        status: 'error'
      };
    }
  }

  /**
   * Get list of allowed countries
   */
  getAllowedCountries() {
    return Object.entries(ALLOWED_COUNTRIES).map(([code, data]) => ({
      code,
      name: data.name,
      dialCode: data.code
    }));
  }

  /**
   * Cleanup expired verification codes (should be called periodically)
   */
  async cleanupExpiredCodes() {
    if (!this.pool) {
      return;
    }

    try {
      const result = await this.pool.query(
        'DELETE FROM verification_codes WHERE expires_at < NOW()'
      );
      console.log(`🧹 Cleaned up ${result.rowCount} expired verification codes`);
    } catch (error) {
      console.error('❌ Failed to cleanup expired codes:', error);
    }
  }
}

// Export singleton instance
module.exports = new SMSService();
