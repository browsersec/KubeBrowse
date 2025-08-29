'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import GuacClient from './GuacClient';
import SessionReconnectStatus from './SessionReconnectStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

const API_BASE = '' // Use relative URLs to leverage Next.js proxy

// Session persistence keys
const SESSION_STORAGE_KEY = 'kubeBrowse_sharedSession';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

interface SessionState {
  connectionId: string | null;
  status: 'idle' | 'creating' | 'ready' | 'error';
  error: string | null;
  name: string;
}

interface ReconnectStatus {
  isReconnecting: boolean;
  attempts: number;
  connectionState: string;
}

const ShareWSSession = () => {
  const [sessionState, setSessionState] = useState<SessionState>({
    connectionId: null,
    status: 'idle',
    error: null,
    name: ''
  });
  const [inputUuid, setInputUuid] = useState('');
  const [sessionName, setSessionName] = useState('');
  const hasRestored = useRef(false);

  const [reconnectStatus, setReconnectStatus] = useState<ReconnectStatus>({
    isReconnecting: false,
    attempts: 0,
    connectionState: 'IDLE'
  });

  // Session persistence functions
  const saveSessionToStorage = useCallback((sessionData: Partial<SessionState>) => {
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

  // Restore session on mount
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const uuidFromUrl = urlParams.get('uuid');

    const restoreSession = (sessionData: any) => {
      if (sessionState.connectionId !== sessionData.connectionId) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('uuid', sessionData.connectionId);
        window.history.replaceState({}, '', newUrl);
        setSessionState({
          connectionId: sessionData.connectionId,
          name: sessionData.name || `Shared Session: ${sessionData.connectionId.substring(0, 8)}`,
          status: 'ready',
          error: null
        });
      }
    };

    if (uuidFromUrl) {
      const storedSession = loadSessionFromStorage();
      // Restore from URL, use stored name if available for the same session
      const name = (storedSession && storedSession.connectionId === uuidFromUrl) ? storedSession.name : '';
      restoreSession({ connectionId: uuidFromUrl, name });
    } else {
      const storedSession = loadSessionFromStorage();
      if (storedSession && storedSession.connectionId) {
        restoreSession(storedSession);
      }
    }
  }, []); // Run only on mount

  // Save session to storage when it becomes ready
  useEffect(() => {
    if (sessionState.status === 'ready' && sessionState.connectionId) {
      saveSessionToStorage(sessionState);
    }
  }, [sessionState, saveSessionToStorage]);

  const handleDisconnect = useCallback(() => {
    clearSessionFromStorage();
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('uuid');
    window.history.replaceState({}, '', newUrl);

    console.log("Disconnected from shared session");
    setSessionState({
      connectionId: null,
      status: 'idle',
      error: null,
      name: ''
    });
    setInputUuid('');
    setSessionName('');
  }, [clearSessionFromStorage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputUuid(e.target.value);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSessionName(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSessionState(prev => ({ ...prev, status: 'creating', error: null }));
      
      // Just take the UUID directly, no parsing
      const uuid = inputUuid.trim();
      
      // Validate UUID format
      if (!uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new Error('Invalid UUID format. Please enter a valid connection ID.');
      }
      
      const newSessionName = sessionName || `Shared Session: ${uuid.substring(0, 8)}`;
      // Set the connection state with the UUID
      setSessionState({
        connectionId: uuid,
        status: 'ready',
        error: null,
        name: newSessionName
      });

      // Update URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('uuid', uuid);
      window.history.replaceState({}, '', newUrl);

      console.log("Ready to connect with UUID:", uuid);
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        status: 'error',
        error: (error as Error).message
      }));
    }
  };

  const handleConnectionStateChange = useCallback((state: string, attempts: number) => {
    setReconnectStatus({
      connectionState: state,
      isReconnecting: state === 'CONNECTING' && attempts > 0,
      attempts: attempts || 0
    });
  }, []);

  const handleManualReconnect = useCallback(() => {
    window.location.reload();
  }, []);

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
                onClick={() => {
                  setSessionState({ connectionId: null, status: 'idle', error: null, name: '' });
                  setInputUuid('');
                  setSessionName('');
                }}
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
                  onReconnect={handleManualReconnect}
                  OfficeSession={false}
                  sharing={true}
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

export default ShareWSSession;