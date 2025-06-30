import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Monitor, User, Trash2, Edit } from 'lucide-react';

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
          className="text-3xl font-bold"
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
              <Plus className="h-5 w-5 mr-2" />
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
          <Card className="text-center p-10">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl mb-2">No Connections Yet</CardTitle>
            <CardDescription className="mb-6">Get started by adding your first connection</CardDescription>
            <Button asChild>
              <Link to="/connections/new">
                Create Connection
              </Link>
            </Button>
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
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Monitor className="h-6 w-6 text-primary" />
                    </div>
                    
                    <div className="flex space-x-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Connection</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this connection? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(connection.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link to={`/connections/${connection.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <CardTitle className="text-xl mb-2">
                    {connection.name || `Connection ${index + 1}`}
                  </CardTitle>
                  
                  <div className="text-muted-foreground text-sm mb-1 flex items-center">
                    <Monitor className="h-4 w-4 mr-1.5" />
                    <span>{connection.scheme || 'rdp'}://{connection.hostname || '0.0.0.0'}</span>
                  </div>
                  
                  <div className="text-muted-foreground text-sm mb-4 flex items-center">
                    <User className="h-4 w-4 mr-1.5" />
                    <span>{connection.username || 'No username'}</span>
                  </div>
                  
                  <Button asChild className="w-full">
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