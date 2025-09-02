// WebSocket Session Duplicator for session sharing functionality
// This module handles duplicating WebSocket connections for collaborative sessions

class WebSocketSessionDuplicator {
  constructor() {
    this.connections = new Map();
    this.messageQueue = new Map();
  }

  // Add a new connection to the session
  addConnection(sessionUUID, connectionId, websocket) {
    if (!this.connections.has(sessionUUID)) {
      this.connections.set(sessionUUID, new Map());
      this.messageQueue.set(sessionUUID, []);
    }
    
    const sessionConnections = this.connections.get(sessionUUID);
    sessionConnections.set(connectionId, websocket);
    
    // Send any queued messages to the new connection
    const queuedMessages = this.messageQueue.get(sessionUUID);
    if (queuedMessages.length > 0) {
      queuedMessages.forEach(message => {
        try {
          if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(message);
          } else {
            console.warn('Skipped queued send; socket not OPEN');
          }
        } catch (error) {
          console.warn('Failed to send queued message to new connection:', error);
        }
      });
    }
    
    console.log(`Added connection ${connectionId} to session ${sessionUUID}. Total connections: ${sessionConnections.size}`);
  }

  // Remove a connection from the session
  removeConnection(sessionUUID, connectionId) {
    const sessionConnections = this.connections.get(sessionUUID);
    if (sessionConnections) {
      sessionConnections.delete(connectionId);
      
      // Clean up empty sessions
      if (sessionConnections.size === 0) {
        this.connections.delete(sessionUUID);
        this.messageQueue.delete(sessionUUID);
        console.log(`Session ${sessionUUID} has no more connections, cleaned up`);
      } else {
        console.log(`Removed connection ${connectionId} from session ${sessionUUID}. Remaining connections: ${sessionConnections.size}`);
      }
    }
  }

  // Broadcast a message to all connections in a session
  broadcastMessage(sessionUUID, message, excludeConnectionId = null) {
    const sessionConnections = this.connections.get(sessionUUID);
    if (!sessionConnections) {
      console.warn(`No connections found for session ${sessionUUID}`);
      return;
    }

    let sentCount = 0;
    const failedConnections = [];

    sessionConnections.forEach((websocket, connectionId) => {
      if (connectionId !== excludeConnectionId) {
        try {
          websocket.send(message);
          sentCount++;
        } catch (error) {
          console.warn(`Failed to send message to connection ${connectionId}:`, error);
          failedConnections.push(connectionId);
        }
      }
    });

    // Remove failed connections
    failedConnections.forEach(connectionId => {
      this.removeConnection(sessionUUID, connectionId);
    });

    console.log(`Broadcasted message to ${sentCount} connections in session ${sessionUUID}`);
  }

  // Queue a message for future connections
  queueMessage(sessionUUID, message) {
    if (!this.messageQueue.has(sessionUUID)) {
      this.messageQueue.set(sessionUUID, []);
    }
    
    const queue = this.messageQueue.get(sessionUUID);
    queue.push(message);
    
    // Keep only the last 100 messages to prevent memory issues
    if (queue.length > 100) {
      queue.splice(0, queue.length - 100);
    }
  }

  // Get connection count for a session
  getConnectionCount(sessionUUID) {
    const sessionConnections = this.connections.get(sessionUUID);
    return sessionConnections ? sessionConnections.size : 0;
  }

  // Check if a session has multiple connections (is shared)
  isSessionShared(sessionUUID) {
    return this.getConnectionCount(sessionUUID) > 1;
  }

  // Get all active session UUIDs
  getActiveSessions() {
    return Array.from(this.connections.keys());
  }

  // Clean up all sessions (useful for testing or shutdown)
  cleanup() {
    this.connections.clear();
    this.messageQueue.clear();
    console.log('Cleaned up all session connections');
  }
}

// Export a singleton instance
const sessionDuplicator = new WebSocketSessionDuplicator();
export default sessionDuplicator; 