import { useState, useEffect } from 'react';
import GuacClient from './GuacClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Share2 } from 'lucide-react';

const API_BASE = '' // Use relative URLs to leverage Vite's proxy

// Session persistence keys
const SHARED_SESSION_STORAGE_KEY = 'kubeBrowse_sharedSession';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

const ShareWSSession = () => {
  const [sessionState, setSessionState] = useState({
    connectionId: null,
    websocketUrl: null,
    status: 'idle',
    error: null,
    sessionUUID: null
  });
  const [inputUrl, setInputUrl] = useState('');
  
  // Session persistence functions
  const saveSessionToStorage = (sessionData) => {
    const sessionInfo = {
      ...sessionData,
      timestamp: Date.now(),
      expiresAt: Date.now() + SESSION_TIMEOUT
    };
    localStorage.setItem(SHARED_SESSION_STORAGE_KEY, JSON.stringify(sessionInfo));
  };

  const loadSessionFromStorage = () => {
    try {
      const stored = localStorage.getItem(SHARED_SESSION_STORAGE_KEY);
      if (!stored) return null;

      const sessionInfo = JSON.parse(stored);
      
      // Check if session has expired
      if (Date.now() > sessionInfo.expiresAt) {
        localStorage.removeItem(SHARED_SESSION_STORAGE_KEY);
        return null;
      }

      return sessionInfo;
    } catch (error) {
      console.error('Error loading shared session from storage:', error);
      localStorage.removeItem(SHARED_SESSION_STORAGE_KEY);
      return null;
    }
  };

  const clearSessionFromStorage = () => {
    localStorage.removeItem(SHARED_SESSION_STORAGE_KEY);
  };

  // Auto-detect UUID from URL on component mount or restore from storage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const uuidFromUrl = urlParams.get('uuid');
    
    if (uuidFromUrl) {
      console.log('Auto-detected session UUID from URL:', uuidFromUrl);
      setInputUrl(`/websocket-tunnel?uuid=${uuidFromUrl}`);
      // Auto-connect to the session
      connectToSession(uuidFromUrl);
    } else {
      // Try to restore session from localStorage
      const storedSession = loadSessionFromStorage();
      if (storedSession && storedSession.connectionId) {
        console.log('Restoring shared session from storage:', storedSession.connectionId);
        // Update the URL to include the session UUID
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('uuid', storedSession.connectionId);
        window.history.replaceState({}, '', newUrl);
        
        // Restore the session state and auto-connect
        setSessionState({
          connectionId: storedSession.connectionId,
          websocketUrl: storedSession.websocketUrl,
          status: 'ready',
          error: null,
          sessionUUID: storedSession.sessionUUID || storedSession.connectionId
        });
        setInputUrl(`/websocket-tunnel?uuid=${storedSession.connectionId}`);
      }
    }
  }, []);

  // Save session state changes to localStorage
  useEffect(() => {
    if (sessionState.connectionId && sessionState.status === 'ready') {
      saveSessionToStorage(sessionState);
    }
  }, [sessionState]);

  const connectToSession = async (uuid) => {
    try {
      setSessionState(prev => ({ ...prev, status: 'creating', error: null }));
      
      if (!uuid || uuid.length < 10) {
        throw new Error('Invalid UUID: Must be at least 10 characters');
      }
      
      // Add a small delay to ensure any previous connections are cleaned up
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get connection details using the extracted UUID
      const connectResponse = await fetch(`${API_BASE}/test/connect/${uuid}`);
      if (!connectResponse.ok) {
        const errorText = await connectResponse.text();
        throw new Error(`Failed to get connection URL: ${connectResponse.status} ${errorText}`);
      }
      
      const connectData = await connectResponse.json();
      const newSessionState = {
        connectionId: uuid,
        websocketUrl: connectData.websocket_url,
        status: 'ready',
        error: null,
        sessionUUID: uuid
      };
      
      setSessionState(newSessionState);
      
      // Update URL to include session UUID for easy sharing and reload persistence
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('uuid', uuid);
      window.history.replaceState({}, '', newUrl);
      
      console.log('Connected to shared session:', connectData);
    } catch (error) {
      console.error('Connection error:', error);
      setSessionState(prev => ({
        ...prev,
        status: 'error',
        error: error.message
      }));
    }
  };
  const handleDisconnect = async () => {
    if (sessionState.connectionId) {
      // Stop the session with better error handling
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const response = await fetch(`${API_BASE}/sessions/${sessionState.connectionId}/stop`, {
          method: 'DELETE',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok && response.status !== 404) {
          console.warn('Failed to stop session:', response.status);
        }
      } catch (error) {
        // Only log as warning if it's a network error (server down)
        if (error.name === 'AbortError') {
          console.warn('Session stop request timed out - server may be unreachable');
        } else if (error.message.includes('Failed to fetch')) {
          console.warn('Cannot reach server to stop session - this is normal if server is down');
        } else {
          console.warn('Error stopping session:', error);
        }
      }
    }
    
    // Clear session from storage and URL
    clearSessionFromStorage();
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('uuid');
    window.history.replaceState({}, '', newUrl);
    
    console.log("Disconnected from shared session")
    setSessionState({
      connectionId: null,
      websocketUrl: null,
      status: 'idle',
      error: null,
      sessionUUID: null
    });
  };

  const handleInputChange = (e) => {
    setInputUrl(e.target.value);
  };
  
  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    try {
      // Extract UUID from input URL
      let uuid;
      try {
        if (inputUrl.includes('uuid=')) {
          // Handle both full URLs and query strings
          const url = inputUrl.startsWith('http') ? new URL(inputUrl) : new URL(inputUrl, window.location.origin);
          uuid = url.searchParams.get('uuid');
        } else {
          // Maybe it's just the UUID
          uuid = inputUrl.trim();
        }
      } catch (urlError) {
        // Try to extract UUID from string directly
        const uuidMatch = inputUrl.match(/uuid=([a-f0-9-]+)/i);
        if (uuidMatch) {
          uuid = uuidMatch[1];
        } else {
          uuid = inputUrl.trim();
        }
      }
      
      await connectToSession(uuid);
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
      {/* Header with session info */}
      {sessionState.sessionUUID && (
        <Alert className="w-full max-w-2xl">
          <Share2 className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                Joining shared session: <strong>{sessionState.sessionUUID.slice(0, 8)}...</strong>
              </span>
              <Badge variant="secondary" className="ml-2">
                <Users className="w-3 h-3 mr-1" />
                Collaborative Session
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {sessionState.status === 'idle' && (
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <form onSubmit={handleUrlSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wsUrl">
                  Enter Session URL or UUID
                </Label>
                <Input
                  id="wsUrl"
                  type="text"
                  value={inputUrl}
                  onChange={handleInputChange}
                  placeholder="https://example.com/share-ws-url?uuid=... or just the UUID"
                  required
                />
                <div className="text-xs text-muted-foreground">
                  You can paste a full share URL or just the session UUID
                </div>
              </div>
              <Button type="submit">
                Connect to Session
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {sessionState.status === 'creating' && (
        <div className="text-muted-foreground">
          Connecting to shared session...
        </div>
      )}

      {sessionState.status === 'error' && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-destructive">
            Error: {sessionState.error}
          </div>
          <Button variant="outline" onClick={() => setSessionState(prev => ({ ...prev, status: 'idle', error: null }))}>
            Try Again
          </Button>
        </div>
      )}

      {sessionState.status === 'ready' && sessionState.websocketUrl && (
        <div className="w-full">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="default">
                <Users className="w-3 h-3 mr-1" />
                Shared Session Active
              </Badge>
              <Badge variant="outline">
                Guest Mode
              </Badge>
            </div>
            <Button
              onClick={handleDisconnect}
              variant="destructive"
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
                  sessionUUID={sessionState.sessionUUID}
                  enableSharing={true}
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
