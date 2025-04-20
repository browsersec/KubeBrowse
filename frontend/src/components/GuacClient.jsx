import { useState, useEffect, useRef } from 'react';
import Guacamole from 'guacamole-common-js';
import GuacMouse from '../lib/GuacMouse';
import states from '../lib/states';
import clipboard from '../lib/clipboard';
import Modal from './Modal';
import './GuacClient.css';

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
    if (!viewportRef.current || !viewportRef.current.offsetWidth || !displayObjRef.current || !clientRef.current) {
      // resize is being called on the hidden window
      return;
    }

    let pixelDensity = window.devicePixelRatio || 1;
    const width = viewportRef.current.clientWidth * pixelDensity;
    const height = viewportRef.current.clientHeight * pixelDensity;
    
    if (displayObjRef.current.getWidth() !== width || displayObjRef.current.getHeight() !== height) {
      clientRef.current.sendSize(width, height);
    }
    
    // setting timeout so display has time to get the correct size
    setTimeout(() => {
      if (!viewportRef.current || !displayObjRef.current) return;
      
      const scale = Math.min(
        viewportRef.current.clientWidth / Math.max(displayObjRef.current.getWidth(), 1),
        viewportRef.current.clientHeight / Math.max(displayObjRef.current.getHeight(), 1)
      );
      displayObjRef.current.scale(scale);
    }, 100);
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
          window.addEventListener('resize', resize);
          if (viewportRef.current) {
            viewportRef.current.addEventListener('mouseenter', resize);
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
      displayRef.current.appendChild(display.getElement());
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
      
      setTimeout(() => {
        resize();
        displayRef.current.focus();
      }, 1000);
    }
  };

  const handleReconnect = () => {
    connect(query);
  };

  return (
    <div className="viewport" ref={viewportRef}>
      <Modal ref={modalRef} onReconnect={handleReconnect} />
      {/* tabindex allows for div to be focused */}
      <div ref={displayRef} className="display" tabIndex="0"></div>
    </div>
  );
}

export default GuacClient;