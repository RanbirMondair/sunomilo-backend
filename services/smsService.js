// SMS Service using Vonage REST API directly with alphanumeric sender ID and PostgreSQL storage
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
    // Store Vonage credentials
    this.apiKey = process.env.VONAGE_API_KEY;
    this.apiSecret = process.env.VONAGE_API_SECRET;
    
    if (!this.apiKey || !this.apiSecret) {
      console.error('❌ VONAGE_API_KEY or VONAGE_API_SECRET not set!');
    }
    
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
   * Format phone number with country code (E.164 format without +)
   */
  formatPhoneNumber(phoneNumber, countryCode) {
    const cleanPhone = this.validatePhoneNumber(phoneNumber, countryCode);
    // Return without + prefix (e.g., "436603174740")
    return ALLOWED_COUNTRIES[countryCode].code.replace('+', '') + cleanPhone;
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
   * Send SMS using Vonage REST API directly
   */
  async sendVerificationSMS(phoneNumber, countryCode) {
    try {
      // Validate and format phone number
      const fullPhoneNumber = this.formatPhoneNumber(phoneNumber, countryCode);

      // Generate verification code
      const verificationCode = this.generateVerificationCode();

      console.log(`Sending verification to ${fullPhoneNumber} via Vonage REST API`);
      console.log(`Using alphanumeric Sender ID: ${SENDER_ID}`);

      // Prepare SMS parameters
      const params = new URLSearchParams({
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        from: SENDER_ID,
        to: fullPhoneNumber,
        text: `Your SunoMilo verification code is: ${verificationCode}\n\nThis code expires in 10 minutes.`
      });

      // Send SMS via Vonage REST API
      const response = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const data = await response.json();
      
      console.log('Vonage API Response:', JSON.stringify(data, null, 2));

      // Check if SMS was sent successfully
      if (data.messages && data.messages[0]) {
        const message = data.messages[0];
        console.log('Message details:', JSON.stringify(message, null, 2));

        if (message.status === '0') {
          const requestId = message['message-id'];
          
          // Store verification code in database
          await this.storeVerificationCode('+' + fullPhoneNumber, verificationCode, requestId);

          console.log(`✅ SMS sent successfully! Message ID: ${requestId}`);
          
          return {
            success: true,
            requestId: requestId,
            status: 'sent',
            phoneNumber: '+' + fullPhoneNumber
          };
        } else {
          const errorText = message['error-text'] || 'Unknown error';
          const status = message.status;
          console.error(`❌ SMS failed with status ${status}: ${errorText}`);
          throw new Error(`Failed to send SMS (Status ${status}): ${errorText}`);
        }
      } else {
        console.error('❌ Invalid response from Vonage:', data);
        throw new Error('Invalid response from Vonage API');
      }
    } catch (error) {
      console.error('❌ Vonage SMS sending failed:', error);
      throw new Error(`Failed to send SMS: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Verify the code sent to phone number
   */
  async verifyCode(phoneNumber, countryCode, code, requestId) {
    try {
      const fullPhoneNumber = '+' + this.formatPhoneNumber(phoneNumber, countryCode);
      
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
