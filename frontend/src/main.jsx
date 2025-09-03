import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'

// Context providers
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'

// Layouts
import DashboardLayout from './layouts/DashboardLayout'

// Routes
import SettingsRoute from './routes/SettingsRoute'
import NotFoundRoute from './routes/NotFoundRoute'
import OfficeSessionRoute from './routes/OfficeSessionRoute'
import BrowserSessionRoute from './routes/BrowserSessionRoute'
import ShareWSRoute from './routes/ShareWSRoute'
import { AuthSuccessRoute } from './routes/AuthSuccessRoute'
import EmailVerificationSuccessRoute from './routes/EmailVerificationSuccessRoute'
import ProfileRoute from './routes/ProfileRoute'
import PasswordChangeRoute from './routes/PasswordChangeRoute'
const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <OfficeSessionRoute />
      },
      {
        path: 'dashboard',
        element: <OfficeSessionRoute />
      },
      {
        path: 'settings',
        element: <SettingsRoute />
      },
      {
        path: 'profile',
        element: <ProfileRoute />
      },
      {
        path: 'password',
        element: <PasswordChangeRoute />
      },
      {
        path: 'office-session',
        element: <OfficeSessionRoute />
      },
      {
        path: 'browser-session',
        element: <BrowserSessionRoute />
      },
      {
        path: 'share-ws-url',
        element: <ShareWSRoute />
      }
    ]
  },
  {
    path: '/auth/success',
    element: <AuthSuccessRoute />
  },
  {
    path: '/auth/verification-success',
    element: <EmailVerificationSuccessRoute />
  },
  {
    path: '*',
    element: <NotFoundRoute />
  }
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster 
          position="top-center"
          reverseOrder={false}
          gutter={8}
          containerClassName=""
          containerStyle={{}}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              style: {
                background: '#10b981',
              },
            },
            error: {
              style: {
                background: '#ef4444',
              },
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
