import { useState } from 'react';

function DisconnectButton({ onDisconnect }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${isExpanded ? 'w-48' : 'w-10'} bg-white rounded-lg shadow-lg overflow-hidden`}>
      {isExpanded ? (
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium">Connection</h3>
            <button 
              onClick={toggleExpand}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Minimize"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <button
            onClick={onDisconnect}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded text-sm"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={toggleExpand}
          className="flex items-center justify-center w-full h-10 text-gray-500 hover:text-gray-700"
          aria-label="Expand"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default DisconnectButton;
