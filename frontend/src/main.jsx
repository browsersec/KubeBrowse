import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'

// Theme
import { ThemeProvider } from './context/ThemeContext'

// Layouts
import DashboardLayout from './layouts/DashboardLayout'

// Routes
import SettingsRoute from './routes/SettingsRoute'
import NotFoundRoute from './routes/NotFoundRoute'
import OfficeSessionRoute from './routes/OfficeSessionRoute'

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
        path: 'settings',
        element: <SettingsRoute />
      },
      {
        path: 'office-session',
        element: <OfficeSessionRoute />
      }
    ]
  },
  {
    path: '*',
    element: <NotFoundRoute />
  }
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
)
