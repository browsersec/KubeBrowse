import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

export default function EmailVerification({ email, onBack }) {
  const { resendVerificationEmail, isLoading } = useAuth();
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);

  const handleResendEmail = async () => {
    setIsResending(true);
    setMessage('');
    
    const result = await resendVerificationEmail(email);
    
    if (result.success) {
      setMessage('Verification email sent successfully! Please check your inbox.');
    } else {
      setMessage(result.error || 'Failed to resend verification email.');
    }
    
    setIsResending(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto p-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900">Check Your Email</h2>
        
        <div className="space-y-2">
          <p className="text-gray-600">
            We've sent a verification link to:
          </p>
          <p className="font-semibold text-gray-900">{email}</p>
        </div>
        
        <p className="text-sm text-gray-500">
          Click the link in the email to verify your account. The link will expire in 24 hours.
        </p>
        
        {message && (
          <div className={`p-3 rounded-md text-sm ${
            message.includes('successfully') 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
          </div>
        )}
        
        <div className="space-y-3">
          <Button
            onClick={handleResendEmail}
            disabled={isResending || isLoading}
            variant="outline"
            className="w-full"
          >
            {isResending ? 'Sending...' : 'Resend Verification Email'}
          </Button>
          
          {onBack && (
            <Button
              onClick={onBack}
              variant="ghost"
              className="w-full"
            >
              Back to Login
            </Button>
          )}
        </div>
        
        <div className="text-xs text-gray-500 space-y-1">
          <p>Didn't receive the email?</p>
          <ul className="list-disc list-inside text-left space-y-1">
            <li>Check your spam/junk folder</li>
            <li>Make sure {email} is correct</li>
            <li>Try resending the verification email</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}