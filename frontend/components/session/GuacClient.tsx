'use client';

import Guacamole from 'guacamole-common-js';
import { useEffect, useRef, useState } from 'react';
import clipboard from '../../lib/guac/clipboard';
import GuacMouse from '../../lib/guac/GuacMouse';
import { states } from '../../lib/guac/states';
import Modal from './Modal';
import WebSocketControl from './WebSocketControl';
import useGuacWebSocket from '../../hooks/useGuacWebSocket';
import { Toaster } from 'react-hot-toast';

// Set custom Mouse implementation
(Guacamole as any).Mouse = GuacMouse.mouse;

// Define websocket and HTTP tunnel URLs
const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
const wsUrl = typeof window !== 'undefined' ? `${isSecure ? 'wss' : 'ws'}://${location.host}/websocket-tunnel` : '';
const wsSharedUrl = typeof window !== 'undefined' ? `${isSecure ? 'wss' : 'ws'}://${location.host}/websocket-tunnel/share` : '';
const httpUrl = typeof window !== 'undefined' ? `${isSecure ? 'https' : 'http'}://${location.host}/tunnel` : '';

// Convert query object to query string
const buildQueryString = (queryObj: Record<string, any>): string => {
  if (!queryObj || typeof queryObj !== 'object') return '';
  
  const params = new URLSearchParams();
  
  for (const [key, value] of Object.entries(queryObj)) {
    if (value !== undefined && value !== null) {
      params.append(key, value.toString());
    }
  }
  
  return params.toString();
};

interface GuacClientProps {
  query: Record<string, any>;
  forceHttp?: boolean;
  onDisconnect?: () => void;
  onReconnect?: () => void;
  connectionId: string | null;
  OfficeSession?: boolean;
  sharing?: boolean;
  sessionUUID?: string | null;
  enableSharing?: boolean;
  onConnectionStateChange?: (state: string, attempts: number) => void;
}

function GuacClient({ 
  query, 
  forceHttp = false, 
  onDisconnect, 
  onReconnect,
  connectionId, 
  OfficeSession = true, 
  sharing = false,
  sessionUUID,
  enableSharing = false,
  onConnectionStateChange
}: GuacClientProps) {
  const [connected, setConnected] = useState(false);
  
  // Guard clause for null connectionId
  if (!connectionId) {
    return <div className="relative w-full h-full flex items-center justify-center">
      <p className="text-muted-foreground">No connection ID provided</p>
    </div>;
  }
  
  // Convert query object to proper query string
  const queryString = buildQueryString(query);
  
  // Check if we are sharing a session
  const wsUrlToUse = sharing ? wsSharedUrl : wsUrl;
  
  console.log("GuacClient queryString:", queryString);
  console.log("GuacClient wsUrlToUse:", wsUrlToUse);
  
  // Use our custom WebSocket hook for Guacamole
  const { client, connectionState, errorMessage, isConnectionUnstable } = useGuacWebSocket(
    wsUrlToUse, 
    httpUrl, 
    forceHttp, 
    connected ? queryString : '',
    sessionUUID,
    enableSharing,
    onConnectionStateChange
  );
  
  const displayRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<any>(null);
  
  const clientRef = useRef(client); // Store client ref for access in other effects
  const displayObjRef = useRef<any>(null);
  const keyboardRef = useRef<any>(null);
  const mouseRef = useRef<any>(null);
  const argumentsRef = useRef<Record<string, any>>({});

  // Update client reference when it changes
  useEffect(() => {
    clientRef.current = client;
    if (client && connected) {
      // Set up display and clipboard when client becomes available
      setupClientDisplay();
      clipboard.install(client);
      
      // Set up clipboard events
      client.onclipboard = clipboard.onClipboard;
      
      // Test for argument mutability
      client.onargv = handleArgv;
    }
  }, [client, connected]);

  // Connect to the Guacamole server when query changes
  useEffect(() => {
    if (queryString && !connected) {
      setConnected(true);
    }
    
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [queryString, connected]);

  // Track connection state changes and notify parent component when disconnected
  useEffect(() => {
    if (connectionState === states.DISCONNECTED || connectionState === states.CLIENT_ERROR || connectionState === states.TUNNEL_ERROR) {
      if (connected && onDisconnect) {
        // Delay to allow potential reconnect attempts to happen first
        const timeout = setTimeout(() => {
          onDisconnect();
        }, 1000);
        return () => clearTimeout(timeout);
      }
    }
  }, [connectionState, connected, onDisconnect]);

  // Update modal when connection state changes
  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.show(connectionState, errorMessage);
    }
  }, [connectionState, errorMessage]);

  // Handle argument value stream
  const handleArgv = (stream: any, mimetype: string, name: string) => {
    if (mimetype !== 'text/plain')
      return;

    const reader = new Guacamole.StringReader(stream);

    // Assemble received data into a single string
    let value = '';
    reader.ontext = (text: string) => {
      value += text;
    };

    // Test mutability once stream is finished
    reader.onend = () => {
      if (!clientRef.current) return;
      
      const stream = clientRef.current.createArgumentValueStream('text/plain', name);
      stream.onack = (status: any) => {
        if (status.isError()) {
          return;
        }
        argumentsRef.current[name] = value;
      };
    };
  };

  // Set up the display element
  const setupClientDisplay = () => {
    if (!clientRef.current || !displayRef.current) return;
    
    const display = clientRef.current.getDisplay();
    displayObjRef.current = display;
    
    const displayElement = display.getElement();
    
    // Set the display element to fill the width
    displayElement.style.width = '100%';
    displayElement.style.height = '100%';
    
    // Clear any existing content and add the display element
    displayRef.current.innerHTML = '';
    displayRef.current.appendChild(displayElement);
    
    // Set up mouse
    const mouse = new GuacMouse.mouse(displayElement);
    mouseRef.current = mouse;
    
    // Focus/blur handlers
    displayRef.current.onfocus = () => {
      displayRef.current!.className = 'guac-display focused';
    };

    displayRef.current.onblur = () => {
      displayRef.current!.className = 'guac-display';
    };

    // Set up keyboard
    const keyboard = new Guacamole.Keyboard(displayRef.current);
    keyboardRef.current = keyboard;
    
    installKeyboard();
    
    // Set up mouse event handlers
    mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = handleMouseState;
  };

  const handleMouseState = (mouseState: any) => {
    if (!displayObjRef.current || !clientRef.current) return;
    
    const scaledMouseState = {
      ...mouseState,
      x: mouseState.x / displayObjRef.current.getScale(),
      y: mouseState.y / displayObjRef.current.getScale(),
    };
    clientRef.current.sendMouseState(scaledMouseState);
  };

  const resize = () => {
    if (!viewportRef.current || !displayObjRef.current || !clientRef.current) return;

    // Get the current viewport dimensions
    const viewportWidth = viewportRef.current.clientWidth;
    const viewportHeight = viewportRef.current.clientHeight;

    const remoteWidth = displayObjRef.current.getWidth();
    const remoteHeight = displayObjRef.current.getHeight();

    if (remoteWidth === 0 || remoteHeight === 0) {
      // If remote dimensions aren't available yet, try again shortly
      setTimeout(resize, 100);
      return;
    }

    // Calculate both horizontal and vertical scale factors
    const scaleX = viewportWidth / remoteWidth;
    const scaleY = viewportHeight / remoteHeight;
    
    // Use the smaller scale to ensure everything fits within the viewport
    const scale = Math.min(scaleX, scaleY);

    // Apply scale
    displayObjRef.current.scale(scale);

    // Get the actual pixel density for accurate resolution
    const pixelDensity = window.devicePixelRatio || 1;
    
    // Calculate the optimal resolution to send to the server
    const optimalWidth = Math.round(viewportWidth * pixelDensity);
    const optimalHeight = Math.round(viewportHeight * pixelDensity);
    
    // Send updated size to server
    clientRef.current.sendSize(optimalWidth, optimalHeight);
    
    // Center both horizontally and vertically
    if (displayRef.current) {
      const scaledWidth = remoteWidth * scale;
      const scaledHeight = remoteHeight * scale;
      
      // Center horizontally
      displayRef.current.style.marginLeft = scaledWidth < viewportWidth ? 
        `${(viewportWidth - scaledWidth) / 2}px` : '0';
      
      // Center vertically 
      displayRef.current.style.marginTop = scaledHeight < viewportHeight ? 
        `${(viewportHeight - scaledHeight) / 2}px` : '0';
    }
  };

  const installKeyboard = () => {
    if (!keyboardRef.current || !clientRef.current) return;
    
    keyboardRef.current.onkeydown = (keysym: number) => {
      clientRef.current.sendKeyEvent(1, keysym);
    };
    
    keyboardRef.current.onkeyup = (keysym: number) => {
      clientRef.current.sendKeyEvent(0, keysym);
    };
  };

  const uninstallKeyboard = () => {
    if (!keyboardRef.current) return;
    keyboardRef.current.onkeydown = keyboardRef.current.onkeyup = () => {};
  };

  const handleReconnect = () => {
    // Reset connection state and reconnect
    setConnected(false);
    
    // Clean up any existing display elements
    if (displayRef.current) {
      while (displayRef.current.firstChild) {
        displayRef.current.removeChild(displayRef.current.firstChild);
      }
    }
    
    // Reset references
    displayObjRef.current = null;
    
    // Reconnect after a small delay
    setTimeout(() => setConnected(true), 500);
    
    // Call parent's reconnect handler if provided
    if (onReconnect) {
      onReconnect();
    }
  };

  const handleDisconnect = () => {
    if (clientRef.current) {
      // Properly clean up resources
      uninstallKeyboard();
      
      // Clear the display area
      if (displayRef.current) {
        while (displayRef.current.firstChild) {
          displayRef.current.removeChild(displayRef.current.firstChild);
        }
      }
      
      // Reset necessary state
      displayObjRef.current = null;
      
      // Actually disconnect from the client
      clientRef.current.disconnect();
      
      // Update connection state 
      setTimeout(() => {
        setConnected(false);
        
        // Notify parent component that we've disconnected
        if (onDisconnect) {
          onDisconnect();
        }
      }, 100);
    }
  };

  // Add a resize handler for when the component mounts
  useEffect(() => {
    const handleWindowResize = () => {
      resize();
    };
    
    // Add event listener for window resize
    window.addEventListener('resize', handleWindowResize);
    
    // Call resize immediately and then again after short delays
    handleWindowResize();
    const timeouts = [
      setTimeout(handleWindowResize, 100),
      setTimeout(handleWindowResize, 300),
      setTimeout(handleWindowResize, 500),
      setTimeout(handleWindowResize, 1000)
    ];
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, []); 
  
  return (
    <div className="relative w-full h-full">
      <div className="fixed top-0 left-0 w-screen h-screen overflow-hidden bg-black flex justify-center items-center" ref={viewportRef}>
        <div className="guac-display outline-none w-auto h-auto mx-auto" ref={displayRef} tabIndex={0}>
          {/* The Guacamole display will be inserted here */}
        </div>
      </div>
      
      <Modal ref={modalRef} onRetry={handleReconnect} />
      
      <WebSocketControl 
        OfficeSession={OfficeSession}
        connectionState={connectionState} 
        onDisconnect={handleDisconnect} 
        connectionId={connectionId}
        isConnectionUnstable={isConnectionUnstable}
        errorMessage={errorMessage}
      />
      
      <Toaster position="top-right" />
    </div>
  );
}

export default GuacClient;