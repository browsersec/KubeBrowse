'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { states } from '../../lib/guac/states';

interface SessionReconnectStatusProps {
  connectionState: string;
  isReconnecting: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  onManualReconnect: () => void;
  onDisconnect: () => void;
}

interface StatusInfo {
  title: string;
  description: string;
  icon: React.ReactNode;
  variant: 'default' | 'secondary' | 'destructive';
  showReconnect: boolean;
}

const SessionReconnectStatus = ({ 
  connectionState, 
  isReconnecting, 
  reconnectAttempts, 
  maxReconnectAttempts,
  onManualReconnect,
  onDisconnect 
}: SessionReconnectStatusProps) => {
  // Don't show anything if connection is stable
  if (connectionState === states.CONNECTED && !isReconnecting) {
    return null;
  }

  const getStatusInfo = (): StatusInfo => {
    switch (connectionState) {
      case states.CONNECTING:
        return {
          title: 'Connecting...',
          description: 'Establishing connection to the session',
          icon: <Wifi className="w-4 h-4" />,
          variant: 'default',
          showReconnect: false
        };
      case states.DISCONNECTED:
        return {
          title: 'Disconnected',
          description: 'Connection to the session has been lost',
          icon: <WifiOff className="w-4 h-4" />,
          variant: 'secondary',
          showReconnect: true
        };
      case states.CLIENT_ERROR:
      case states.TUNNEL_ERROR:
        return {
          title: 'Connection Error',
          description: 'Failed to connect to the session',
          icon: <AlertTriangle className="w-4 h-4" />,
          variant: 'destructive',
          showReconnect: true
        };
      default:
        return {
          title: 'Unknown Status',
          description: 'Connection status is unknown',
          icon: <AlertTriangle className="w-4 h-4" />,
          variant: 'secondary',
          showReconnect: true
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={statusInfo.variant} className="flex items-center gap-1">
              {statusInfo.icon}
              {statusInfo.title}
            </Badge>
            {isReconnecting && reconnectAttempts > 0 && (
              <span className="text-sm text-muted-foreground">
                Attempt {reconnectAttempts}/{maxReconnectAttempts}
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            {statusInfo.showReconnect && (
              <Button
                onClick={onManualReconnect}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Reconnect
              </Button>
            )}
            <Button
              onClick={onDisconnect}
              variant="destructive"
              size="sm"
            >
              Disconnect
            </Button>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mt-2">
          {statusInfo.description}
        </p>
        
        {isReconnecting && reconnectAttempts >= maxReconnectAttempts && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>
              Maximum reconnection attempts reached. Please try reconnecting manually or refresh the page.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionReconnectStatus;