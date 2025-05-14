import { useState, useEffect } from 'react';

/**
 * A collapsible control panel for WebSocket connection management
 * positioned in the bottom right of the screen with a high z-index
 */
function WebSocketControl({ connectionState, onDisconnect }) {
  const [expanded, setExpanded] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [animationTimeout, setAnimationTimeout] = useState(null);

  // Clear animation timeout on unmount
  useEffect(() => {
    return () => {
      if (animationTimeout) {
        clearTimeout(animationTimeout);
      }
    };
  }, [animationTimeout]);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  const handleDisconnect = () => {
    // Start the disconnecting animation
    setDisconnecting(true);
    
    // Set a timeout to actually perform the disconnect after animation
    const timeout = setTimeout(() => {
      if (onDisconnect) {
        onDisconnect();
      }
      // Reset the disconnecting state after a delay to complete the animation
      setTimeout(() => setDisconnecting(false), 500);
    }, 800); // Animation duration
    
    setAnimationTimeout(timeout);
  };

  // Determine connection status for display
  const isConnected = connectionState === 'CONNECTED' || 
                      connectionState === 'WAITING';

  return (
    <div 
      className={`fixed bottom-5 right-5 z-50 bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ease-in-out min-w-[50px] max-w-[250px] ${
        expanded ? 'w-[200px] h-auto' : 'w-[50px] h-[50px]'
      }`}
    >
      <div 
        className="flex justify-between items-center p-2.5 cursor-pointer bg-gray-100 border-b border-gray-200 select-none"
        onClick={toggleExpanded}
      >
        <div className="flex items-center gap-2">
          <div 
            className={`w-3 h-3 rounded-full ${
              disconnecting 
                ? 'bg-yellow-500 animate-pulse animate-pulse-glow' 
                : isConnected 
                  ? 'bg-green-500 shadow-[0_0_5px_#4CAF50]' 
                  : 'bg-red-500 shadow-[0_0_5px_#f44336]'
            }`}
          ></div>
          {expanded && (
            <span className="text-sm text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis">
              {disconnecting 
                ? 'Disconnecting...' 
                : isConnected 
                  ? 'Connected' 
                  : connectionState}
            </span>
          )}
        </div>
        <button className="bg-transparent border-none text-gray-600 cursor-pointer text-sm p-0 flex items-center justify-center">
          {expanded ? '▼' : '▲'}
        </button>
      </div>
      
      {expanded && (
        <div className="p-2.5">
          <button 
            className={`w-full py-2 px-3 rounded text-white border-none transition-colors relative overflow-hidden ${
              disconnecting
                ? 'bg-yellow-500 cursor-wait'
                : isConnected 
                  ? 'bg-red-500 hover:bg-red-700 cursor-pointer' 
                  : 'bg-gray-300 cursor-not-allowed'
            }`}
            onClick={handleDisconnect}
            disabled={!isConnected || disconnecting}
          >
            {disconnecting && (
              <span className="absolute inset-0 flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            )}
            <span className={disconnecting ? 'opacity-0' : ''}>
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default WebSocketControl; 