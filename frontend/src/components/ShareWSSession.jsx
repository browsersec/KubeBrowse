import { useState } from 'react';
import GuacClient from './GuacClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Share2, AlertCircle } from "lucide-react";

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
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Join Shared Session</h2>
        <p className="text-muted-foreground">
          Enter the connection ID to join an existing session.
        </p>
      </div>
      
      {sessionState.status === 'idle' && (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Connect to Session
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          <Loader2 className="h-5 w-5 animate-spin" />
          Connecting to shared session...
        </div>
      )}
      
      {sessionState.status === 'error' && (
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Connection Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive mb-4">
              {sessionState.error}
            </p>
            <Button 
              onClick={() => setSessionState(prev => ({...prev, status: 'idle'}))}
              variant="outline"
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      )}
      
      {sessionState.status === 'ready' && sessionState.connectionId && (
        <Card className="w-full">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-500">
                  Connected
                </Badge>
                <div>
                  <h3 className="font-medium">{sessionState.name || 'Shared Session'}</h3>
                  <p className="text-xs text-muted-foreground">
                    Connected to: {sessionState.connectionId}
                  </p>
                </div>
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
                sharing={true}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShareWSSession;

