'use client';

import { useState, useImperativeHandle, forwardRef } from 'react';
import { states } from '../../lib/guac/states';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ModalProps {
  onRetry?: () => void;
}

interface ModalRef {
  show: (state: string, errorMsg?: string) => void;
}

const Modal = forwardRef<ModalRef, ModalProps>(({ onRetry }, ref) => {
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  
  const titles: Record<string, string> = {
    CONNECTING: "Connecting",
    DISCONNECTED: "Disconnected",
    UNSTABLE: "Unstable",
    WAITING: "Waiting",
    CLIENT_ERROR: "Client Error"
  };
  
  const texts: Record<string, string> = {
    CONNECTING: "Connecting to Guacamole...",
    DISCONNECTED: "You have been disconnected.",
    UNSTABLE: "The network connection to the Guacamole server appears unstable.",
    WAITING: "Connected to Guacamole. Waiting for response..."
  };

  const canReconnect = ['DISCONNECTED', 'CLIENT_ERROR'].includes(status || '');

  useImperativeHandle(ref, () => ({
    show: (state: string, errorMsg?: string) => {
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
          <DialogTitle>{titles[status] || 'Connection Status'}</DialogTitle>
          <DialogDescription>
            {message || texts[status] || 'Unknown connection status'}
          </DialogDescription>
        </DialogHeader>
        {canReconnect && onRetry && (
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

Modal.displayName = 'Modal';

export default Modal;