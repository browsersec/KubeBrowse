import { useState, useEffect } from "react";
import GuacClient from "./GuacClient";
import SessionReconnectStatus from "./SessionReconnectStatus";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Share2, Users, ExternalLink, Check } from 'lucide-react';

const API_BASE = ""; // Use relative URLs to leverage Vite's proxy

// Session persistence keys
const SESSION_STORAGE_KEY = 'kubeBrowse_officeSession';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

const OfficeSession = () => {  const [sessionState, setSessionState] = useState({
    connectionId: null,
    websocketUrl: null,
    status: "idle",
    error: null,
    isShared: false,
    shareUrl: null,
    sharingEnabled: false
  });
  const [copySuccess, setCopySuccess] = useState(false);
  const [joinSessionId, setJoinSessionId] = useState('');
  const [reconnectStatus, setReconnectStatus] = useState({
    isReconnecting: false,
    attempts: 0,
    connectionState: 'IDLE'
  });
  
  // Session persistence functions
  const saveSessionToStorage = (sessionData) => {
    const sessionInfo = {
      ...sessionData,
      timestamp: Date.now(),
      expiresAt: Date.now() + SESSION_TIMEOUT
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionInfo));
  };

  const loadSessionFromStorage = () => {
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
  };

  const clearSessionFromStorage = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  // Check for session restoration on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const uuidFromUrl = urlParams.get('uuid');
    
    if (uuidFromUrl) {
      console.log('Joining existing office session from URL:', uuidFromUrl);
      joinExistingSession(uuidFromUrl);
    } else {      // Try to restore session from localStorage
      const storedSession = loadSessionFromStorage();
      if (storedSession && storedSession.connectionId) {
        console.log('Restoring office session from storage:', storedSession.connectionId);
        // Update the URL to include the session UUID
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('uuid', storedSession.connectionId);
        window.history.replaceState({}, '', newUrl);
        
        // Restore the session state
        setSessionState({
          connectionId: storedSession.connectionId,
          websocketUrl: storedSession.websocketUrl,
          status: 'ready',
          error: null,
          isShared: storedSession.isShared || false,
          shareUrl: storedSession.shareUrl || `${window.location.protocol}//${window.location.host}${window.location.pathname}?uuid=${storedSession.connectionId}`,
          sharingEnabled: storedSession.sharingEnabled || false
        });
      }
    }
  }, []);

  // Save session state changes to localStorage
  useEffect(() => {
    if (sessionState.connectionId && sessionState.status === 'ready') {
      saveSessionToStorage(sessionState);
    }
  }, [sessionState]);

  const joinExistingSession = async (uuid) => {
    try {
      setSessionState(prev => ({ ...prev, status: 'creating', error: null }));
      
      const connectResponse = await fetch(`${API_BASE}/test/connect/${uuid}`);
      if (!connectResponse.ok) {
        throw new Error('Failed to connect to shared session');
      }
      
      const connectData = await connectResponse.json();
      const newSessionState = {
        connectionId: uuid,
        websocketUrl: connectData.websocket_url,
        status: 'ready',
        error: null,
        isShared: true,
        shareUrl: `${window.location.protocol}//${window.location.host}${window.location.pathname}?uuid=${uuid}`,
        sharingEnabled: true
      };
      
      setSessionState(newSessionState);
      console.log('Joined shared office session:', connectData);
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        status: 'error',
        error: error.message
      }));
    }
  };

  const createSession = async () => {
    try {
      setSessionState((prev) => ({ ...prev, status: "creating", error: null }));
      const response = await fetch(`${API_BASE}/test/deploy-office`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          width: String(window.innerWidth * (window.devicePixelRatio || 1)),
          height: String(window.innerHeight * (window.devicePixelRatio || 1)),
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create office session");
      }
      const data = await response.json();
      const connectResponse = await fetch(
        `${API_BASE}/test/connect/${data.connection_id}`
      );
      if (!connectResponse.ok) {
        throw new Error("Failed to get connection URL");
      }
      
      const connectData = await connectResponse.json();
      const newSessionState = {
        connectionId: data.connection_id,
        websocketUrl: connectData.websocket_url,
        status: "ready",
        error: null,
        isShared: false,
        shareUrl: `${window.location.protocol}//${window.location.host}${window.location.pathname}?uuid=${data.connection_id}`,
        sharingEnabled: false
      };
      
      setSessionState(newSessionState);
      
      // Update URL to include session UUID for easy sharing and reload persistence
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('uuid', data.connection_id);
      window.history.replaceState({}, '', newUrl);
      
      console.log(connectData);
    } catch (error) {
      setSessionState((prev) => ({
        ...prev,
        status: "error",
        error: error.message,
      }));
    }
  };

  const enableSharing = async () => {
    if (!sessionState.connectionId) return;
    
    try {
      setSessionState(prev => ({ ...prev, sharingEnabled: true }));
      console.log('Office session sharing enabled for:', sessionState.connectionId);
    } catch (error) {
      console.error('Failed to enable sharing:', error);
      setSessionState(prev => ({ ...prev, sharingEnabled: false }));
    }
  };

  const copyShareUrl = async () => {
    if (!sessionState.shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(sessionState.shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };
  const joinSession = async () => {
    if (!joinSessionId.trim()) return;
    await joinExistingSession(joinSessionId.trim());
  };
  const handleDisconnect = () => {
    if (sessionState.connectionId) {
      // Stop the session
      fetch(`${API_BASE}/sessions/${sessionState.connectionId}/stop`, {
        method: "DELETE",
      }).catch(console.error);
    }
    
    // Clear session from storage and URL
    clearSessionFromStorage();
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('uuid');
    window.history.replaceState({}, '', newUrl);
    
    console.log("Disconnected");
    setSessionState({
      connectionId: null,
      websocketUrl: null,
      status: "idle",
      error: null,
      isShared: false,
      shareUrl: null,
      sharingEnabled: false
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {sessionState.status === "idle" && (
        <div className="w-full max-w-md space-y-4">
          <Button 
            onClick={createSession}
            className="w-full"
            size="lg"
          >
            Create Office Session
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or join existing session
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="join-office-session">Session ID</Label>
            <div className="flex gap-2">
              <Input
                id="join-office-session"
                placeholder="Enter session ID..."
                value={joinSessionId}
                onChange={(e) => setJoinSessionId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinSession()}
              />
              <Button 
                onClick={joinSession}
                disabled={!joinSessionId.trim()}
                variant="outline"
              >
                Join
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {sessionState.status === "creating" && (
        <div className="text-muted-foreground">
          {sessionState.isShared ? 'Joining session...' : 'Creating session...'}
        </div>
      )}
      
      {sessionState.status === "error" && (
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            {sessionState.error}
          </AlertDescription>
        </Alert>
      )}
      
      {sessionState.status === "ready" && sessionState.websocketUrl && (
        <div className="w-full">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="default">
                <Users className="w-3 h-3 mr-1" />
                {sessionState.isShared ? 'Shared Office Session' : 'Office Session Ready'}
              </Badge>
              {sessionState.isShared && (
                <Badge variant="secondary">
                  Collaborative
                </Badge>
              )}
            </div>
            <Button variant="destructive" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>

          {/* Session Sharing Controls */}
          {!sessionState.isShared && (
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Session Sharing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!sessionState.sharingEnabled ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Enable sharing to allow others to join this office session
                    </p>
                    <Button 
                      onClick={enableSharing}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Enable Sharing
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="office-share-url" className="text-sm font-medium">
                      Share URL
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="office-share-url"
                        value={sessionState.shareUrl}
                        readOnly
                        className="text-xs"
                      />
                      <Button
                        onClick={copyShareUrl}
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                      >                        {copySuccess ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    {copySuccess && (
                      <p className="text-xs text-green-600">
                        Share URL copied to clipboard!
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>          )}

          {/* Session Reconnection Status */}
          <SessionReconnectStatus
            connectionState={reconnectStatus.connectionState}
            isReconnecting={reconnectStatus.isReconnecting}
            reconnectAttempts={reconnectStatus.attempts}
            maxReconnectAttempts={10}
            onManualReconnect={() => {
              // Force a page reload to trigger reconnection
              window.location.reload();
            }}
            onDisconnect={handleDisconnect}
          />

          <Card>
            <CardContent className="p-0">
              <div className="w-full h-[600px] rounded-lg overflow-hidden">
                <GuacClient
                  query={{
                    uuid: sessionState.connectionId,
                    width: Math.round(
                      window.innerWidth * (window.devicePixelRatio || 1)
                    ),
                    height: Math.round(
                      window.innerHeight * (window.devicePixelRatio || 1)
                    ),
                  }}
                  connectionId={sessionState.connectionId}
                  onDisconnect={handleDisconnect}
                  sessionUUID={sessionState.connectionId}
                  enableSharing={sessionState.sharingEnabled}
                  onConnectionStateChange={(state, attempts) => {
                    setReconnectStatus({
                      connectionState: state,
                      isReconnecting: state === 'CONNECTING' && attempts > 0,
                      attempts: attempts || 0
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OfficeSession;
