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

      // Send verification request via Vonage Verify API
      return new Promise((resolve, reject) => {
        this.vonage.verify.start({
          number: fullPhoneNumber,
          brand: 'SunoMilo',
          code_length: 6
        }, (err, result) => {
          if (err) {
            console.error('Vonage Verify error:', err);
            reject(new Error(`Failed to send SMS: ${err.message || err.error_text}`));
          } else {
            console.log(`Verification sent! Request ID: ${result.request_id}, Status: ${result.status}`);
            resolve({
              success: true,
              requestId: result.request_id,
              status: result.status,
              phoneNumber: fullPhoneNumber
            });
          }
        });
      });
    } catch (error) {
      console.error('Vonage Verify sending failed:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Verify the code entered by user
   */
  async verifyCode(phoneNumber, countryCode, code, requestId) {
    try {
      // Format phone number
      const fullPhoneNumber = this.formatPhoneNumber(phoneNumber, countryCode);

      console.log(`Verifying code for ${fullPhoneNumber}, Request ID: ${requestId}`);

      // Verify code via Vonage Verify API
      return new Promise((resolve, reject) => {
        this.vonage.verify.check({
          request_id: requestId,
          code: code
        }, (err, result) => {
          if (err) {
            console.error('Vonage Verify check error:', err);
            reject(new Error(`Failed to verify code: ${err.message || err.error_text}`));
          } else {
            console.log(`Verification check status: ${result.status}`);
            const isApproved = result.status === '0'; // Status 0 means success
            resolve({
              success: isApproved,
              status: result.status,
              errorText: result.error_text
            });
          }
        });
      });
    } catch (error) {
      console.error('Vonage Verify check failed:', error);
      throw new Error(`Failed to verify code: ${error.message}`);
    }
  }

  /**
   * Get allowed countries
   */
  getAllowedCountries() {
    return ALLOWED_COUNTRIES;
  }
}

module.exports = new SMSService();
