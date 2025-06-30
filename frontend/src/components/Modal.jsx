import { useState, useImperativeHandle, forwardRef } from 'react';
import states from '../lib/states';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

  if (!status) {
    return null;
  }

  return (
    <Dialog open={!!status} onOpenChange={() => setStatus(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titles[status]}</DialogTitle>
          <DialogDescription>
            {message || texts[status]}
          </DialogDescription>
        </DialogHeader>
        {canReconnect && (
          <div className="flex justify-end">
            <Button onClick={onRetry}>
              Reconnect
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

export default Modal;