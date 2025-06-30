import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DashboardRoute() {
  const { connections, deleteConnection } = useOutletContext();
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const handleDelete = (id) => {
    try {
      
      deleteConnection(id);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting connection:', error);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <motion.h1 
          className="text-3xl font-bold text-foreground"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Dashboard
        </motion.h1>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Button asChild>
            <Link to="/connections/new">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Connection
            </Link>
          </Button>
        </motion.div>
      </div>

      {connections.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="p-10 text-center">
            <CardContent className="pt-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">No Connections Yet</h2>
              <p className="text-muted-foreground mb-6">Get started by adding your first connection</p>
              <Button asChild>
                <Link to="/connections/new">
                  Create Connection
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections.map((connection, index) => (
            <motion.div 
              key={connection.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="relative">
                {deleteConfirmId === connection.id ? (
                  <div className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center p-4">
                    <p className="text-foreground mb-4 text-center">Are you sure you want to delete this connection?</p>
                    <div className="flex space-x-3">
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(connection.id)}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
                
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(connection.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                    
                    <Button 
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                    >
                      <Link to={`/connections/${connection.id}/edit`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <CardTitle className="text-xl mb-2">
                    {connection.name || `Connection ${index + 1}`}
                  </CardTitle>
                  
                  <div className="text-muted-foreground text-sm mb-1 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>{connection.scheme || 'rdp'}://{connection.hostname || '0.0.0.0'}</span>
                  </div>
                  
                  <div className="text-muted-foreground text-sm mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{connection.username || 'No username'}</span>
                  </div>
                  
                  <Button
                    asChild
                    className="w-full"
                  >
                    <Link to={`/connections/${connection.id}`}>
                      Connect
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
} 