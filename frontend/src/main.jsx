import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'

// Theme
import { ThemeProvider } from './context/ThemeContext'

// Layouts
import DashboardLayout from './layouts/DashboardLayout'

// Routes
import DashboardRoute from './routes/DashboardRoute'
import NewConnectionRoute from './routes/NewConnectionRoute'
import EditConnectionRoute from './routes/EditConnectionRoute'
import ConnectionRoute from './routes/ConnectionRoute'
import SettingsRoute from './routes/SettingsRoute'
import NotFoundRoute from './routes/NotFoundRoute'

const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <DashboardRoute />
      },
      {
        path: 'connections/new',
        element: <NewConnectionRoute />
      },
      {
        path: 'connections/:id',
        element: <ConnectionRoute />
      },
      {
        path: 'connections/:id/edit',
        element: <EditConnectionRoute />
      },
      {
        path: 'settings',
        element: <SettingsRoute />
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
