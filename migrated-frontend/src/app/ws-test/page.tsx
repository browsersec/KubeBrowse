'use client';
import { useState } from 'react';
import useWebSocket from 'react-use-websocket';

export default function WebSocketTestPage() {
  const [socketUrl, setSocketUrl] = useState(null);
  const { lastMessage, readyState } = useWebSocket(socketUrl);

  const handleClick = () => {
    // This should be the URL of your Go WebSocket backend
    setSocketUrl('ws://localhost:4567/websocket-tunnel');
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">WebSocket Test</h1>
      <button
        onClick={handleClick}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Connect to WebSocket
      </button>
      <div className="mt-4">
        <p>Connection Status: {readyState}</p>
        {lastMessage && <p>Last Message: {lastMessage.data}</p>}
      </div>
    </div>
  );
}
