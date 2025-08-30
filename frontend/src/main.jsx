import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
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
    path: '*',
    element: <NotFoundRoute />
  }
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
