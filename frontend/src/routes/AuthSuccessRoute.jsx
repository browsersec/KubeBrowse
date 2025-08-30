import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthSuccessRoute() {
  const { checkAuthStatus } = useAuth();

  useEffect(() => {
    // Check auth status to update the context with the new user
    checkAuthStatus();

    // Redirect to dashboard after a short delay
    const timer = setTimeout(() => {
      window.location.href = '/dashboard';
    }, 2000);

    return () => clearTimeout(timer);
  }, [checkAuthStatus]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Authentication Successful!
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            You have been successfully signed in. Redirecting to your dashboard...
          </p>
        </div>
        
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    </div>
  );
}
