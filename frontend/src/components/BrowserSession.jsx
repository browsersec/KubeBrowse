import { useState, useEffect, useCallback, useRef } from 'react';
import GuacClient from './GuacClient';
import SessionReconnectStatus from './SessionReconnectStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// const API_BASE = import.meta.env.VITE_GUAC_CLIENT_URL || `${isSecure ? 'https' : 'http'}://${location.host}`;
// const API_BASE = 'https://152.53.244.80:30006'
// const API_BASE = 'http://localhost:4567'
const API_BASE = '' // Use relative URLs to leverage Vite's proxy

// Session persistence keys
const SESSION_STORAGE_KEY = 'kubeBrowse_browserSession';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

const BrowserSession = () => {
  const [sessionState, setSessionState] = useState({
    connectionId: null,
    websocketUrl: null,
    status: 'idle',
    error: null
  });

  const [reconnectStatus, setReconnectStatus] = useState({
    isReconnecting: false,
    attempts: 0,
    connectionState: 'IDLE'
  });

  const hasRestored = useRef(false);

  // Session persistence functions - memoized with useCallback
  const saveSessionToStorage = useCallback((sessionData) => {
    const sessionInfo = {
      ...sessionData,
      timestamp: Date.now(),
      expiresAt: Date.now() + SESSION_TIMEOUT
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionInfo));
  }, []);

  const loadSessionFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;

      const sessionInfo = JSON.parse(stored);
      
      // Check if session has expired
      if (Date.now() > sessionInfo.expiresAt) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }

      return sessionInfo;
    } catch (error) {
      console.error('Error loading session from storage:', error);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }, []);

  const clearSessionFromStorage = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  // Check for session restoration on component mount
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const uuidFromUrl = urlParams.get('uuid');

    if (uuidFromUrl) {
      // Only join if not already joined
      if (sessionState.connectionId !== uuidFromUrl) {
        joinExistingSession(uuidFromUrl);
      }
    } else {
      const storedSession = loadSessionFromStorage();
      if (storedSession && storedSession.connectionId) {
        if (sessionState.connectionId !== storedSession.connectionId) {
          // Update the URL to include the session UUID
          const newUrl = new URL(window.location);
          newUrl.searchParams.set('uuid', storedSession.connectionId);
          window.history.replaceState({}, '', newUrl);
          setSessionState({
            connectionId: storedSession.connectionId,
            websocketUrl: storedSession.websocketUrl,
            status: 'ready',
            error: null
          });
        }
      }
    }
    // eslint-disable-next-line
  }, []); // <--- NO dependencies except []

  // Save session state changes to localStorage - only when status changes to 'ready'
  useEffect(() => {
    if (sessionState.connectionId && sessionState.status === 'ready') {
      saveSessionToStorage(sessionState);
    }
  }, [sessionState, saveSessionToStorage]);

  const joinExistingSession = useCallback(async (uuid) => {
    try {
      setSessionState(prev => ({ ...prev, status: 'creating', error: null }));
      
      const connectResponse = await fetch(`${API_BASE}/test/connect/${uuid}`);
      if (!connectResponse.ok) {
        throw new Error('Failed to connect to existing session');
      }
      
      const connectData = await connectResponse.json();
      const newSessionState = {
        connectionId: uuid,
        websocketUrl: connectData.websocket_url,
        status: 'ready',
        error: null
      };
      
      setSessionState(newSessionState);
      console.log('Joined existing browser session:', connectData);
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        status: 'error',
        error: error.message
      }));
    }
  }, []);

  const createSession = useCallback(async () => {
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
      const newSessionState = {
        connectionId: data.connection_id,
        websocketUrl: connectData.websocket_url,
        status: 'ready',
        error: null
      };
      setSessionState(newSessionState);
      
      // Update URL to include session UUID for easy sharing and reload persistence
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('uuid', data.connection_id);
      window.history.replaceState({}, '', newUrl);
      
      console.log(connectData)
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        status: 'error',
        error: error.message
      }));
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    if (sessionState.connectionId) {
      // Stop the session
      fetch(`${API_BASE}/sessions/${sessionState.connectionId}/stop`, {
        method: 'DELETE'
      }).catch(console.error);
    }
    
    // Clear session from storage and URL
    clearSessionFromStorage();
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('uuid');
    window.history.replaceState({}, '', newUrl);
    
    console.log("Disconnected")
    setSessionState({
      connectionId: null,
      websocketUrl: null,
      status: 'idle',
      error: null
    });
  }, [sessionState.connectionId, clearSessionFromStorage]);

  const handleConnectionStateChange = useCallback((state, attempts) => {
    setReconnectStatus({
      connectionState: state,
      isReconnecting: state === 'CONNECTING' && attempts > 0,
      attempts: attempts || 0
    });
  }, []);

  const handleManualReconnect = useCallback(() => {
    // Force a page reload to trigger reconnection
    window.location.reload();
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {sessionState.status === 'idle' && (
        <Button onClick={createSession}>
          Create Browser Session
        </Button>
      )}
      {sessionState.status === 'creating' && (
        <div className="text-muted-foreground">
          Creating session...
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
            <Button variant="destructive" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>

          {/* Session Reconnection Status */}
          <SessionReconnectStatus
            connectionState={reconnectStatus.connectionState}
            isReconnecting={reconnectStatus.isReconnecting}
            reconnectAttempts={reconnectStatus.attempts}
            maxReconnectAttempts={10}
            onManualReconnect={handleManualReconnect}
            onDisconnect={handleDisconnect}
          />

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
                  sessionUUID={sessionState.connectionId}
                  onConnectionStateChange={handleConnectionStateChange}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BrowserSession; 