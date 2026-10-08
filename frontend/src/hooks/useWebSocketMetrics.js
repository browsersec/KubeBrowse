/**
 * WebSocket RTT (Round-Trip Time) Metrics Hook
 * 
 * Tracks WebSocket performance metrics for Guacamole connections including:
 * - Round-trip time (RTT) measurements
 * - Message counts and byte statistics
 * - Connection latency history
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// RTT sample configuration
const MAX_RTT_SAMPLES = 1000; // Maximum RTT samples to keep
const RTT_MEASUREMENT_INTERVAL = 2000; // Measure RTT every 2 seconds

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArray, p) {
  if (sortedArray.length === 0) return 0;
  const k = (sortedArray.length - 1) * (p / 100);
  const f = Math.floor(k);
  const c = Math.min(f + 1, sortedArray.length - 1);
  return sortedArray[f] + (sortedArray[c] - sortedArray[f]) * (k - f);
}

/**
 * Custom hook for tracking WebSocket RTT and performance metrics
 * 
 * @param {string} sessionId - Session ID for the connection
 * @returns {Object} Metrics object with RTT data and utility functions
 */
const useWebSocketMetrics = (sessionId) => {
  // RTT samples array
  const rttSamplesRef = useRef([]);
  
  // Pending requests for RTT calculation (timestamp when message was sent)
  const pendingRequestsRef = useRef(new Map());
  
  // Message counters
  const [metrics, setMetrics] = useState({
    // RTT statistics (in milliseconds)
    rttAvg: null,
    rttMin: null,
    rttMax: null,
    rttP50: null,
    rttP95: null,
    rttP99: null,
    rttSampleCount: 0,
    
    // Message statistics
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    
    // Connection timing
    connectionStartTime: null,
    lastMessageTime: null,
    
    // Error tracking
    errors: 0,
  });
  
  // Interval ref for periodic RTT measurement
  const measurementIntervalRef = useRef(null);
  
  /**
   * Record a message being sent (for RTT tracking)
   */
  const recordMessageSent = useCallback((message, requestId = null) => {
    const timestamp = performance.now();
    const messageLength = typeof message === 'string' ? message.length : 0;
    
    // Store pending request for RTT calculation
    if (requestId) {
      pendingRequestsRef.current.set(requestId, timestamp);
    } else {
      // For Guacamole, use message prefix as request ID
      // Guacamole instructions follow format: "4.sync,..." 
      try {
        const parts = message.split(',');
        if (parts.length > 0) {
          const instruction = parts[0];
          // Track sync, key, mouse instructions for RTT
          if (instruction.includes('sync') || instruction.includes('key') || instruction.includes('mouse')) {
            const msgId = `${instruction}_${timestamp}`;
            pendingRequestsRef.current.set(msgId, timestamp);
            
            // Cleanup old pending requests (> 30 seconds)
            for (const [key, value] of pendingRequestsRef.current.entries()) {
              if (timestamp - value > 30000) {
                pendingRequestsRef.current.delete(key);
              }
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    setMetrics(prev => ({
      ...prev,
      messagesSent: prev.messagesSent + 1,
      bytesSent: prev.bytesSent + messageLength,
      lastMessageTime: Date.now(),
    }));
  }, []);
  
  /**
   * Record a message being received (for RTT tracking)
   */
  const recordMessageReceived = useCallback((message) => {
    const timestamp = performance.now();
    const messageLength = typeof message === 'string' ? message.length : 0;
    
    // Try to match with pending request for RTT calculation
    if (pendingRequestsRef.current.size > 0) {
      // For Guacamole responses (sync, ack, img, etc.)
      try {
        const parts = message.split(',');
        if (parts.length > 0) {
          const instruction = parts[0];
          // Response instructions that indicate request completion
          if (instruction.includes('sync') || instruction.includes('ack') || 
              instruction.includes('img') || instruction.includes('png') ||
              instruction.includes('rect') || instruction.includes('ready')) {
            
            // Find the oldest pending request and calculate RTT
            if (pendingRequestsRef.current.size > 0) {
              const entries = Array.from(pendingRequestsRef.current.entries());
              const oldestEntry = entries.reduce((oldest, current) => 
                current[1] < oldest[1] ? current : oldest
              );
              
              const [requestId, sentTime] = oldestEntry;
              const rtt = timestamp - sentTime;
              
              // Only record reasonable RTT values (< 10 seconds)
              if (rtt > 0 && rtt < 10000) {
                rttSamplesRef.current.push(rtt);
                
                // Limit samples array size
                if (rttSamplesRef.current.length > MAX_RTT_SAMPLES) {
                  rttSamplesRef.current = rttSamplesRef.current.slice(-MAX_RTT_SAMPLES);
                }
                
                // Update RTT statistics
                updateRttStats();
              }
              
              pendingRequestsRef.current.delete(requestId);
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    setMetrics(prev => ({
      ...prev,
      messagesReceived: prev.messagesReceived + 1,
      bytesReceived: prev.bytesReceived + messageLength,
      lastMessageTime: Date.now(),
    }));
  }, []);
  
  /**
   * Update RTT statistics from samples
   */
  const updateRttStats = useCallback(() => {
    const samples = rttSamplesRef.current;
    if (samples.length === 0) return;
    
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    
    setMetrics(prev => ({
      ...prev,
      rttAvg: sum / sorted.length,
      rttMin: sorted[0],
      rttMax: sorted[sorted.length - 1],
      rttP50: percentile(sorted, 50),
      rttP95: percentile(sorted, 95),
      rttP99: percentile(sorted, 99),
      rttSampleCount: samples.length,
    }));
  }, []);
  
  /**
   * Record connection start
   */
  const recordConnectionStart = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      connectionStartTime: Date.now(),
    }));
  }, []);
  
  /**
   * Record an error
   */
  const recordError = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      errors: prev.errors + 1,
    }));
  }, []);
  
  /**
   * Get all RTT samples (for export/benchmark)
   */
  const getRttSamples = useCallback(() => {
    return [...rttSamplesRef.current];
  }, []);
  
  /**
   * Get complete metrics summary
   */
  const getMetricsSummary = useCallback(() => {
    const samples = rttSamplesRef.current;
    const sorted = samples.length > 0 ? [...samples].sort((a, b) => a - b) : [];
    
    return {
      sessionId,
      timestamp: new Date().toISOString(),
      rtt: {
        samples: samples.length,
        avg: metrics.rttAvg,
        min: metrics.rttMin,
        max: metrics.rttMax,
        p50: metrics.rttP50,
        p95: metrics.rttP95,
        p99: metrics.rttP99,
        all_samples: sorted,
      },
      traffic: {
        messagesSent: metrics.messagesSent,
        messagesReceived: metrics.messagesReceived,
        bytesSent: metrics.bytesSent,
        bytesReceived: metrics.bytesReceived,
        totalBytes: metrics.bytesSent + metrics.bytesReceived,
      },
      timing: {
        connectionStartTime: metrics.connectionStartTime,
        lastMessageTime: metrics.lastMessageTime,
        connectionDuration: metrics.connectionStartTime 
          ? Date.now() - metrics.connectionStartTime 
          : null,
      },
      errors: metrics.errors,
    };
  }, [sessionId, metrics]);
  
  /**
   * Reset all metrics
   */
  const resetMetrics = useCallback(() => {
    rttSamplesRef.current = [];
    pendingRequestsRef.current.clear();
    setMetrics({
      rttAvg: null,
      rttMin: null,
      rttMax: null,
      rttP50: null,
      rttP95: null,
      rttP99: null,
      rttSampleCount: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      connectionStartTime: null,
      lastMessageTime: null,
      errors: 0,
    });
  }, []);
  
  /**
   * Expose metrics globally for benchmarking tools
   */
  useEffect(() => {
    // Expose metrics to window for external access (benchmarking)
    window.guacWebSocketMetrics = {
      getMetrics: getMetricsSummary,
      getRttSamples,
      recordMessageSent,
      recordMessageReceived,
      recordConnectionStart,
      sessionId,
    };
    
    return () => {
      delete window.guacWebSocketMetrics;
    };
  }, [getMetricsSummary, getRttSamples, recordMessageSent, recordMessageReceived, recordConnectionStart, sessionId]);
  
  /**
   * Periodic RTT stats update
   */
  useEffect(() => {
    measurementIntervalRef.current = setInterval(() => {
      if (rttSamplesRef.current.length > 0) {
        updateRttStats();
      }
    }, RTT_MEASUREMENT_INTERVAL);
    
    return () => {
      if (measurementIntervalRef.current) {
        clearInterval(measurementIntervalRef.current);
      }
    };
  }, [updateRttStats]);
  
  return {
    metrics,
    recordMessageSent,
    recordMessageReceived,
    recordConnectionStart,
    recordError,
    getRttSamples,
    getMetricsSummary,
    resetMetrics,
  };
};

export default useWebSocketMetrics;

