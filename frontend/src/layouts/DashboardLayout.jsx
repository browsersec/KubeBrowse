import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/sidebar/Sidebar';

export default function DashboardLayout() {
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    // Load saved connections from localStorage on mount
    if (window.localStorage) {
      try {
        const savedConnections = JSON.parse(window.localStorage.getItem('connections') || '[]');
        setConnections(savedConnections);
      } catch (e) {
        window.localStorage.setItem('connections', '[]');
      }
    }
  }, []);

  // Function to add a new connection
  const addConnection = (newConnection) => {
    const updatedConnections = [...connections, {
      ...newConnection,
      id: `conn-${Date.now()}`
    }];
    
    setConnections(updatedConnections);
    
    if (window.localStorage) {
      window.localStorage.setItem('connections', JSON.stringify(updatedConnections));
    }
    
    return updatedConnections;
  };
  
  // Function to update an existing connection
  const updateConnection = (id, updatedConnection) => {
    const updatedConnections = connections.map(conn => 
      conn.id === id ? { ...updatedConnection, id } : conn
    );
    
    setConnections(updatedConnections);
    
    if (window.localStorage) {
      window.localStorage.setItem('connections', JSON.stringify(updatedConnections));
    }
    
    return updatedConnections;
  };
  
  // Function to delete a connection
  const deleteConnection = (id) => {
    const updatedConnections = connections.filter(conn => conn.id !== id);
    
    setConnections(updatedConnections);
    
    if (window.localStorage) {
      window.localStorage.setItem('connections', JSON.stringify(updatedConnections));
    }
    
    return updatedConnections;
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Sidebar connections={connections} />
      
      <div className="flex-1 overflow-auto">
        <Outlet context={{ 
          connections, 
          addConnection, 
          updateConnection, 
          deleteConnection 
        }} />
      </div>
    </div>
  );
} 