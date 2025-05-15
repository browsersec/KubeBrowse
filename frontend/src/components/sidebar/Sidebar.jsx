import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

export default function Sidebar({ connections = [] }) {
  const [expanded, setExpanded] = useState(true);
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.div 
      className={`h-screen bg-gray-900 dark:bg-gray-950 text-white ${expanded ? 'w-64' : 'w-20'} transition-all duration-300 flex flex-col`}
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {expanded ? (
          <h1 className="text-xl font-semibold">KubeBrowse</h1>
        ) : (
          <h1 className="text-xl font-semibold">KB</h1>
        )}
        <button 
          onClick={() => setExpanded(!expanded)} 
          className="p-2 rounded hover:bg-gray-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${expanded ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={expanded ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"} />
          </svg>
        </button>
      </div>

      <nav className="flex-grow overflow-y-auto py-6">
        <div className="mb-6 px-4">
          <NavLink 
            to="/"
            className={({ isActive }) => 
              `flex items-center py-3 px-4 rounded-lg transition-colors ${isActive ? 'bg-blue-700' : 'hover:bg-gray-800'}`
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {expanded && <span className="ml-3">Dashboard</span>}
          </NavLink>

          <NavLink 
            to="/connections/new"
            className={({ isActive }) => 
              `flex items-center py-3 px-4 rounded-lg transition-colors mt-2 ${isActive ? 'bg-blue-700' : 'hover:bg-gray-800'}`
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {expanded && <span className="ml-3">New Connection</span>}
          </NavLink>

          <NavLink 
            to="/office-session"
            className={({ isActive }) => 
              `flex items-center py-3 px-4 rounded-lg transition-colors mt-2 ${isActive ? 'bg-blue-700' : 'hover:bg-gray-800'}`
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-3-3v6m9-6a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {expanded && <span className="ml-3">New Office Session</span>}
          </NavLink>
        </div>

        {connections.length > 0 && (
          <div className="px-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className={`text-gray-400 text-xs uppercase font-semibold ${expanded ? '' : 'sr-only'}`}>
                Saved Connections
              </h2>
            </div>
            
            <div className="space-y-1">
              {connections.map((connection, index) => (
                <NavLink
                key={connection.id}
                to={`/connections/${connection.id}`}
                  className={({ isActive }) => 
                    `flex items-center py-3 px-4 rounded-lg transition-colors ${isActive ? 'bg-blue-700' : 'hover:bg-gray-800'}`
                  }
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  {expanded && (
                    <span className="ml-3 truncate">{connection.name || `Connection ${index + 1}`}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-gray-800 flex flex-col space-y-2">
        <NavLink 
          to="/settings"
          className={({ isActive }) => 
            `flex items-center py-3 px-4 rounded-lg transition-colors ${isActive ? 'bg-blue-700' : 'hover:bg-gray-800'}`
          }
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {expanded && <span className="ml-3">Settings</span>}
        </NavLink>

        {expanded && (
          <button
            onClick={toggleTheme}
            className="flex items-center py-3 px-4 rounded-lg transition-colors hover:bg-gray-800"
          >
            {theme === 'dark' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="ml-3">Light Mode</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span className="ml-3">Dark Mode</span>
              </>
            )}
          </button>
        )}
        
        {!expanded && (
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center py-3 px-4 rounded-lg transition-colors hover:bg-gray-800"
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
} 