import { useState } from 'react';
import GuacClient from './GuacClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

const API_BASE = '' // Use relative URLs to leverage Vite's proxy

const ShareWSSession = () => {
  const [sessionState, setSessionState] = useState({
    connectionId: null,
    status: 'idle',
    error: null
  });
  const [inputUuid, setInputUuid] = useState('');
  const [sessionName, setSessionName] = useState('');

  const handleDisconnect = () => {
    // if (sessionState.connectionId) {
    //   // Stop the session
    //   fetch(`${API_BASE}/sessions/${sessionState.connectionId}/stop`, {
    //     method: 'DELETE'
    //   }).catch(console.error);
    // }
    // console.log("Disconnected")
    // setSessionState({
    //   connectionId: null,
    //   status: 'idle',
    //   error: null
    // });
  };

  const handleInputChange = (e) => {
    setInputUuid(e.target.value);
  };

  const handleNameChange = (e) => {
    setSessionName(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSessionState(prev => ({ ...prev, status: 'creating', error: null }));
      
      // Just take the UUID directly, no parsing
      const uuid = inputUuid.trim();
      
      // Validate UUID format
      if (!uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new Error('Invalid UUID format. Please enter a valid connection ID.');
      }
      
      // Set the connection state with just the UUID
      setSessionState({
        connectionId: uuid,
        status: 'ready',
        error: null,
        name: sessionName || `Shared Session: ${uuid.substring(0, 8)}`
      });
      console.log("Ready to connect with UUID:", uuid);
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        status: 'error',
        error: error.message
      }));
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Join Shared Session</h2>
        <p className="text-muted-foreground">
          Enter the connection ID to join an existing session.
        </p>
      </div>
      
      {sessionState.status === 'idle' && (
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uuid">Connection ID (UUID)</Label>
                <Input
                  id="uuid"
                  type="text"
                  value={inputUuid}
                  onChange={handleInputChange}
                  placeholder="123e4567-e89b-12d3-a456-426614174000"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enter the UUID of the shared session
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sessionName">Session Name (optional)</Label>
                <Input
                  id="sessionName"
                  type="text"
                  value={sessionName}
                  onChange={handleNameChange}
                  placeholder="My Shared Session"
                />
              </div>
              
              <Button type="submit" className="w-full">
                Connect
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      
      {sessionState.status === 'creating' && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting to shared session...
        </div>
      )}
      
      {sessionState.status === 'error' && (
        <Alert variant="destructive" className="w-full max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>{sessionState.error}</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSessionState(prev => ({...prev, status: 'idle'}))}
              >
                Try again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {sessionState.status === 'ready' && sessionState.connectionId && (
        <div className="w-full">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="default">
                {sessionState.name || 'Shared Session'}
              </Badge>
              <p className="text-xs text-muted-foreground">
                ID: {sessionState.connectionId}
              </p>
            </div>
            <Button
              onClick={handleDisconnect}
              variant="destructive"
              size="sm"
            >
              Disconnect
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="w-full h-[600px] rounded-lg overflow-hidden">
                <GuacClient
                  query={{
                    uuid: sessionState.connectionId,
                    width: Math.round(window.innerWidth * (window.devicePixelRatio || 1)),
                    height: Math.round(window.innerHeight * (window.devicePixelRatio || 1))
                  }}
                  connectionId={sessionState.connectionId}
                  onDisconnect={handleDisconnect}
                  OfficeSession={false}
                  sharing={true}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ShareWSSession;
