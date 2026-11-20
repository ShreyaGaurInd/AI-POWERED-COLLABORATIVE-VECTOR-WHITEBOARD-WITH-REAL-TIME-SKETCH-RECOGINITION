import React, { useState } from 'react';
import { Mail, Lock, Loader2, ArrowRight, KeyRound, Check, RefreshCw, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onSwitchToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verification step state if user account is unverified
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await api.login({ email: email.trim(), password });
      if (response.success && response.data?.token && response.data.user) {
        login(response.data.token, response.data.user);
        onSuccess();
      }
    } catch (err: any) {
      if (err.requiresVerification) {
        setIsVerifying(true);
        setError('Please verify your email address to continue.');
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (verificationCode.trim().length !== 6) {
      setError('Please enter the 6-digit code');
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

  if (isVerifying) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => {
            setIsVerifying(false);
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to sign in</span>
        </button>

        <div className="text-center">
          <div className="w-12 h-12 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Verify your email</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            We sent a verification code to <span className="font-semibold text-brand-600">{email}</span>
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-900/50">
            {error}
          </div>
        )}

        {resendSuccess && (
          <div className="p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
            {resendSuccess}
          </div>
        )}

        {/* Informational hint */}
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          Enter the 6-digit verification code to complete sign in.
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
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-center font-mono text-2xl tracking-[0.4em]"
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
                <span>Verify & Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={isResending}
            className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
          >
            {isResending ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
            Resend verification code
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3.5 text-sm text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-900/50">
          {error}
        </div>
      )}

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
            placeholder="you@domain.com"
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Password
          </label>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Lock className="w-5 h-5" />
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 font-medium text-sm transition-all shadow-md shadow-brand-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <span>Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <div className="text-center pt-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            Create one for free
          </button>
        </p>
      </div>
    </form>
  );
};
