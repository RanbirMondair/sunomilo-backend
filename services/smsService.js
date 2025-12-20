// SMS Service using Vonage Verify API
const { Vonage } = require('@vonage/server-sdk');

// Country codes mapping
const ALLOWED_COUNTRIES = {
  'DE': { code: '+49', name: 'Deutschland' },
  'AT': { code: '+43', name: 'Österreich' },
  'CH': { code: '+41', name: 'Schweiz' }
};

class SMSService {
  constructor() {
    // Initialize Vonage client
    this.vonage = new Vonage({
      apiKey: process.env.VONAGE_API_KEY,
      apiSecret: process.env.VONAGE_API_SECRET
    });
    
    console.log('✅ Vonage SMS Service initialized');
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
   * Send SMS verification code using Vonage Verify
   */
  async sendVerificationSMS(phoneNumber, countryCode) {
    try {
      // Validate and format phone number
      const fullPhoneNumber = this.formatPhoneNumber(phoneNumber, countryCode);

      console.log(`Sending verification to ${fullPhoneNumber} via Vonage Verify`);

      // Send verification request via Vonage Verify API v2
      const response = await this.vonage.verify.start({
        number: fullPhoneNumber,
        brand: 'SunoMilo',
        code_length: 6,
        workflow_id: 1 // SMS only
      });

      console.log(`✅ Verification sent! Request ID: ${response.request_id}, Status: ${response.status}`);
      
      return {
        success: true,
        requestId: response.request_id,
        status: response.status,
        phoneNumber: fullPhoneNumber
      };
    } catch (error) {
      console.error('❌ Vonage Verify sending failed:', error);
      console.error('Error details:', error.response?.data || error.message);
      throw new Error(`Failed to send SMS: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Verify the code sent to phone number
   */
  async verifyCode(phoneNumber, countryCode, code, requestId) {
    try {
      console.log(`Verifying code for request ID: ${requestId}`);

      // Check verification code via Vonage Verify API
      const response = await this.vonage.verify.check(requestId, code);

      console.log(`✅ Verification successful! Status: ${response.status}`);
      
      return {
        success: true,
        status: response.status,
        phoneNumber: this.formatPhoneNumber(phoneNumber, countryCode)
      };
    } catch (error) {
      console.error('❌ Vonage Verify check failed:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      return {
        success: false,
        errorText: error.message || 'Invalid verification code',
        status: error.response?.data?.status || 'error'
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
