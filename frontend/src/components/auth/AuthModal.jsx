import React, { useState } from 'react';
import { Dialog } from '../ui/dialog';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function AuthModal({ isOpen, onClose }) {
  const [isLoginMode, setIsLoginMode] = useState(true);

  const switchToLogin = () => setIsLoginMode(true);
  const switchToRegister = () => setIsLoginMode(false);

  return (
    isOpen && (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
          onClick={onClose}
        >
          <div
            className="relative max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute -top-2 -right-2 z-10 w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {isLoginMode ? (
              <LoginForm onSwitchToRegister={switchToRegister} />
            ) : (
              <RegisterForm onSwitchToLogin={switchToLogin} />
            )}
          </div>
        </div>
      </Dialog>
    )
  );
}
