import { useEffect, useRef, useState, useCallback } from 'react';
import useWebSocket from 'react-use-websocket';
import Guacamole from 'guacamole-common-js';
import states from '../lib/states';
import sessionDuplicator from '../lib/websocketSessionDuplicator';

// Session persistence keys
const SESSION_STORAGE_KEY = 'kubeBrowse_sessionConnection';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

/**
 * A custom hook that integrates react-use-websocket with Guacamole's WebSocketTunnel
 * Supports session sharing when sessionUUID is provided
 * Includes automatic reconnection and session persistence across page reloads
 * 
 * @param {string} wsUrl - The WebSocket URL to connect to
 * @param {string} httpUrl - Fallback HTTP URL if WebSocket is not available
 * @param {boolean} forceHttp - Force using HTTP instead of WebSocket
 * @param {string} queryString - The query string to use for the connection
 * @param {string} sessionUUID - Session UUID for sharing (optional)
 * @param {boolean} enableSharing - Whether to enable session sharing
 * @returns {Object} - The Guacamole client, connection state, and error message
 */
const useGuacWebSocket = (wsUrl, httpUrl, forceHttp = false, queryString = '', sessionUUID = null, enableSharing = false) => {
  const [connectionState, setConnectionState] = useState(states.IDLE);
  const [errorMessage, setErrorMessage] = useState('');
  const [isConnectionUnstable, setIsConnectionUnstable] = useState(false);
  const [sessionInfo, setSessionInfo] = useState({ userCount: 1, isShared: false });  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const clientRef = useRef(null);
  const tunnelRef = useRef(null);
  const sessionConnectionRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const attemptReconnectionRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  
  // Keep reconnectAttemptsRef in sync with state
  useEffect(() => {
    reconnectAttemptsRef.current = reconnectAttempts;
  }, [reconnectAttempts]);
  
  // Session sharing state
  const [isSessionOwner, setIsSessionOwner] = useState(false);

  // Maximum reconnection attempts
  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_BASE_DELAY = 1000;
  
  // Session persistence functions - using useCallback to prevent infinite loops
  const saveSessionToStorage = useCallback((sessionData) => {
    if (!sessionUUID) return;
    
    const sessionInfo = {
      sessionUUID,
      queryString,
      wsUrl,
      httpUrl,
      forceHttp,
      enableSharing,
      timestamp: Date.now(),
      expiresAt: Date.now() + SESSION_TIMEOUT,
      ...sessionData
    };
    localStorage.setItem(`${SESSION_STORAGE_KEY}_${sessionUUID}`, JSON.stringify(sessionInfo));
  }, [sessionUUID, queryString, wsUrl, httpUrl, forceHttp, enableSharing]);

  const loadSessionFromStorage = useCallback(() => {
    if (!sessionUUID) return null;
    
    try {
      const stored = localStorage.getItem(`${SESSION_STORAGE_KEY}_${sessionUUID}`);
      if (!stored) return null;

      const sessionInfo = JSON.parse(stored);
      
      // Check if session has expired
      if (Date.now() > sessionInfo.expiresAt) {
        localStorage.removeItem(`${SESSION_STORAGE_KEY}_${sessionUUID}`);
        return null;
      }

      return sessionInfo;
    } catch (error) {
      console.error('Error loading session from storage:', error);
      localStorage.removeItem(`${SESSION_STORAGE_KEY}_${sessionUUID}`);
      return null;
    }
  }, [sessionUUID]);

  const clearSessionFromStorage = useCallback(() => {
    if (!sessionUUID) return;
    localStorage.removeItem(`${SESSION_STORAGE_KEY}_${sessionUUID}`);
  }, [sessionUUID]);  // Enhanced reconnection logic with session persistence
  const attemptReconnection = useCallback(async () => {
    // Use a ref to get the current value to avoid stale closure
    const currentAttempts = reconnectAttemptsRef.current;
    
    if (currentAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('Maximum reconnection attempts reached');
      setConnectionState(states.TUNNEL_ERROR);
      setErrorMessage('Connection failed after multiple attempts. Please refresh the page.');
      return;
    }

    // Try to load session data from storage for better reconnection
    const storedSession = loadSessionFromStorage();
    if (storedSession) {
      console.log('Using stored session data for reconnection:', storedSession.sessionUUID);
    }

    const delay = RECONNECT_BASE_DELAY * Math.pow(2, currentAttempts); // Exponential backoff
    console.log(`Attempting reconnection ${currentAttempts + 1}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);
    
    setReconnectAttempts(prev => prev + 1);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (queryString && clientRef.current && tunnelRef.current) {
        try {
          // Reinitialize the connection
          setConnectionState(states.CONNECTING);
          clientRef.current.connect(queryString);
        } catch (error) {
          console.error('Reconnection attempt failed:', error);
          // Only attempt another reconnection if we haven't exceeded the limit
          const nextAttempts = currentAttempts + 1;
          if (nextAttempts < MAX_RECONNECT_ATTEMPTS) {
            // Schedule next attempt using setTimeout to avoid immediate recursion
            setTimeout(() => {
              if (attemptReconnectionRef.current) {
                attemptReconnectionRef.current();
              }
            }, 1000);
          } else {
            setConnectionState(states.TUNNEL_ERROR);
            setErrorMessage('Connection failed after multiple attempts. Please refresh the page.');
          }
        }
      }
    }, delay);
  }, [loadSessionFromStorage, queryString]); // Removed reconnectAttempts from dependencies
  
  // Store the reconnection function in a ref to avoid infinite loops
  useEffect(() => {
    attemptReconnectionRef.current = attemptReconnection;
  }, [attemptReconnection]);

  // Reset reconnection attempts on successful connection and save session state
  useEffect(() => {
    if (connectionState === states.CONNECTED) {
      setReconnectAttempts(0);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Save session state to localStorage for persistence
      if (sessionUUID) {
        saveSessionToStorage({
          connectionState: states.CONNECTED,
          lastConnected: Date.now()
        });
      }
    }
  }, [connectionState, sessionUUID, saveSessionToStorage]);
  // Custom WebSocketTunnel implementation that integrates with react-use-websocket
  class ReactWebSocketTunnel extends Guacamole.WebSocketTunnel {
    constructor(url) {
      super(url);
      this.receiveCallback = null;
      /* prevent parent from opening its own socket */
      this.websocket = null;
      this.sessionConnection = null;
      this.reconnectOnClose = true;
      
      // Bind methods to preserve 'this' context
      this.setState = this.setState.bind(this);
      this.handleMessage = this.handleMessage.bind(this);
      this.sendMessage = this.sendMessage.bind(this);
      this.disconnect = this.disconnect.bind(this);
    }
    
    /* override connect so no extra socket is created */
    connect(data) {
      this._setState(Guacamole.Tunnel.State.CONNECTING);
      // If session sharing is enabled, create session duplicator connection
      if (enableSharing && sessionUUID) {
        this.connectWithSharing(data);
      }
      // react-use-websocket will now drive OPEN/CLOSED events for regular connections
    }
    
    /* Connect with session sharing support */
    connectWithSharing(data) {
      const isOwner = !this.sessionConnection; // First connection in this client is owner
      
      this.sessionConnection = sessionDuplicator.createSession(sessionUUID, {
        isOwner: isOwner,
        onMessage: (message) => {
          if (this.receiveCallback) {
            this.receiveCallback(message);
          }
        },
        onUserCountChange: (count) => {
          setSessionInfo(prev => ({ ...prev, userCount: count, isShared: count > 1 }));
        },
        onUserJoin: (data) => {
          console.log('User joined session:', data);
        },
        onUserLeave: (data) => {
          console.log('User left session:', data);
        }
      });
      
      setIsSessionOwner(isOwner);
      sessionConnectionRef.current = this.sessionConnection;
      
      // Send initial connection data if provided
      if (data) {
        this.sessionConnection.sendMessage(data);
      }
      
      // Set tunnel state to open since session duplicator handles the connection
      this._setState(Guacamole.Tunnel.State.OPEN);
    }
    
    /* outgoing traffic uses appropriate connection method */
    sendMessage(msg) {
      if (this.sessionConnection) {
        // Use session duplicator for shared sessions
        this.sessionConnection.sendMessage(msg);
      } else if (this.webSocketRef && this.webSocketRef.sendMessage) {
        // Use react-use-websocket for regular connections
        this.webSocketRef.sendMessage(msg);
      }
    }
    
    setWebSocketRef(ref) {
      this.webSocketRef = ref;
    }
    
    setReceiveCallback(callback) {
      this.receiveCallback = callback;
    }
    
    handleMessage(event) {
      if (this.receiveCallback) {
        this.receiveCallback(event.data);
      }
    }
      setState(state) {
      this._setState(state);
    }
    
    // Override the parent's _setState method to ensure it's available
    _setState(state) {
      // Call parent implementation if it exists
      if (super._setState) {
        super._setState(state);
      } else {
        // Fallback implementation for state management
        this.state = state;
        // Trigger any necessary state change handlers
        if (this.onstatechange) {
          this.onstatechange(state);
        }
      }
    }
    
    disconnect() {
      this.reconnectOnClose = false;
      if (this.sessionConnection) {
        this.sessionConnection.disconnect();
      }
      super.disconnect();
    }
  }
  // Initialize the tunnel based on browser capabilities and settings
  const initializeTunnel = useCallback(() => {
    if (window.WebSocket && !forceHttp) {
      const tunnel = new ReactWebSocketTunnel(wsUrl);
      tunnelRef.current = tunnel;
      return tunnel;
    } else {
      const tunnel = new Guacamole.HTTPTunnel(httpUrl, true);
      tunnelRef.current = tunnel;
      return tunnel;
    }
  }, [wsUrl, httpUrl, forceHttp]);
    // Initialize session on mount - check for existing session on page reload
  useEffect(() => {
    if (sessionUUID) {
      const storedSession = loadSessionFromStorage();
      if (storedSession) {
        console.log('Restoring session from storage on page load:', storedSession.sessionUUID);
        
        // Check if the stored session is still valid (within timeout)
        const timeSinceLastConnection = Date.now() - (storedSession.lastConnected || storedSession.timestamp);
        if (timeSinceLastConnection < SESSION_TIMEOUT) {
          console.log('Session is still valid, will attempt automatic reconnection');
          // Set the connection state to indicate we're restoring from storage
          setConnectionState(states.CONNECTING);
          setErrorMessage('Restoring session...');
        } else {
          console.log('Session has expired, clearing from storage');
          clearSessionFromStorage();
        }
      }
    }
  }, [sessionUUID, loadSessionFromStorage, clearSessionFromStorage]);

  // Setup the Guacamole client when the component mounts or when the queryString changes
  useEffect(() => {
    if (!queryString) return;

    const tunnel = initializeTunnel();

    tunnel.onerror = (status) => {      console.error(`Tunnel failed ${JSON.stringify(status)}`);
      setConnectionState(states.TUNNEL_ERROR);
      setErrorMessage(status.message || 'WebSocket tunnel error');
      setIsConnectionUnstable(false);
      
      // Attempt reconnection if this wasn't a deliberate disconnect
      if (tunnel.reconnectOnClose !== false && sessionUUID) {
        if (attemptReconnectionRef.current) {
          attemptReconnectionRef.current();
        }
      }
    };

    tunnel.onstatechange = (state) => {
      switch (state) {
        case Guacamole.Tunnel.State.CONNECTING:
          setConnectionState(states.CONNECTING);
          setIsConnectionUnstable(false);
          break;
        case Guacamole.Tunnel.State.OPEN:
          setConnectionState(states.CONNECTED);
          setIsConnectionUnstable(false);
          setErrorMessage(''); // Clear any previous errors
          setReconnectAttempts(0); // Reset reconnection attempts on successful connection
          break;
        case Guacamole.Tunnel.State.UNSTABLE:
          // Handle unstable connection - try to recover
          console.warn('WebSocket connection is unstable - attempting recovery');
          setIsConnectionUnstable(true);
          // Give it some time to recover before considering it failed
          setTimeout(() => {            if (tunnelRef.current && tunnelRef.current.currentState === Guacamole.Tunnel.State.UNSTABLE) {
              console.warn('Connection remained unstable, attempting reconnection');
              if (sessionUUID) {
                if (attemptReconnectionRef.current) {
                  attemptReconnectionRef.current();
                }
              } else {
                setConnectionState(states.TUNNEL_ERROR);
                setErrorMessage('Connection became unstable and could not recover');
              }
            }
          }, 5000);
          break;
        case Guacamole.Tunnel.State.CLOSED:
          setConnectionState(states.DISCONNECTED);
          setIsConnectionUnstable(false);
            // Attempt reconnection if this wasn't a deliberate disconnect and we have a session UUID
          if (tunnel.reconnectOnClose !== false && sessionUUID) {
            console.log('Connection closed unexpectedly, attempting reconnection...');
            if (attemptReconnectionRef.current) {
              attemptReconnectionRef.current();
            }
          }
          break;
        default:
          break;
      }
    };

    const client = new Guacamole.Client(tunnel);
    clientRef.current = client;

    client.onerror = (error) => {
      console.error(`Client error ${JSON.stringify(error)}`);
      setErrorMessage(error.message || 'Client error occurred');
      setConnectionState(states.CLIENT_ERROR);
        // Attempt reconnection for certain error types
      if (sessionUUID && (error.code === 0x0202 || error.code === 0x0203)) {
        console.log('Client error indicates network issue, attempting reconnection...');
        if (attemptReconnectionRef.current) {
          attemptReconnectionRef.current();
        }
      }
    };

    client.onstatechange = (clientState) => {
      switch (clientState) {
        case 0: // IDLE
          setConnectionState(states.IDLE);
          break;
        case 2: // WAITING
          setConnectionState(states.WAITING);
          break;
        case 3: // CONNECTED
          setConnectionState(states.CONNECTED);
          setReconnectAttempts(0); // Reset reconnection attempts on successful client connection
          break;
        default:
          break;
      }
    };

    // Connect with the query string
    if (queryString) {
      try {
        client.connect(queryString);
      } catch (error) {
        console.error('Failed to connect client:', error);
        setConnectionState(states.CLIENT_ERROR);
        setErrorMessage('Failed to establish connection');
          // Attempt reconnection if we have a session UUID
        if (sessionUUID) {
          if (attemptReconnectionRef.current) {
            attemptReconnectionRef.current();
          }
        }
      }
    }    return () => {
      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (client) {
        try {
          client.disconnect();
        } catch (error) {
          console.warn('Error during client disconnect:', error);
        }
      }
      if (tunnelRef.current) {
        try {
          // Mark as deliberate disconnect to prevent reconnection
          if (tunnelRef.current.reconnectOnClose !== undefined) {
            tunnelRef.current.reconnectOnClose = false;
          }
          if (tunnelRef.current.disconnect) {
            tunnelRef.current.disconnect();
          }
        } catch (error) {
          console.warn('Error during tunnel disconnect:', error);
        }
      }
      // Clean up session connection
      if (sessionConnectionRef.current) {
        try {
          sessionConnectionRef.current.disconnect();
        } catch (error) {
          console.warn('Error during session disconnect:', error);
        }
      }
      
      // Only clear session from storage if this is a deliberate disconnect
      // (not a page reload or accidental disconnect)
      // Session will be preserved for automatic reconnection on page reload
    };
  }, [wsUrl, httpUrl, forceHttp, queryString, sessionUUID, enableSharing, initializeTunnel]);
  // Use react-use-websocket if we're using WebSocket tunnel and NOT using session sharing
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    !forceHttp && !enableSharing && tunnelRef.current instanceof ReactWebSocketTunnel ? wsUrl : null,
    {
      onOpen: () => {
        console.log('WebSocket connection established');
        if (tunnelRef.current instanceof ReactWebSocketTunnel) {
          tunnelRef.current.setState(Guacamole.Tunnel.State.OPEN);
        }
        setReconnectAttempts(0); // Reset reconnection attempts
      },
      onClose: (event) => {
        console.log('WebSocket connection closed', event.code, event.reason);
        if (tunnelRef.current instanceof ReactWebSocketTunnel) {
          // Only set to closed if it wasn't a clean disconnect
          if (event.code !== 1000) {
            tunnelRef.current.setState(Guacamole.Tunnel.State.CLOSED);
              // Attempt reconnection if we have a session UUID and this wasn't deliberate
            if (sessionUUID && tunnelRef.current.reconnectOnClose !== false) {
              console.log('WebSocket closed unexpectedly, attempting reconnection...');
              if (attemptReconnectionRef.current) {
                attemptReconnectionRef.current();
              }
            }
          }
        }
      },
      onError: (event) => {
        console.error('WebSocket error:', event);
        if (tunnelRef.current instanceof ReactWebSocketTunnel) {
          tunnelRef.current.setState(Guacamole.Tunnel.State.CLOSED);
          if (tunnelRef.current.onerror) {
            tunnelRef.current.onerror({ 
              code: 514, 
              message: 'WebSocket connection error' 
            });
          }
            // Attempt reconnection for WebSocket errors if we have a session UUID
          if (sessionUUID && tunnelRef.current.reconnectOnClose !== false) {
            console.log('WebSocket error occurred, attempting reconnection...');
            if (attemptReconnectionRef.current) {
              attemptReconnectionRef.current();
            }
          }
        }
      },
      onMessage: (event) => {
        if (tunnelRef.current instanceof ReactWebSocketTunnel) {
          tunnelRef.current.handleMessage(event);
        }
      },
      shouldReconnect: (closeEvent) => {
        // Let our custom reconnection logic handle this
        return false;
      },
      reconnectAttempts: 0, // Disable built-in reconnection
      retryOnError: false, // Don't retry on error, handle manually
      share: false // Don't share WebSocket connections
    }
  );

  // Integrate the WebSocket reference with our tunnel (only for non-shared sessions)
  useEffect(() => {
    if (tunnelRef.current instanceof ReactWebSocketTunnel && !enableSharing) {
      tunnelRef.current.setWebSocketRef({ sendMessage });
    }
  }, [sendMessage, enableSharing]);

  // Handle incoming messages from react-use-websocket (only for non-shared sessions)
  useEffect(() => {
    if (lastMessage && tunnelRef.current instanceof ReactWebSocketTunnel && !enableSharing) {
      tunnelRef.current.handleMessage(lastMessage);
    }
  }, [lastMessage, enableSharing]);

  // Functions for session sharing
  const enableSessionSharing = async () => {
    if (!sessionUUID) return false;
    
    try {
      const response = await fetch(`/test/share/${sessionUUID}`, {
        method: 'GET'
      });
      
      if (response.ok) {
        setIsSessionOwner(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to enable sharing:', error);
      return false;
    }
  };
  const getShareUrl = () => {
    if (!sessionUUID) return null;
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    return `${baseUrl}/share-ws-url?uuid=${sessionUUID}`;
  };
  // Function to manually clear session (for intentional disconnects)
  const clearSession = useCallback(() => {
    if (sessionUUID) {
      clearSessionFromStorage();
    }
  }, [sessionUUID, clearSessionFromStorage]);

  return {
    client: clientRef.current,
    connectionState,
    errorMessage,
    readyState: enableSharing ? (sessionConnectionRef.current?.isConnected() ? WebSocket.OPEN : WebSocket.CLOSED) : readyState,
    isConnectionUnstable,
    reconnectAttempts,
    
    // Session sharing info
    sessionInfo,
    isSessionOwner,
    sessionUUID,
    enableSharing,
    enableSessionSharing,
    getShareUrl,
    clearSession
  };
};

export default useGuacWebSocket;
