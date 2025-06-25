import { useState } from 'react';
import GuacClient from './GuacClient';

const API_BASE = '' // Use relative URLs to leverage Vite's proxy

const ShareWSSession = () => {
  const [sessionState, setSessionState] = useState({
    connectionId: null,
    status: 'idle',
    error: null
  });
  const [inputUuid, setInputUuid] = useState('');
  const [sessionName, setSessionName] = useState('');

  const handleDisconnect = () => {
    // if (sessionState.connectionId) {
    //   // Stop the session
    //   fetch(`${API_BASE}/sessions/${sessionState.connectionId}/stop`, {
    //     method: 'DELETE'
    //   }).catch(console.error);
    // }
    // console.log("Disconnected")
    // setSessionState({
    //   connectionId: null,
    //   status: 'idle',
    //   error: null
    // });
  };

  const handleInputChange = (e) => {
    setInputUuid(e.target.value);
  };

  const handleNameChange = (e) => {
    setSessionName(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSessionState(prev => ({ ...prev, status: 'creating', error: null }));
      
      // Just take the UUID directly, no parsing
      const uuid = inputUuid.trim();
      
      // Validate UUID format
      if (!uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new Error('Invalid UUID format. Please enter a valid connection ID.');
      }
      
      // Set the connection state with just the UUID
      setSessionState({
        connectionId: uuid,
        status: 'ready',
        error: null,
        name: sessionName || `Shared Session: ${uuid.substring(0, 8)}`
      });
      console.log("Ready to connect with UUID:", uuid);
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        status: 'error',
        error: error.message
      }));
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <h2 className="text-xl font-bold mb-2">Join Shared Session</h2>
      <p className="text-gray-600 mb-4">
        Enter the connection ID to join an existing session.
      </p>
      
      {sessionState.status === 'idle' && (
        <form onSubmit={handleSubmit} className="flex flex-col w-full max-w-md gap-3 bg-white p-5 rounded-lg shadow">
          <div className="flex flex-col">
            <label htmlFor="uuid" className="text-sm font-medium text-gray-700 mb-1">
              Connection ID (UUID)
            </label>
            <input
              id="uuid"
              type="text"
              value={inputUuid}
              onChange={handleInputChange}
              placeholder="123e4567-e89b-12d3-a456-426614174000"
              className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 text-black focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the UUID of the shared session
            </p>
          </div>
          
          <div className="flex flex-col">
            <label htmlFor="sessionName" className="text-sm font-medium text-gray-700 mb-1">
              Session Name (optional)
            </label>
            <input
              id="sessionName"
              type="text"
              value={sessionName}
              onChange={handleNameChange}
              placeholder="My Shared Session"
              className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 text-black focus:ring-blue-500"
            />
          </div>
          
          <button
            type="submit"
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Connect
          </button>
        </form>
      )}
      
      {sessionState.status === 'creating' && (
        <div className="text-gray-600 flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Connecting to shared session...
        </div>
      )}
      
      {sessionState.status === 'error' && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 w-full max-w-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {sessionState.error}
              </p>
              <button 
                onClick={() => setSessionState(prev => ({...prev, status: 'idle'}))}
                className="mt-2 text-sm text-red-700 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}
      
      {sessionState.status === 'ready' && sessionState.connectionId && (
        <div className="w-full">
          <div className="flex justify-between items-center mb-4 bg-gray-100 p-3 rounded">
            <div>
              <span className="text-green-600 font-medium mr-2">●</span>
              <span className="font-medium">{sessionState.name || 'Shared Session'}</span>
              <p className="text-xs text-gray-500">
                Connected to: {sessionState.connectionId}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
            >
              Disconnect
            </button>
          </div>
          <div className="w-full h-[600px] border border-gray-300 rounded overflow-hidden">
            <GuacClient
              query={{
                uuid: sessionState.connectionId,
                width: Math.round(window.innerWidth * (window.devicePixelRatio || 1)),
                height: Math.round(window.innerHeight * (window.devicePixelRatio || 1))
              }}
              connectionId={sessionState.connectionId}
              onDisconnect={handleDisconnect}
              OfficeSession={false}
              sharing={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};



export default ShareWSSession;

