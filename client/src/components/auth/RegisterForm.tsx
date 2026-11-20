import React, { useState } from 'react';
import { Mail, Lock, User, Loader2, Sparkles, Check, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

const AVATAR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin }) => {
  const { login } = useAuth();
  const [step, setStep] = useState<'REGISTER' | 'VERIFY'>('REGISTER');

  // Registration Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_PALETTE[6]); // Indigo

  // Verification Fields
  const [verificationCode, setVerificationCode] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  // States
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle Step 1: Submit Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        avatarColor: selectedColor,
      });

      if (response.success) {
        setStep('VERIFY');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step 2: Submit Verification Code
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (verificationCode.trim().length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.verifyEmail({
        email: email.trim(),
        code: verificationCode.trim(),
      });

      if (response.success && response.data?.token && response.data.user) {
        login(response.data.token, response.data.user);
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend Verification Code
  const handleResendCode = async () => {
    setError(null);
    setResendSuccess(null);
    setIsResending(true);

    try {
      const response = await api.resendCode({ email: email.trim() });
      if (response.success) {
        setResendSuccess('New verification code sent! Check your inbox.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  // VIEW 2: VERIFICATION CODE ENTRY
  if (step === 'VERIFY') {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setStep('REGISTER')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Change email address</span>
        </button>

        <div className="text-center">
          <div className="w-12 h-12 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Verify your email</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            We sent a 6-digit confirmation code to:
          </p>
          <p className="font-semibold text-brand-600 dark:text-brand-400 text-sm mt-0.5">
            {email}
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-900/50">
            {error}
          </div>
        )}

        {resendSuccess && (
          <div className="p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
            {resendSuccess}
          </div>
        )}

        {/* Informational Hint */}
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          Enter the 6-digit confirmation code sent to your email to activate your account.
        </p>

        <form onSubmit={handleVerifySubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 text-center">
              Enter 6-digit code
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-center font-mono text-2xl tracking-[0.4em]"
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || verificationCode.length !== 6}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-sm transition-all shadow-md shadow-brand-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirm & Open Board</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Didn't receive the email?{' '}
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isResending}
              className="font-medium text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
            >
              {isResending ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
              Resend code
            </button>
          </p>
        </div>
      </div>
    );
  }

  // VIEW 1: INITIAL REGISTRATION FORM
  return (
    <form onSubmit={handleRegisterSubmit} className="space-y-4">
      {error && (
        <div className="p-3.5 text-sm text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-900/50">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Full Name
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <User className="w-5 h-5" />
          </div>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Shreya Gaur"
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Email address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Mail className="w-5 h-5" />
          </div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          We'll send a 6-digit verification code to confirm ownership.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 chars"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm"
            />
          </div>
        </div>
      </div>

      {/* Avatar Color Picker */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Pick your profile color
        </label>
        <div className="flex items-center gap-2">
          {AVATAR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none shadow-sm"
              style={{ backgroundColor: color }}
            >
              {selectedColor === color && <Check className="w-4 h-4 text-white stroke-[3]" />}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 font-medium text-sm transition-all shadow-md shadow-brand-500/20 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Sending verification code...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>Continue to Verification</span>
          </>
        )}
      </button>

      <div className="text-center pt-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </form>
  );
};
