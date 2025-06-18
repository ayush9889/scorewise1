import React, { useState, useRef, useEffect } from 'react';
import { X, Mail, Lock, User, Phone, Eye, EyeOff, MessageSquare, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { authService } from '../services/authService';
import { firebaseAuthService } from '../services/firebaseAuthService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin'
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone' | 'google'>('google'); // Default to Google
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);


  if (!isOpen) return null;

  // Timer ref for cleanup
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  // Start cooldown timer for resend OTP
  const startResendCooldown = () => {
    // Clear any existing timer
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }
    
    setResendCooldown(30);
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('🚀 Starting Google Sign-In...');
      
      // Start sign-in process
      await firebaseAuthService.signInWithGoogle();
      
      console.log('✅ Google Sign-In successful, calling onSuccess...');
      
      // Immediate success callback
      onSuccess();
      
    } catch (err) {
      console.error('❌ Google Sign-In failed:', err);
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    setLoading(true);
    setError('');

    try {
      console.log('🚀 Starting Guest Mode...');
      
      // Create a guest user
      authService.signInAsGuest();
      
      console.log('✅ Guest Mode activated, calling onSuccess...');
      
      // Immediate success callback
      onSuccess();
      
    } catch (err) {
      console.error('❌ Guest Mode failed:', err);
      setError(err instanceof Error ? err.message : 'Guest mode failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log(`🚀 Starting ${mode} with email...`);
      
      if (mode === 'signup') {
        await authService.signUp(email, password, name, phone);
        console.log('✅ Email sign-up successful');
      } else {
        await authService.signIn(email, password);
        console.log('✅ Email sign-in successful');
      }
      
      // Immediate success callback
      onSuccess();
      
    } catch (err) {
      console.error(`❌ Email ${mode} failed:`, err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log(`🚀 Starting ${mode} with phone...`);
      
      if (mode === 'signup') {
        await authService.signUpWithPhone(phone, name);
        console.log('✅ Phone sign-up initiated');
      } else {
        const userExists = await authService.checkUserByPhone(phone);
        if (!userExists) {
          setError('No account found with this phone number. Please sign up first.');
          return;
        }
        console.log('✅ User found, proceeding with OTP');
      }
      
      // Send OTP
      await authService.sendOTP(phone);
      setOtpSent(true);
      setShowOtpStep(true);
      startResendCooldown();
      
      console.log('✅ OTP sent successfully');
      
    } catch (err) {
      console.error('❌ Phone auth failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send OTP';
        
      if (errorMessage.includes('reCAPTCHA') || errorMessage.includes('invalid-phone-number')) {
        setError(errorMessage + '\n\nTip: Make sure your phone number includes country code (e.g., +1234567890).');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🚀 Verifying OTP...');
      
      const isValid = await authService.verifyOTP(phone, otp);
      if (isValid) {
        await authService.signInWithPhone(phone);
        console.log('✅ OTP verification and sign-in successful');
        
        // Immediate success callback
        onSuccess();
        
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch (err) {
      console.error('❌ OTP verification failed:', err);
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    setError('');

    try {
      await authService.resendOTP(phone);
      setOtpSent(true);
      startResendCooldown();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resend OTP';
      
      if (errorMessage.includes('reCAPTCHA') || errorMessage.includes('invalid-phone-number')) {
        setError(errorMessage + '\n\nTip: Make sure your phone number includes country code (e.g., +1234567890).');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setShowOtpStep(false);
    setOtp('');
    setError('');
    setOtpSent(false);
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setPhone('');
    setOtp('');
    setError('');
    setShowOtpStep(false);
    setOtpSent(false);
    setResendCooldown(0);
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    resetForm();
  };

  const switchAuthMethod = (method: 'email' | 'phone' | 'google') => {
    setAuthMethod(method);
    resetForm();
  };

  const isUsingFirebasePhone = authService.isUsingFirebasePhone();
  const isFirebaseAvailable = firebaseAuthService.isAvailable();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              {showOtpStep && (
                <button
                  onClick={handleBackToPhone}
                  className="mr-3 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <h2 className="text-2xl font-bold text-gray-900">
                {showOtpStep ? 'Verify OTP' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
          {!showOtpStep && (
            <p className="text-sm text-gray-600 mt-2">
              {mode === 'signin' ? 'Welcome back!' : 'Join the cricket community'}
            </p>
          )}
        </div>

        {!showOtpStep ? (
          <div className="p-6">
            {/* Firebase Status Indicator */}
            {isFirebaseAvailable && (
              <div className="mb-4 p-3 rounded-lg border bg-blue-50 border-blue-200">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-800">
                    Google Sign-In Available
                  </span>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  Quick and secure authentication with your Google account
                </p>
              </div>
            )}

            {/* Firebase Phone Auth Status Indicator */}
            {authMethod === 'phone' && (
              <div className={`mb-4 p-3 rounded-lg border ${
                isUsingFirebasePhone 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-orange-50 border-orange-200'
              }`}>
                <div className="flex items-center">
                  {isUsingFirebasePhone ? (
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-orange-600 mr-2" />
                  )}
                  <span className={`text-sm font-medium ${
                    isUsingFirebasePhone ? 'text-green-800' : 'text-orange-800'
                  }`}>
                    {isUsingFirebasePhone 
                      ? 'Firebase SMS Verification Active' 
                      : 'Development Mode - Demo OTP'
                    }
                  </span>
                </div>
                {!isUsingFirebasePhone && (
                  <p className="text-xs text-orange-700 mt-1">
                    OTP will be shown in browser alert for testing
                  </p>
                )}
                {isUsingFirebasePhone && (
                  <p className="text-xs text-green-700 mt-1">
                    Real SMS will be sent via Firebase to your phone number
                  </p>
                )}
              </div>
            )}

            {/* Authentication Method Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
              {isFirebaseAvailable && (
                <button
                  onClick={() => switchAuthMethod('google')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    authMethod === 'google'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-4 h-4 inline mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
              )}
              <button
                onClick={() => switchAuthMethod('phone')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  authMethod === 'phone'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Phone className="w-4 h-4 inline mr-2" />
                Phone
              </button>
              <button
                onClick={() => switchAuthMethod('email')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  authMethod === 'email'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Mail className="w-4 h-4 inline mr-2" />
                Email
              </button>
            </div>

            {/* Google Sign-In */}
            {authMethod === 'google' && isFirebaseAvailable && (
              <div className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-red-700 text-sm">
                        {error.split('\n').map((line, index) => (
                          <p key={index} className={index > 0 ? 'mt-2 text-xs' : ''}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                      <span className="text-blue-600 font-medium">Signing in...</span>
                    </div>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="font-semibold">Continue with Google</span>
                    </>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={switchMode}
                    className="text-green-600 hover:text-green-700 font-medium"
                  >
                    {mode === 'signin' 
                      ? "Don't have an account? Sign up" 
                      : "Already have an account? Sign in"
                    }
                  </button>
                </div>
              </div>
            )}

            {/* Phone Authentication */}
            {authMethod === 'phone' && (
              <form onSubmit={handlePhoneAuth} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-red-700 text-sm">
                        {error.split('\n').map((line, index) => (
                          <p key={index} className={index > 0 ? 'mt-2 text-xs' : ''}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter your phone number (e.g., +1234567890)"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {isUsingFirebasePhone 
                      ? 'Enter a real phone number to receive SMS verification'
                      : 'Demo mode: OTP will be shown in browser alert'
                    }
                  </p>
                </div>



                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      {authMethod === 'phone' ? 'Sending OTP...' : 'Please wait...'}
                    </div>
                  ) : (
                    authMethod === 'phone' 
                      ? `Send OTP${mode === 'signup' ? ' & Create Account' : ''}`
                      : mode === 'signin' ? 'Sign In' : 'Create Account'
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={switchMode}
                    className="text-green-600 hover:text-green-700 font-medium"
                  >
                    {mode === 'signin' 
                      ? "Don't have an account? Sign up" 
                      : "Already have an account? Sign in"
                    }
                  </button>
                </div>
              </form>
            )}

            {/* Email Authentication */}
            {authMethod === 'email' && (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-red-700 text-sm">
                        {error.split('\n').map((line, index) => (
                          <p key={index} className={index > 0 ? 'mt-2 text-xs' : ''}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Enter your phone number"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Please wait...
                    </div>
                  ) : (
                    mode === 'signin' ? 'Sign In' : 'Create Account'
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={switchMode}
                    className="text-green-600 hover:text-green-700 font-medium"
                  >
                    {mode === 'signin' 
                      ? "Don't have an account? Sign up" 
                      : "Already have an account? Sign in"
                    }
                  </button>
                </div>
              </form>
            )}

            {/* Firebase Not Available Message */}
            {authMethod === 'google' && !isFirebaseAvailable && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h3 className="text-orange-800 font-medium">Google Sign-In Unavailable</h3>
                    <p className="text-orange-700 text-sm mt-1">
                      Firebase configuration is missing. Please provide your Firebase credentials to enable Google Sign-In.
                    </p>
                    <p className="text-orange-600 text-xs mt-2">
                      You can still use phone or email authentication.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Guest Mode Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="text-center">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Just want to explore?
                </h3>
                <button
                  onClick={handleGuestMode}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 text-blue-700 py-3 px-4 rounded-lg font-semibold hover:from-blue-100 hover:to-indigo-100 hover:border-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700 mr-2"></div>
                      Entering Guest Mode...
                    </div>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Continue as Guest
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Explore all features without creating an account
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Your data will be saved locally on this device
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* OTP Verification Step */
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Verification Code Sent
              </h3>
              <p className="text-gray-600 text-sm">
                We've sent a 6-digit code to
              </p>
              <p className="font-semibold text-gray-900">{phone}</p>
              {isUsingFirebasePhone && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ Sent via Firebase SMS
                </p>
              )}
            </div>

            <form onSubmit={handleOtpVerification} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-red-700 text-sm">
                      {error.split('\n').map((line, index) => (
                        <p key={index} className={index > 0 ? 'mt-2 text-xs' : ''}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Verification Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Verifying...
                  </div>
                ) : (
                  'Verify & Continue'
                )}
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Didn't receive the code?
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="text-green-600 hover:text-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 
                      ? `Resend in ${resendCooldown}s` 
                      : 'Resend SMS'
                    }
                  </button>

                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};