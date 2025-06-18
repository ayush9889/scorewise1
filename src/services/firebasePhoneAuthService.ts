import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  PhoneAuthProvider,
  signInWithCredential,
  linkWithCredential,
  updatePhoneNumber
} from 'firebase/auth';
import { auth, app } from '../config/firebase';
import { User } from '../types/auth';

interface PhoneVerificationResult {
  success: boolean;
  status: string;
  message: string;
  confirmationResult?: ConfirmationResult;
}

interface PhoneVerificationCheckResult {
  success: boolean;
  status: string;
  valid: boolean;
  message: string;
  user?: any;
}

class FirebasePhoneAuthService {
  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private currentConfirmationResult: ConfirmationResult | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeService();
  }

  private initializeService() {
    if (!auth) {
      console.warn('⚠️ Firebase Auth not available for phone authentication');
      return;
    }
    this.isInitialized = true;
    console.log('✅ Firebase Phone Auth service initialized');
  }

  // Initialize reCAPTCHA verifier
  private async initializeRecaptcha(containerId: string = 'recaptcha-container'): Promise<void> {
    if (!auth) {
      throw new Error('Firebase Auth not available');
    }

    try {
      // Clear existing reCAPTCHA if any
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
      }

      // Ensure the container exists
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = 'position: fixed; top: -1000px; left: -1000px; visibility: hidden;';
        document.body.appendChild(container);
      }

      this.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: (response: string) => {
          console.log('✅ reCAPTCHA solved');
        },
        'expired-callback': () => {
          console.warn('⚠️ reCAPTCHA expired');
        }
      });

      await this.recaptchaVerifier.render();
      console.log('✅ reCAPTCHA verifier initialized');
    } catch (error) {
      console.error('❌ Failed to initialize reCAPTCHA:', error);
      throw new Error('Failed to initialize phone verification. Please refresh the page and try again.');
    }
  }

  // Format phone number to E.164 format
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let formatted = phoneNumber.replace(/[^\d+]/g, '');
    
    // Add + if not present
    if (!formatted.startsWith('+')) {
      // Assume US number if no country code
      if (formatted.length === 10) {
        formatted = '+1' + formatted;
      } else {
        formatted = '+' + formatted;
      }
    }
    
    return formatted;
  }

  // Validate phone number format
  validatePhoneNumber(phoneNumber: string): boolean {
    const formatted = this.formatPhoneNumber(phoneNumber);
    // Basic E.164 validation: starts with +, followed by 1-15 digits
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(formatted);
  }

  // Send OTP using Firebase Phone Auth
  async sendOTP(phoneNumber: string): Promise<PhoneVerificationResult> {
    if (!this.isInitialized || !auth) {
      throw new Error('Firebase Phone Auth service not configured. Please check your Firebase setup.');
    }

    try {
      console.log(`📱 Sending OTP to ${phoneNumber} via Firebase`);

      // Validate phone number format
      if (!this.validatePhoneNumber(phoneNumber)) {
        return {
          success: false,
          status: 'invalid_parameter',
          message: 'Invalid phone number format. Please enter a valid phone number with country code (e.g., +1234567890).'
        };
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      // Initialize reCAPTCHA
      await this.initializeRecaptcha();

      if (!this.recaptchaVerifier) {
        throw new Error('Failed to initialize reCAPTCHA');
      }

      // Send OTP
      this.currentConfirmationResult = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        this.recaptchaVerifier
      );

      console.log('✅ OTP sent successfully via Firebase');
      return {
        success: true,
        status: 'sent',
        message: `OTP sent successfully to ${phoneNumber}`,
        confirmationResult: this.currentConfirmationResult
      };

    } catch (error: any) {
      console.error('❌ Firebase OTP send error:', error);
      
      // Clear reCAPTCHA on error
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
        this.recaptchaVerifier = null;
      }

      // Provide specific error messages based on Firebase error codes
      let userMessage = 'Failed to send OTP';
      
      if (error.code === 'auth/invalid-phone-number') {
        userMessage = 'Invalid phone number format. Please enter a valid phone number with country code.';
      } else if (error.code === 'auth/too-many-requests') {
        userMessage = 'Too many SMS requests. Please wait a few minutes before trying again.';
      } else if (error.code === 'auth/quota-exceeded') {
        userMessage = 'SMS quota exceeded. Please try again later.';
      } else if (error.code === 'auth/captcha-check-failed') {
        userMessage = 'reCAPTCHA verification failed. Please refresh the page and try again.';
      } else if (error.code === 'auth/web-storage-unsupported') {
        userMessage = 'Web storage is not supported. Please enable cookies and try again.';
      } else if (error.message) {
        userMessage = error.message;
      }

      return {
        success: false,
        status: 'error',
        message: userMessage
      };
    }
  }

  // Verify OTP using Firebase Phone Auth
  async verifyOTP(phoneNumber: string, code: string): Promise<PhoneVerificationCheckResult> {
    if (!this.isInitialized || !auth) {
      throw new Error('Firebase Phone Auth service not configured.');
    }

    if (!this.currentConfirmationResult) {
      return {
        success: false,
        status: 'error',
        valid: false,
        message: 'No verification in progress. Please request a new OTP.'
      };
    }

    try {
      console.log(`🔐 Verifying OTP for ${phoneNumber} via Firebase`);

      // Confirm the code
      const result = await this.currentConfirmationResult.confirm(code);
      const user = result.user;

      console.log('✅ OTP verified successfully via Firebase');

      // Clear the confirmation result
      this.currentConfirmationResult = null;

      return {
        success: true,
        status: 'approved',
        valid: true,
        message: 'Phone number verified successfully',
        user: user
      };

    } catch (error: any) {
      console.error('❌ Firebase OTP verification error:', error);

      let userMessage = 'Invalid or expired OTP';
      
      if (error.code === 'auth/invalid-verification-code') {
        userMessage = 'Invalid verification code. Please check the code and try again.';
      } else if (error.code === 'auth/code-expired') {
        userMessage = 'Verification code has expired. Please request a new code.';
      } else if (error.code === 'auth/too-many-requests') {
        userMessage = 'Too many verification attempts. Please wait before trying again.';
      } else if (error.message) {
        userMessage = error.message;
      }

      return {
        success: false,
        status: 'failed',
        valid: false,
        message: userMessage
      };
    }
  }

  // Link phone number to existing user
  async linkPhoneNumber(phoneNumber: string, code: string): Promise<PhoneVerificationCheckResult> {
    if (!auth?.currentUser) {
      return {
        success: false,
        status: 'error',
        valid: false,
        message: 'No user is currently signed in.'
      };
    }

    if (!this.currentConfirmationResult) {
      return {
        success: false,
        status: 'error',
        valid: false,
        message: 'No verification in progress. Please request a new OTP.'
      };
    }

    try {
      // Get credential from confirmation result
      const credential = PhoneAuthProvider.credentialFromResult(this.currentConfirmationResult);
      if (!credential) {
        throw new Error('Failed to get phone credential');
      }

      // Link the phone number to the current user
      const result = await linkWithCredential(auth.currentUser, credential);

      console.log('✅ Phone number linked successfully');
      this.currentConfirmationResult = null;

      return {
        success: true,
        status: 'linked',
        valid: true,
        message: 'Phone number linked successfully',
        user: result.user
      };

    } catch (error: any) {
      console.error('❌ Phone linking error:', error);

      let userMessage = 'Failed to link phone number';
      
      if (error.code === 'auth/credential-already-in-use') {
        userMessage = 'This phone number is already associated with another account.';
      } else if (error.code === 'auth/invalid-verification-code') {
        userMessage = 'Invalid verification code.';
      } else if (error.message) {
        userMessage = error.message;
      }

      return {
        success: false,
        status: 'error',
        valid: false,
        message: userMessage
      };
    }
  }

  // Check if Firebase Phone Auth is configured and available
  isConfigured(): boolean {
    return this.isInitialized && !!auth;
  }

  // Clean up resources
  cleanup(): void {
    if (this.recaptchaVerifier) {
      this.recaptchaVerifier.clear();
      this.recaptchaVerifier = null;
    }
    this.currentConfirmationResult = null;
  }

  // Reset verification state (useful for retrying)
  reset(): void {
    this.cleanup();
    console.log('🔄 Firebase Phone Auth state reset');
  }
}

export const firebasePhoneAuthService = new FirebasePhoneAuthService(); 