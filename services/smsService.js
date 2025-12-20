// SMS Service using Vonage SMS API with alphanumeric sender ID
const { Vonage } = require('@vonage/server-sdk');

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
    
    // Store verification codes in memory (in production, use Redis or database)
    this.verificationCodes = new Map();
    
    console.log('✅ Vonage SMS Service initialized with Sender ID:', SENDER_ID);
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
      const response = await this.vonage.sms.send({
        to: fullPhoneNumber,
        from: SENDER_ID, // Alphanumeric sender ID (mandatory for AT/DE/CH)
        text: `Your SunoMilo verification code is: ${verificationCode}\n\nThis code expires in 10 minutes.`
      });

      console.log('Vonage SMS response:', response);

      // Check if SMS was sent successfully
      if (response.messages && response.messages[0].status === '0') {
        // Store verification code with expiry (10 minutes)
        const requestId = response.messages[0]['message-id'];
        this.verificationCodes.set(fullPhoneNumber, {
          code: verificationCode,
          requestId: requestId,
          expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

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

      // Get stored verification code
      const storedData = this.verificationCodes.get(fullPhoneNumber);

      if (!storedData) {
        console.error('❌ No verification code found for this phone number');
        return {
          success: false,
          errorText: 'No verification code found. Please request a new code.',
          status: 'not_found'
        };
      }

      // Check if code has expired
      if (Date.now() > storedData.expiresAt) {
        this.verificationCodes.delete(fullPhoneNumber);
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

      // Code is valid - remove it from storage
      this.verificationCodes.delete(fullPhoneNumber);
      
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
}

// Export singleton instance
module.exports = new SMSService();
