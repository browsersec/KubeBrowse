import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Auth action types
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_ERROR: 'SET_ERROR',
  LOGOUT: 'LOGOUT',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_EMAIL_VERIFICATION_NEEDED: 'SET_EMAIL_VERIFICATION_NEEDED'
};

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  emailVerificationNeeded: false,
  pendingVerificationEmail: null
};

// Auth reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };
    case AUTH_ACTIONS.SET_USER: {
      // Check if user object has meaningful data
      const hasUserData = action.payload && (
        action.payload.id || 
        action.payload.email || 
        action.payload.username ||
        (action.payload.name && action.payload.name.trim() !== '')
      );
      
      return {
        ...state,
        user: action.payload,
        isAuthenticated: hasUserData,
        isLoading: false,
        error: null
      };
    }
    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      };
    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };
    case AUTH_ACTIONS.SET_EMAIL_VERIFICATION_NEEDED:
      return {
        ...state,
        emailVerificationNeeded: true,
        pendingVerificationEmail: action.payload,
        isLoading: false
      };
    default:
      return state;
  }
}

// Create context
const AuthContext = createContext();

// Auth provider component
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const lastAuthCheck = React.useRef(0);
  const RATE_LIMIT_MS = 1000; // Minimum 1 second between auth checks

  // Check if user is authenticated on app load
  useEffect(() => {
    // Don't auto-check auth if we're on the success page - let that page handle it
    if (window.location.pathname !== '/auth/success') {
      checkAuthStatus();
    }
    
    // Check if user is coming from OAuth callback
    if (window.location.pathname === '/auth/success') {
      // User just completed OAuth, check auth status after a short delay
      console.log('OAuth callback detected, checking auth status...');
      setTimeout(() => {
        checkAuthStatus();
      }, 1500); // Give backend time to set cookies
    }
  }, []);

  const checkAuthStatus = async () => {
    // Rate limiting to prevent excessive API calls
    const now = Date.now();
    if (now - lastAuthCheck.current < RATE_LIMIT_MS) {
      console.log('Auth check rate limited, skipping');
      return;
    }
    lastAuthCheck.current = now;
    
    try {
      console.log('Checking auth status...');
      const response = await fetch('/auth/me', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log('Auth response status:', response.status);
      console.log('Auth response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('Auth successful, user data:', data);
        console.log('User object details:', {
          id: data.user?.id,
          email: data.user?.email,
          username: data.user?.username,
          name: data.user?.name,
          provider: data.user?.provider,
          hasId: !!data.user?.id,
          hasEmail: !!data.user?.email,
          hasUsername: !!data.user?.username,
          hasName: !!(data.user?.name && data.user.name.trim() !== ''),
          isEmpty: Object.keys(data.user || {}).length === 0
        });
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.user });
      } else {
        console.log('Auth failed, status:', response.status);
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: null });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: null });
    }
  };

  const login = async (email, password) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.user });
        return { success: true, user: data.user };
      } else {
        // Check if email verification is needed
        if (response.status === 403 && data.code === 'EMAIL_NOT_VERIFIED') {
          dispatch({ type: AUTH_ACTIONS.SET_EMAIL_VERIFICATION_NEEDED, payload: email });
          return { success: false, error: data.error, needsVerification: true };
        }
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: data.error });
        return { success: false, error: data.error };
      }
    } catch {
      const errorMessage = 'Login failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const register = async (email, password) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        // Registration successful, but email verification needed
        dispatch({ type: AUTH_ACTIONS.SET_EMAIL_VERIFICATION_NEEDED, payload: email });
        return { success: true, user: data.user, message: data.message, needsVerification: true };
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: data.error });
        return { success: false, error: data.error };
      }
    } catch  {
      const errorMessage = 'Registration failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  const loginWithGitHub = () => {
    // Use the proxy path instead of full URL
    window.location.href = '/auth/oauth/github';
  };

  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  const verifyEmail = async (token) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

    try {
      const response = await fetch('/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (response.ok) {
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.user });
        return { success: true, user: data.user, message: data.message };
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: data.error });
        return { success: false, error: data.error };
      }
    } catch {
      const errorMessage = 'Email verification failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const resendVerificationEmail = async (email) => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });

    try {
      const response = await fetch('/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        return { success: true, message: data.message };
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: data.error });
        return { success: false, error: data.error };
      }
    } catch {
      const errorMessage = 'Failed to resend verification email. Please try again.';
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    loginWithGitHub,
    clearError,
    checkAuthStatus,
    verifyEmail,
    resendVerificationEmail
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
