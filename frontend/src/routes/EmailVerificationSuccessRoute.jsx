import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import toast from 'react-hot-toast';

export default function EmailVerificationSuccessRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    console.log('EmailVerificationSuccessRoute: Component mounted');
    console.log('EmailVerificationSuccessRoute: User:', user);
    
    // Show welcome toast immediately
    toast.success('🎉 Welcome! Your email has been verified successfully!', {
      duration: 4000,
      position: 'top-center',
      style: {
        background: '#10b981',
        color: '#fff',
        fontSize: '16px',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      icon: '✅',
    });

    // Redirect to home page after a short delay
    const redirectTimer = setTimeout(() => {
      console.log('EmailVerificationSuccessRoute: Redirecting to home page...');
      navigate('/', { replace: true });
    }, 2000);

    // Cleanup timer on unmount
    return () => clearTimeout(redirectTimer);
  }, [navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-auto p-6">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-green-100">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-green-900">
              Email Verified! 
            </h2>
            <p className="text-gray-600">
              Welcome! Your email has been successfully verified.
            </p>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">
              🎉 Redirecting to home page in 2 seconds...
            </p>
          </div>
          
          <div className="pt-2">
            <p className="text-xs text-gray-500">
              You can now access all features of KubeBrowse!
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}