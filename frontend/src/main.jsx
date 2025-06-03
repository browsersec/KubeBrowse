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
import BrowserSessionRoute from './routes/BrowserSessionRoute'
import ShareWSRoute from './routes/ShareWSRoute'
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
    path: '*',
    element: <NotFoundRoute />
  }
])

// Keep react-dom/client import as createRoot if it's already there, otherwise use ReactDOM.createRoot
// import React from 'react'; // Already implicitly available via StrictMode etc.
// import ReactDOM from 'react-dom/client'; // Ensure this is how createRoot is obtained
import keycloak from './keycloak'; // Import the keycloak instance
// import App from './App'; // App is not directly rendered here, RouterProvider is.

const root = createRoot(document.getElementById('root'));

const renderApp = () => {
  root.render(
    <StrictMode>
      <ThemeProvider> {/* Assuming ThemeProvider is setup */}
        {/* <App />  Replaced by RouterProvider */}
        <RouterProvider router={router} />
      </ThemeProvider>
    </StrictMode>
  );
};

keycloak.init({ onLoad: 'login-required', checkLoginIframe: false })
  .then((authenticated) => {
    if (authenticated) {
      console.log('User is authenticated');
      // Store token and refresh token if needed, or rely on keycloak object
      // keycloak.token and keycloak.refreshToken
      // You might want to set up automatic token refresh
      setInterval(() => {
        keycloak.updateToken(70).then((refreshed) => {
          if (refreshed) {
            console.log('Token refreshed' + refreshed);
          } else {
            console.warn('Token not refreshed, valid for '
              + Math.round(keycloak.tokenParsed.exp + keycloak.timeSkew - new Date().getTime() / 1000) + ' seconds');
          }
        }).catch(() => {
          console.error('Failed to refresh token');
          keycloak.logout(); // Or handle error appropriately
        });
      }, 60000); // Refresh every 60 seconds

      renderApp();
    } else {
      console.warn('User is not authenticated');
      // Handle not authenticated case, though 'login-required' should redirect
      root.render(
        <StrictMode>
          <div>User not authenticated. Please login.</div>
        </StrictMode>
      );
    }
  })
  .catch((error) => {
    console.error('Keycloak initialization failed:', error);
    root.render(
      <StrictMode>
        <div>Error initializing Keycloak. Please try again later.</div>
      </StrictMode>
    );
  });
