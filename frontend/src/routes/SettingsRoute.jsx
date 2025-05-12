import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function SettingsRoute() {
  const { theme, setTheme } = useTheme();
  
  const [settings, setSettings] = useState({
    theme: theme, // Use theme from context
    autoReconnect: true,
    inactivityTimeout: 30,
    language: 'en'
  });

  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    // Load settings from localStorage on mount
    if (window.localStorage) {
      try {
        const savedSettings = JSON.parse(window.localStorage.getItem('settings') || '{}');
        setSettings(prevSettings => ({
          ...prevSettings,
          ...savedSettings,
          theme: theme // Always use theme from context
        }));
      } catch (e) {
        // Handle error
      }
    }
  }, [theme]);

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    // If theme is changed, update the theme context
    if (id === 'theme') {
      setTheme(newValue);
    }
    
    setSettings(prevSettings => ({
      ...prevSettings,
      [id]: newValue
    }));
  };

  const handleSave = () => {
    // Save settings to localStorage
    if (window.localStorage) {
      window.localStorage.setItem('settings', JSON.stringify(settings));
      setSaveStatus('saved');
      
      setTimeout(() => {
        setSaveStatus(null);
      }, 2000);
    }
  };

  return (
    <div className="p-8">
      <motion.div 
        className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Settings</h1>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Appearance</h2>
          
          <div className="mb-4">
            <label htmlFor="theme" className="block text-gray-700 dark:text-gray-300 mb-1 font-medium">Theme</label>
            <select 
              id="theme" 
              value={settings.theme} 
              onChange={handleInputChange} 
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="system">System Default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="language" className="block text-gray-700 dark:text-gray-300 mb-1 font-medium">Language</label>
            <select 
              id="language" 
              value={settings.language} 
              onChange={handleInputChange} 
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Connection</h2>
          
          <div className="mb-4 flex items-center">
            <input 
              type="checkbox" 
              id="autoReconnect" 
              checked={settings.autoReconnect} 
              onChange={handleInputChange} 
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="autoReconnect" className="ml-2 text-gray-700 dark:text-gray-300">Auto-reconnect on disconnect</label>
          </div>

          <div className="mb-4">
            <label htmlFor="inactivityTimeout" className="block text-gray-700 dark:text-gray-300 mb-1 font-medium">Inactivity Timeout (minutes)</label>
            <input 
              type="number" 
              id="inactivityTimeout" 
              value={settings.inactivityTimeout} 
              onChange={handleInputChange} 
              min="0"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Set to 0 to disable timeout</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className={`px-5 py-2 ${saveStatus === 'saved' ? 'bg-green-600' : 'bg-blue-600'} text-white rounded-lg hover:${saveStatus === 'saved' ? 'bg-green-700' : 'bg-blue-700'} transition-colors flex items-center`}
          >
            {saveStatus === 'saved' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </>
            ) : 'Save Settings'}
          </button>
        </div>
      </motion.div>
    </div>
  );
} 