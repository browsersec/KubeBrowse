import { useState } from 'react';
import GuacClient from './GuacClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const isSecure = window.location.protocol === 'https:';
// const API_BASE = import.meta.env.VITE_GUAC_CLIENT_URL || `${isSecure ? 'https' : 'http'}://${location.host}`;
// const API_BASE = 'https://152.53.244.80:30006'
// const API_BASE = 'http://localhost:4567'
const API_BASE = '' // Use relative URLs to leverage Vite's proxy

const ShareWSSession = () => {
  const [sessionState, setSessionState] = useState({
    connectionId: null,
    websocketUrl: null,
    status: 'idle',
    error: null
  });
  const [inputUrl, setInputUrl] = useState('');

 

  const handleDisconnect = () => {
    if (sessionState.connectionId) {
      // Stop the session
      fetch(`${API_BASE}/sessions/${sessionState.connectionId}/stop`, {
        method: 'DELETE'
      }).catch(console.error);
    }
    console.log("Disconnected")
    setSessionState({
      connectionId: null,
      websocketUrl: null,
      status: 'idle',
      error: null
    });
  };

  const handleInputChange = (e) => {
    setInputUrl(e.target.value);
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    try {
      setSessionState(prev => ({ ...prev, status: 'creating', error: null }));
      
      // Extract UUID from input URL
      const url = new URL(inputUrl, window.location.origin);
      const uuid = url.searchParams.get('uuid');

    //   console.log(uuid)
      
      if (!uuid) {
        throw new Error('Invalid URL: UUID parameter not found');
      }
      
      // Get connection details using the extracted UUID
      const connectResponse = await fetch(`${API_BASE}/test/connect/${uuid}`);
      if (!connectResponse.ok) {
        throw new Error('Failed to get connection URL');
      }
      
      const connectData = await connectResponse.json();
      setSessionState({
        connectionId: uuid,
        websocketUrl: connectData.websocket_url,
        status: 'ready',
        error: null
      });
      console.log(connectData);
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        status: 'error',
        error: error.message
      }));
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">      {sessionState.status === 'idle' && (
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <form onSubmit={handleUrlSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wsUrl">
                  Enter WebSocket Tunnel URL
                </Label>
                <Input
                  id="wsUrl"
                  type="text"
                  value={inputUrl}
                  onChange={handleInputChange}
                  placeholder="/websocket-tunnel?uuid=..."
                  required
                />
              </div>
              <Button type="submit">
                Connect to Session
              </Button>
            </form>
          </CardContent>
        </Card>
      )}      {sessionState.status === 'creating' && (
        <div className="text-muted-foreground">
          Connecting to session...
        </div>
      )}
      {sessionState.status === 'error' && (
        <div className="text-destructive">
          Error: {sessionState.error}
        </div>
      )}
      {sessionState.status === 'ready' && sessionState.websocketUrl && (
        <div className="w-full">
          <div className="flex justify-between items-center mb-4">
            <Badge variant="default">Session Ready</Badge>
            <Button
              onClick={handleDisconnect}
              variant="destructive"
            >
             Disconnect
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="w-full h-[600px] rounded-lg overflow-hidden">                <GuacClient
                  query={{
                    uuid: sessionState.connectionId,
                    width: Math.round(window.innerWidth * (window.devicePixelRatio || 1)),
                    height: Math.round(window.innerHeight * (window.devicePixelRatio || 1))
                  }}
                  connectionId={sessionState.connectionId}
                  onDisconnect={handleDisconnect}
                  OfficeSession={false}
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

