// SMS Service for Twilio Integration
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
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
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
   * Generate 6-digit verification code
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send SMS with verification code
   */
  async sendVerificationSMS(phoneNumber, countryCode, verificationCode) {
    try {
      // Validate phone number
      const cleanPhone = this.validatePhoneNumber(phoneNumber, countryCode);
      
      // Format phone number with country code
      const fullPhoneNumber = ALLOWED_COUNTRIES[countryCode].code + cleanPhone;

      // Create message
      const message = `Dein SunoMilo Verifikationscode: ${verificationCode}\n\nDieser Code ist 10 Minuten gültig.`;

      // Send SMS via Twilio
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: fullPhoneNumber
      });

      console.log(`SMS sent to ${fullPhoneNumber}, SID: ${result.sid}`);

      return {
        success: true,
        messageSid: result.sid,
        phoneNumber: fullPhoneNumber
      };
    } catch (error) {
      console.error('SMS sending failed:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Format phone number for storage
   */
  formatPhoneNumber(phoneNumber, countryCode) {
    const cleanPhone = this.validatePhoneNumber(phoneNumber, countryCode);
    return ALLOWED_COUNTRIES[countryCode].code + cleanPhone;
  }

  /**
   * Get allowed countries
   */
  getAllowedCountries() {
    return ALLOWED_COUNTRIES;
  }
}

module.exports = new SMSService();
