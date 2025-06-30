import { useState, useImperativeHandle, forwardRef } from 'react';
import states from '../lib/states';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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

  return (
    <Dialog open={!!status} onOpenChange={() => setStatus(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titles[status]}</DialogTitle>
          <DialogDescription>
            {message || texts[status]}
          </DialogDescription>
        </DialogHeader>
        {canReconnect && (
          <Button onClick={onRetry} variant="outline">
            Reconnect
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
});

export default Modal;