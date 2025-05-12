import { useState, useImperativeHandle, forwardRef } from 'react';
import states from '../lib/states';

const Modal = forwardRef(({ onRetry }, ref) => {
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
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-md p-4 bg-gray-400 z-40">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">{titles[status]}</h2>
      <p className="text-gray-700 mb-3">{message || texts[status]}</p>
      {canReconnect && (
        <span 
          className="underline cursor-pointer text-blue-600 hover:text-blue-800" 
          onClick={onRetry}
        >
          Reconnect
        </span>
      )}
    </div>
  );
});

export default Modal;