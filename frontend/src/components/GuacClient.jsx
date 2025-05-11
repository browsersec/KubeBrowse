import Guacamole from 'guacamole-common-js';
import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from 'react-use-websocket';
import clipboard from '../lib/clipboard';
import GuacMouse from '../lib/GuacMouse';
import states from '../lib/states';
import './GuacClient.css';
import Modal from './Modal';
import DisconnectButton from './DisconnectButton';

// Set custom Mouse implementation
Guacamole.Mouse = GuacMouse.mouse;

// Define websocket and HTTP tunnel URLs
const wsUrl = `ws://${location.host}/websocket-tunnel`;
const httpUrl = `http://${location.host}/tunnel`;

// Custom tunnel using react-use-websocket
class ReactUseWebSocketTunnel extends Guacamole.Tunnel {
  constructor(sendMessageFn, getLastMessageFn) {
    super();
    this.sendMessageFn = sendMessageFn;
    this.getLastMessageFn = getLastMessageFn;
  }

  connect(data) {
    this.setState(Guacamole.Tunnel.State.OPEN);
  }

  sendMessage(elements) {
    const instruction = Guacamole.ArrayBufferWriter.getInstruction(elements);
    this.sendMessageFn(instruction);
  }

  receiveMessages() {
    const lastMsg = this.getLastMessageFn();
    // Handle incoming data from lastMessage if available
  }
}

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

  const { sendMessage, lastMessage, readyState } = useWebSocket(wsUrl);

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

    const viewportWidth = viewportRef.current.clientWidth;
    const viewportHeight = viewportRef.current.clientHeight;

    const remoteWidth = displayObjRef.current.getWidth();
    const remoteHeight = displayObjRef.current.getHeight();

    if (remoteWidth === 0 || remoteHeight === 0) {
      setTimeout(resize, 100);
      return;
    }

    const scaleX = viewportWidth / remoteWidth;
    const scaleY = viewportHeight / remoteHeight;
    const scale = Math.min(scaleX, scaleY);

    displayObjRef.current.scale(scale);

    const pixelDensity = window.devicePixelRatio || 1;
    const optimalWidth = Math.round(viewportWidth * pixelDensity);
    const optimalHeight = Math.round(viewportHeight * pixelDensity);
    
    clientRef.current.sendSize(optimalWidth, optimalHeight);
    
    if (displayRef.current) {
      const scaledWidth = remoteWidth * scale;
      const scaledHeight = remoteHeight * scale;
      
      displayRef.current.style.marginLeft = scaledWidth < viewportWidth ? 
        `${(viewportWidth - scaledWidth) / 2}px` : '0';
      
      displayRef.current.style.marginTop = scaledHeight < viewportHeight ? 
        `${(viewportHeight - scaledHeight) / 2}px` : '0';
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

    if (!forceHttp && readyState) {
      tunnel = new ReactUseWebSocketTunnel(
        sendMessage,
        () => lastMessage
      );
    } else {
      tunnel = new Guacamole.HTTPTunnel(httpUrl, true);
    }

    if (clientRef.current) {
      if (displayObjRef.current) {
        displayObjRef.current.scale(0);
      }
      uninstallKeyboard();
    }

    if (!queryString.includes('width=') || !queryString.includes('height=')) {
      const pixelDensity = window.devicePixelRatio || 1;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const separator = queryString.includes('?') ? '&' : '?';
      queryString += `${separator}width=${Math.round(viewportWidth * pixelDensity)}&height=${Math.round(viewportHeight * pixelDensity)}`;
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
        case Guacamole.Tunnel.State.CONNECTING:
          setConnectionState(states.CONNECTING);
          break;
        case Guacamole.Tunnel.State.OPEN:
          setConnectionState(states.CONNECTED);
          break;
        case Guacamole.Tunnel.State.UNSTABLE:
          break;
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
          
          resize();
          
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
    };

    client.onargv = (stream, mimetype, name) => {
      if (mimetype !== 'text/plain')
        return;

      const reader = new Guacamole.StringReader(stream);

      let value = '';
      reader.ontext = (text) => {
        value += text;
      };

      reader.onend = () => {
        const stream = client.createArgumentValueStream('text/plain', name);
        stream.onack = (status) => {
          if (status.isError()) {
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
      
      mouse.onmouseout = () => {
        if (!display) return;
        display.showCursor(false);
      };

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
      
      resize();
      
      displayRef.current.focus();
      
      setTimeout(resize, 100);
      setTimeout(resize, 500);
      setTimeout(resize, 1000);
    }
  };

  const handleReconnect = () => {
    connect(query);
  };

  const handleDisconnect = () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
    window.location.reload();
  };

  useEffect(() => {
    const handleWindowResize = () => {
      if (resize) {
        resize();
      }
    };
    
    window.addEventListener('resize', handleWindowResize);
    
    handleWindowResize();
    const timeouts = [
      setTimeout(handleWindowResize, 100),
      setTimeout(handleWindowResize, 300),
      setTimeout(handleWindowResize, 500),
      setTimeout(handleWindowResize, 1000)
    ];
    
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [resize]);
  
  return (
    <div className="viewport w-full h-full flex justify-center items-center bg-gray-100" ref={viewportRef}>
      <Modal ref={modalRef} onReconnect={handleReconnect} />
      <DisconnectButton onDisconnect={handleDisconnect} />
      <div 
        ref={displayRef} 
        className="display border border-gray-300 bg-white focus:outline-none"
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
