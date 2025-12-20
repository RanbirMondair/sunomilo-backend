// SMS Service using Twilio Verify API
const twilio = require('twilio');

// Country codes mapping
const ALLOWED_COUNTRIES = {
  'DE': { code: '+49', name: 'Deutschland' },
  'AT': { code: '+43', name: 'Österreich' },
  'CH': { code: '+41', name: 'Schweiz' }
};

class SMSService {
  constructor() {
    // Initialize Twilio client
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
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
   * Send SMS verification code using Twilio Verify
   */
  async sendVerificationSMS(phoneNumber, countryCode) {
    try {
      // Validate and format phone number
      const fullPhoneNumber = this.formatPhoneNumber(phoneNumber, countryCode);

      console.log(`Sending verification to ${fullPhoneNumber} via Twilio Verify`);

      // Send verification code via Twilio Verify
      const verification = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verifications
        .create({
          to: fullPhoneNumber,
          channel: 'sms'
        });

      console.log(`Verification sent! Status: ${verification.status}, SID: ${verification.sid}`);

      return {
        success: true,
        status: verification.status,
        phoneNumber: fullPhoneNumber
      };
    } catch (error) {
      console.error('Twilio Verify sending failed:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Verify the code entered by user
   */
  async verifyCode(phoneNumber, countryCode, code) {
    try {
      // Format phone number
      const fullPhoneNumber = this.formatPhoneNumber(phoneNumber, countryCode);

      console.log(`Verifying code for ${fullPhoneNumber}`);

      // Verify code via Twilio Verify
      const verificationCheck = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks
        .create({
          to: fullPhoneNumber,
          code: code
        });

      console.log(`Verification check status: ${verificationCheck.status}`);

      return {
        success: verificationCheck.status === 'approved',
        status: verificationCheck.status
      };
    } catch (error) {
      console.error('Twilio Verify check failed:', error);
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
