import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export function AuthSuccessRoute() {
  const { checkAuthStatus, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking');
  const authRef = React.useRef({ user, isAuthenticated });
  useEffect(() => { authRef.current = { user, isAuthenticated }; }, [user, isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    let redirectTimer;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const run = async () => {
      try {
        for (let attempt = 1; attempt <= 3; attempt++) {
          setStatus('checking');
          await checkAuthStatus();
          await sleep(1000);
          const { user: u, isAuthenticated: ok } = authRef.current;
          if (cancelled) return;
          if (ok && u) {
            setStatus('success');
            toast.success(`Welcome back, ${u.name || u.email}!`, {
              duration: 3000, position: 'top-right',
              style: { background: '#10B981', color: '#fff', fontWeight: '600' },
              iconTheme: { primary: '#fff', secondary: '#10B981' },
            });
            redirectTimer = setTimeout(() => navigate('/', { replace: true }), 2000);
            return;
          }
          setStatus('retrying');
          toast(`Authentication attempt ${attempt}/3...`, {
            duration: 2000, position: 'top-right',
            style: { background: '#F59E0B', color: '#fff', fontWeight: '600' },
            iconTheme: { primary: '#fff', secondary: '#F59E0B' },
          });
          await sleep(2000);
        }
        if (!cancelled) {
          setStatus('failed');
          toast.error('Authentication failed. Please try again.', {
            duration: 4000, position: 'top-right',
            style: { background: '#EF4444', color: '#fff', fontWeight: '600' },
            iconTheme: { primary: '#fff', secondary: '#EF4444' },
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Auth check failed:', error);
          setStatus('failed');
          toast.error('Authentication check failed. Please try again.', {
            duration: 4000, position: 'top-right',
            style: { background: '#EF4444', color: '#fff', fontWeight: '600' },
            iconTheme: { primary: '#fff', secondary: '#EF4444' },
          });
        }
      }
    };
    run();
    return () => {
      cancelled = true;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [checkAuthStatus, navigate]);

  const handleRetry = () => {
    setStatus('checking');
    
    // Show retry toast
    toast(
      'Retrying authentication...',
      {
        duration: 2000,
        position: 'top-right',
        style: {
          background: '#3B82F6',
          color: '#fff',
          fontWeight: '600',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#3B82F6',
        },
      }
    );
    
    checkAuthStatus();
  };

  const handleManualRedirect = () => {
    navigate('/');
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
              Setting up your session...
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Please wait while we authenticate you with GitHub
            </p>
          </div>
          
          <div className="flex justify-center">
            <div className="animate-pulse text-blue-600 dark:text-blue-400">
              Establishing secure connection...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'retrying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900">
              <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
              Almost there...
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Setting up your session...
            </p>
          </div>
          
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
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
              Welcome back!
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {user?.name || user?.email} - Showing success notification and redirecting to home page...
            </p>
          </div>
          
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
              Authentication Issue
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              We couldn't establish your session automatically
            </p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={handleRetry}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </button>
            
            <button
              onClick={handleManualRedirect}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
