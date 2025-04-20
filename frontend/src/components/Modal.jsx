import { useState, useImperativeHandle, forwardRef } from 'react';
import states from '../lib/states';
import './Modal.css';

const Modal = forwardRef(({ onReconnect }, ref) => {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  
  const titles = {
    CONNECTING: "Connecting",
    DISCONNECTED: "Disconnected",
    UNSTABLE: "Unstable",
    WAITING: "Waiting",
    CLIENT_ERROR: "Client Error"
  };
  
  const texts = {
    CONNECTING: "Connecting to Guacamole...",
    DISCONNECTED: "You have been disconnected.",
    UNSTABLE: "The network connection to the Guacamole server appears unstable.",
    WAITING: "Connected to Guacamole. Waiting for response..."
  };

  const canReconnect = ['DISCONNECTED', 'CLIENT_ERROR'].includes(status);

  useImperativeHandle(ref, () => ({
    show: (state, errorMsg) => {
      if (state === states.CONNECTED) {
        setStatus(null);
      } else {
        setStatus(state);
      }
      setMessage(errorMsg || '');
    }
  }));

  if (!status) {
    return null;
  }

  return (
    <div className="modal">
      <h2>{titles[status]}</h2>
      <p>{message || texts[status]}</p>
      {canReconnect && (
        <span className="rct" onClick={onReconnect}>
          Reconnect
        </span>
      )}
    </div>
  );
});

export default Modal;