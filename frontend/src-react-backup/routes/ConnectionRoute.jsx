import { useState, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import GuacClient from '../components/GuacClient';
import ConnectingAnimation from '../components/animations/ConnectingAnimation';
import DisconnectedAnimation from '../components/animations/DisconnectedAnimation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ConnectionRoute() {
  const { id } = useParams();
  const { connections } = useOutletContext();
  const navigate = useNavigate();

  const [connection, setConnection] = useState(null);
  const [connectionState, setConnectionState] = useState('connecting'); // connecting, connected, disconnected
  const [error, setError] = useState(null);

  useEffect(() => {
    // Find the connection with the given ID
    const foundConnection = connections.find(conn => conn.id === id);

    if (!foundConnection) {
      setError('Connection not found');
      setConnectionState('disconnected');
      return;
    }

    setConnection(foundConnection);
    setConnectionState('connecting');

    // Attempt to establish connection
    const timeout = setTimeout(() => {
      try {
        // Real connection logic would go here
        setConnectionState('connected');
      } catch (err) {
        setError(`Connection failed: ${err.message}`);
        setConnectionState('disconnected');
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [id, connections]);

  const handleDisconnect = () => {
    setConnectionState('disconnected');
  };

  const buildQueryObj = () => {
    if (!connection) return {};

    // Properly format the connection parameters as individual properties
    // instead of passing the entire object
    console.log(connection)
    return {
      scheme: connection.scheme || 'rdp',
      hostname: connection.hostname || '0.0.0.0',
      port: connection.port || '',
      'ignore-cert': connection.ignoreCert !== false,
      security: connection.security || '',
      username: connection.username || '',
      password: connection.password || '',
      width: Math.round(window.innerWidth * (window.devicePixelRatio || 1)),
      height: Math.round(window.innerHeight * (window.devicePixelRatio || 1))
    };
  };

  if (connectionState === 'connecting') {
    return <ConnectingAnimation />;
  }

  if (connectionState === 'disconnected') {
    return (
      <DisconnectedAnimation />
    );
  }
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-destructive mb-4">Connection Error</h2>
            <p className="text-foreground mb-6">{error}</p>
            <Button
              onClick={() => navigate('/')}
              className="w-full"
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <GuacClient
        query={buildQueryObj()}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
} 