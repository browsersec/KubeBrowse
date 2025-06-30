import { useState } from 'react';
import GuacClient from './GuacClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, X, Globe } from "lucide-react";

// const API_BASE = import.meta.env.VITE_GUAC_CLIENT_URL || `${isSecure ? 'https' : 'http'}://${location.host}`;
// const API_BASE = 'https://152.53.244.80:30006'
// const API_BASE = 'http://localhost:4567'
const API_BASE = '' // Use relative URLs to leverage Vite's proxy

const BrowserSession = () => {
  const [sessionState, setSessionState] = useState({
    connectionId: null,
    websocketUrl: null,
    status: 'idle',
    error: null
  });

  const createSession = async () => {
    try {
      setSessionState(prev => ({ ...prev, status: 'creating', error: null }));
      const response = await fetch(`${API_BASE}/test/deploy-browser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          width: String(window.innerWidth * (window.devicePixelRatio || 1)),
          height: String(window.innerHeight * (window.devicePixelRatio || 1))
        })
      });
      if (!response.ok) {
        throw new Error('Failed to create browser session');
      }
      const data = await response.json();
      const connectResponse = await fetch(`${API_BASE}/test/connect/${data.connection_id}`);
      if (!connectResponse.ok) {
        throw new Error('Failed to get connection URL');
      }
      const connectData = await connectResponse.json();
      setSessionState({
        connectionId: data.connection_id,
        websocketUrl: connectData.websocket_url,
        status: 'ready',
        error: null
      });
      console.log(connectData)
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        status: 'error',
        error: error.message
      }));
    }
  };

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

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {sessionState.status === 'idle' && (
        <Button onClick={createSession} className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Create Browser Session
        </Button>
      )}
      
      {sessionState.status === 'creating' && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating session...
        </div>
      )}
      
      {sessionState.status === 'error' && (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{sessionState.error}</p>
          </CardContent>
        </Card>
      )}
      
      {sessionState.status === 'ready' && sessionState.websocketUrl && (
        <Card className="w-full">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-500">
                  Session Ready
                </Badge>
              </div>
              <Button
                onClick={handleDisconnect}
                variant="destructive"
                size="sm"
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[600px] border rounded-lg overflow-hidden">
              <GuacClient
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
      )}
    </div>
  );
};

export default BrowserSession; 