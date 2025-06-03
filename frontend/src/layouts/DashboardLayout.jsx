import { Outlet } from 'react-router-dom';
import Sidebar from '../components/sidebar/Sidebar';
import keycloak from '../keycloak'; // Import keycloak instance
import React from 'react'; // Ensure React is imported if using JSX features like fragments or direct JSX syntax not via function return

export default function DashboardLayout() {
  const handleLogout = () => {
    keycloak.logout({ redirectUri: window.location.origin }); // Redirect to home page after logout
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-auto"> {/* Changed to flex-col to stack user bar and outlet */}
        {keycloak && keycloak.authenticated && (
          <div style={{
            padding: '10px 20px',
            backgroundColor: '#e9ecef', /* Light grey, adjust to theme */
            color: '#495057', /* Darker text color */
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #dee2e6' /* Subtle border */
          }}>
            <p style={{ margin: 0 }}>Welcome, <strong>{keycloak.tokenParsed?.preferred_username || 'User'}</strong></p>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 15px',
                backgroundColor: '#007bff', /* Bootstrap primary blue */
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
            >
              Logout
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto p-4"> {/* Added padding for content area */}
          <Outlet />
        </div>
      </div>
    </div>
  );
} 