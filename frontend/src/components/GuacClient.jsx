import Guacamole from 'guacamole-common-js';
import { useEffect, useRef, useState } from 'react';
import clipboard from '../lib/clipboard';
import GuacMouse from '../lib/GuacMouse';
import states from '../lib/states';
import './GuacClient.css';
import Modal from './Modal';

// Set custom Mouse implementation
Guacamole.Mouse = GuacMouse.mouse;



// Define websocket and HTTP tunnel URLs
const wsUrl = `ws://${location.host}/websocket-tunnel`;
const httpUrl = `http://${location.host}/tunnel`;

function GuacClient({ query, forceHttp = false }) {
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState(states.IDLE);
  const [errorMessage, setErrorMessage] = useState('');
  
  const displayRef = useRef(null);
  const viewportRef = useRef(null);
  const modalRef = useRef(null);
  
  const clientRef = useRef(null);
  const displayObjRef = useRef(null);
  const keyboardRef = useRef(null);
  const mouseRef = useRef(null);
  const argumentsRef = useRef({});

  useEffect(() => {
    if (query && !connected) {
      setConnected(true);
      connect(query);
    }
    
    // Cleanup function
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [query, connected]);

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.show(connectionState, errorMessage);
    }
  }, [connectionState, errorMessage]);

  const send = (cmd) => {
    if (!clientRef.current) {
      return;
    }
    for (const c of cmd.data) {
      clientRef.current.sendKeyEvent(1, c.charCodeAt(0));
    }
  };

  const copy = (cmd) => {
    if (!clientRef.current) {
      return;
    }
    clipboard.cache = {
      type: 'text/plain',
      data: cmd.data
    };
    clipboard.setRemoteClipboard(clientRef.current);
  };

  const handleMouseState = (mouseState) => {
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
  
    // Get the current viewport dimensions (Chrome window size)
    const viewportWidth = viewportRef.current.clientWidth;
    const viewportHeight = viewportRef.current.clientHeight;
  
    const remoteWidth = displayObjRef.current.getWidth();
    const remoteHeight = displayObjRef.current.getHeight();
  
    if (remoteWidth === 0 || remoteHeight === 0) {
      // If remote dimensions aren't available yet, try again shortly
      setTimeout(resize, 100);
      return;
    }
  
    // Use scaleX to fill the entire width of the viewport
    // This ensures no black areas on the left and right
    const scale = viewportWidth / remoteWidth;
  
    // Apply scale
    displayObjRef.current.scale(scale);
  
    // Send updated size to server
    const pixelDensity = window.devicePixelRatio || 1;
    clientRef.current.sendSize(viewportWidth * pixelDensity, viewportHeight * pixelDensity);
    
    // Center vertically if needed
    if (displayRef.current) {
      const scaledHeight = remoteHeight * scale;
      
      // Always set marginLeft to 0 to ensure full width
      displayRef.current.style.marginLeft = '0';
      
      // Center vertically if the scaled height is less than viewport height
      if (scaledHeight < viewportHeight) {
        displayRef.current.style.marginTop = `${(viewportHeight - scaledHeight) / 2}px`;
      } else {
        displayRef.current.style.marginTop = '0';
      }
    }
  };
  
  

  const installKeyboard = () => {
    if (!keyboardRef.current || !clientRef.current) return;
    
    keyboardRef.current.onkeydown = (keysym) => {
      clientRef.current.sendKeyEvent(1, keysym);
    };
    
    keyboardRef.current.onkeyup = (keysym) => {
      clientRef.current.sendKeyEvent(0, keysym);
    };
  };

  const uninstallKeyboard = () => {
    if (!keyboardRef.current) return;
    keyboardRef.current.onkeydown = keyboardRef.current.onkeyup = () => {};
  };

  const connect = (queryString) => {
    let tunnel;

    if (window.WebSocket && !forceHttp) {
      tunnel = new Guacamole.WebSocketTunnel(wsUrl);
    } else {
      tunnel = new Guacamole.HTTPTunnel(httpUrl, true);
    }

    if (clientRef.current) {
      if (displayObjRef.current) {
        displayObjRef.current.scale(0);
      }
      uninstallKeyboard();
    }

    const client = new Guacamole.Client(tunnel);
    clientRef.current = client;
    
    clipboard.install(client);

    tunnel.onerror = (status) => {
      console.error(`Tunnel failed ${JSON.stringify(status)}`);
      setConnectionState(states.TUNNEL_ERROR);
    };

    tunnel.onstatechange = (state) => {
      switch (state) {
        // Connection is being established
        case Guacamole.Tunnel.State.CONNECTING:
          setConnectionState(states.CONNECTING);
          break;

        // Connection is established / no longer unstable
        case Guacamole.Tunnel.State.OPEN:
          setConnectionState(states.CONNECTED);
          break;

        // Connection is established but misbehaving
        case Guacamole.Tunnel.State.UNSTABLE:
          // TODO
          break;

        // Connection has closed
        case Guacamole.Tunnel.State.CLOSED:
          setConnectionState(states.DISCONNECTED);
          break;
      }
    };

    client.onstatechange = (clientState) => {
      switch (clientState) {
        case 0:
          setConnectionState(states.IDLE);
          break;
        case 1:
          // connecting ignored for some reason?
          break;
        case 2:
          setConnectionState(states.WAITING);
          break;
        case 3:
          setConnectionState(states.CONNECTED);
          
          // Add event listeners for responsive resizing
          window.addEventListener('resize', resize);
          if (viewportRef.current) {
            viewportRef.current.addEventListener('mouseenter', resize);
          }
          
          // Call resize immediately when connected
          resize();
          
          // Set up a resize observer to handle any changes to the viewport
          if (window.ResizeObserver && viewportRef.current) {
            const resizeObserver = new ResizeObserver(() => {
              resize();
            });
            resizeObserver.observe(viewportRef.current);
          }

          clipboard.setRemoteClipboard(client);
          break;
        case 4:
        case 5:
          // disconnected, disconnecting
          break;
      }
    };

    client.onerror = (error) => {
      client.disconnect();
      console.error(`Client error ${JSON.stringify(error)}`);
      setErrorMessage(error.message);
      setConnectionState(states.CLIENT_ERROR);
    };

    client.onsync = () => {
      // Handle sync event
    };

    // Test for argument mutability whenever an argument value is received
    client.onargv = (stream, mimetype, name) => {
      if (mimetype !== 'text/plain')
        return;

      const reader = new Guacamole.StringReader(stream);

      // Assemble received data into a single string
      let value = '';
      reader.ontext = (text) => {
        value += text;
      };

      // Test mutability once stream is finished, storing the current value for the argument only if it is mutable
      reader.onend = () => {
        const stream = client.createArgumentValueStream('text/plain', name);
        stream.onack = (status) => {
          if (status.isError()) {
            // ignore reject
            return;
          }
          argumentsRef.current[name] = value;
        };
      };
    };

    client.onclipboard = clipboard.onClipboard;
    
    const display = client.getDisplay();
    displayObjRef.current = display;
    
    if (displayRef.current) {
      const displayElement = display.getElement();
      
      // Set the display element to fill the width
      displayElement.style.width = '100%';
      displayElement.style.maxWidth = '100vw';
      
      displayRef.current.appendChild(displayElement);
      displayRef.current.addEventListener('contextmenu', (e) => {
        e.stopPropagation();
        if (e.preventDefault) {
          e.preventDefault();
        }
        e.returnValue = false;
      });
    }
    
    client.connect(queryString);
    window.onunload = () => client.disconnect();

    if (displayRef.current) {
      const mouse = new Guacamole.Mouse(displayRef.current);
      mouseRef.current = mouse;
      
      // Hide software cursor when mouse leaves display
      mouse.onmouseout = () => {
        if (!display) return;
        display.showCursor(false);
      };

      // allows focusing on the display div so that keyboard doesn't always go to session
      displayRef.current.onclick = () => {
        displayRef.current.focus();
      };
      
      displayRef.current.onfocus = () => {
        displayRef.current.className = 'display focus';
      };
      
      displayRef.current.onblur = () => {
        displayRef.current.className = 'display';
      };

      const keyboard = new Guacamole.Keyboard(displayRef.current);
      keyboardRef.current = keyboard;
      
      installKeyboard();
      mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = handleMouseState;
      
      // Call resize immediately and then again after a short delay to ensure proper sizing
      resize();
      
      // Focus the display element
      displayRef.current.focus();
      
      // Set up additional resize calls to handle any delayed rendering
      setTimeout(resize, 100);
      setTimeout(resize, 500);
      setTimeout(resize, 1000);
    }
  };

  const handleReconnect = () => {
    connect(query);
  };

  // Add a resize handler for when the component mounts
  useEffect(() => {
    const handleWindowResize = () => {
      if (resize) {
        resize();
      }
    };
    
    // Add event listener for window resize
    window.addEventListener('resize', handleWindowResize);
    
    // Initial resize
    setTimeout(handleWindowResize, 100);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);
  
  return (
    <div className="viewport" ref={viewportRef}>
      <Modal ref={modalRef} onReconnect={handleReconnect} />
      {/* tabindex allows for div to be focused */}
      <div 
        ref={displayRef} 
        className="display" 
        tabIndex="0"
        style={{
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box'
        }}
      ></div>
    </div>
  );
}

export default GuacClient;
