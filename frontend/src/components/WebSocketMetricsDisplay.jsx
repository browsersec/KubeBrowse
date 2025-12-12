import { useState, useEffect, useCallback } from "react";
import { Activity, Zap, Clock, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * WebSocket RTT Metrics Display Component
 * 
 * Shows real-time WebSocket performance metrics including:
 * - Round-trip time (RTT) statistics
 * - Message counts
 * - Bytes transferred
 */
function WebSocketMetricsDisplay({ sessionId, isConnected = false }) {
  const [metrics, setMetrics] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Fetch metrics from the global window object
  const fetchMetrics = useCallback(() => {
    if (window.guacWebSocketMetrics) {
      const metricsData = window.guacWebSocketMetrics.getMetrics?.();
      if (metricsData) {
        setMetrics(metricsData);
      }
    }
  }, []);
  
  // Poll for metrics updates
  useEffect(() => {
    if (!isConnected) {
      setMetrics(null);
      return;
    }
    
    // Initial fetch
    fetchMetrics();
    
    // Poll every 2 seconds
    const interval = setInterval(fetchMetrics, 2000);
    
    return () => clearInterval(interval);
  }, [isConnected, fetchMetrics]);
  
  // Report metrics to backend
  const reportMetrics = useCallback(async () => {
    if (!sessionId || !metrics) return;
    
    try {
      await fetch(`/sessions/${sessionId}/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metrics),
      });
    } catch (error) {
      console.debug('Failed to report metrics:', error);
    }
  }, [sessionId, metrics]);
  
  // Report metrics periodically (every 30 seconds)
  useEffect(() => {
    if (!isConnected || !metrics) return;
    
    const interval = setInterval(reportMetrics, 30000);
    return () => clearInterval(interval);
  }, [isConnected, metrics, reportMetrics]);
  
  // Format bytes to human readable
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };
  
  // Format milliseconds
  const formatMs = (ms) => {
    if (ms === null || ms === undefined) return '-';
    return `${ms.toFixed(1)} ms`;
  };
  
  // Get RTT status color
  const getRttStatus = (rtt) => {
    if (rtt === null || rtt === undefined) return 'secondary';
    if (rtt < 50) return 'default'; // Good
    if (rtt < 100) return 'default'; // OK
    if (rtt < 200) return 'destructive'; // Warning
    return 'destructive'; // Bad
  };
  
  // Get RTT status label
  const getRttLabel = (rtt) => {
    if (rtt === null || rtt === undefined) return 'No data';
    if (rtt < 50) return 'Excellent';
    if (rtt < 100) return 'Good';
    if (rtt < 200) return 'Fair';
    return 'Poor';
  };
  
  if (!isConnected) {
    return null;
  }
  
  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-xs"
      >
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          <span>RTT Metrics</span>
        </div>
        {metrics?.rtt?.avg ? (
          <Badge variant={getRttStatus(metrics.rtt.avg)} className="text-xs">
            {formatMs(metrics.rtt.avg)}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">-</Badge>
        )}
      </Button>
      
      {isExpanded && (
        <Card className="mt-2 text-xs">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs flex items-center justify-between">
              <span>WebSocket Metrics</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchMetrics}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3 space-y-2">
            {/* RTT Stats */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Round-Trip Time</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg:</span>
                  <Badge variant={getRttStatus(metrics?.rtt?.avg)}>
                    {formatMs(metrics?.rtt?.avg)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P95:</span>
                  <span>{formatMs(metrics?.rtt?.p95)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min:</span>
                  <span>{formatMs(metrics?.rtt?.min)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max:</span>
                  <span>{formatMs(metrics?.rtt?.max)}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status:</span>
                <span>{getRttLabel(metrics?.rtt?.avg)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Samples:</span>
                <span>{metrics?.rtt?.samples || 0}</span>
              </div>
            </div>
            
            {/* Traffic Stats */}
            <div className="space-y-1 border-t pt-2">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span>Traffic</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1">
                  <ArrowUp className="w-3 h-3 text-blue-500" />
                  <span>{formatBytes(metrics?.traffic?.bytesSent)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowDown className="w-3 h-3 text-green-500" />
                  <span>{formatBytes(metrics?.traffic?.bytesReceived)}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>Msgs sent: {metrics?.traffic?.messagesSent || 0}</span>
                <span>Msgs recv: {metrics?.traffic?.messagesReceived || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default WebSocketMetricsDisplay;

