import { useState, useRef } from 'react';
import GuacClient from './GuacClient';


const isSecure = window.location.protocol === 'https:';
const API_BASE = import.meta.env.VITE_GUAC_CLIENT_URL || `${isSecure ? 'https' : 'http'}://${location.host}`;
// const API_BASE = 'https://152.53.244.80:30006'

const OfficeSession = () => {
  const [sessionState, setSessionState] = useState({
    connectionId: null,
    websocketUrl: null,
    status: 'idle',
    error: null
  });
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef();

  const createSession = async () => {
    try {
      setSessionState(prev => ({ ...prev, status: 'creating', error: null }));

      // Create a new office pod session
      const response = await fetch(`${API_BASE}/test/deploy-office?width=${window.innerWidth * (window.devicePixelRatio || 1)}&height=${window.innerHeight * (window.devicePixelRatio || 1)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to create office session');
      }

      const data = await response.json();

      // Get the websocket URL for the connection
      const connectResponse = await fetch(`${API_BASE}/test/connect/${data.connection_id}`);
      if (!connectResponse.ok) {
        throw new Error('Failed to get connection URL');
      }

      const connectData = await connectResponse.json();

      setSessionState({
        connectionId: data.connection_id,
        websocketUrl: connectData.websocket_url,
        status: 'ready',
        error: null
      });
      console.log(connectData)
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        status: 'error',
        error: error.message
      }));
    }
  };

  const handleDisconnect = () => {
    if (sessionState.connectionId) {
      // Stop the session
      fetch(`${API_BASE}/sessions/${sessionState.connectionId}/stop`, {
        method: 'DELETE'
      }).catch(console.error);
    }
    console.log("Disconnected")
    setSessionState({
      connectionId: null,
      websocketUrl: null,
      status: 'idle',
      error: null
    });
  };

  // File upload handler
  const handleFileUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.value = null;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !sessionState.connectionId) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const xhr = new window.XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/sessions/${sessionState.connectionId}/upload`, true);
      xhr.withCredentials = false;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        setUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadSuccess(true);
          setTimeout(() => setUploadSuccess(false), 2000);
        } else {
          setUploadError('Upload failed');
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        setUploadError('Upload failed');
      };
      xhr.send(formData);
    } catch (err) {
      setUploading(false);
      setUploadError('Upload failed');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {sessionState.status === 'idle' && (
        <button
          onClick={createSession}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Create Office Session
        </button>
      )}

      {sessionState.status === 'creating' && (
        <div className="text-gray-600">
          Creating session...
        </div>
      )}

      {sessionState.status === 'error' && (
        <div className="text-red-500">
          Error: {sessionState.error}
        </div>
      )}

      {sessionState.status === 'ready' && sessionState.websocketUrl && (
        <div className="w-full">
          <div className="flex justify-between items-center mb-4">
            <span className="text-green-500">Session Ready</span>
            <div className="flex items-center gap-2">
              {/* Upload button */}
              <button
                onClick={handleFileUploadClick}
                className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                disabled={uploading}
                title="Upload File"
              >
                {/* Upload SVG icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={uploading}
              />
              <button
                onClick={handleDisconnect}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
          {/* Upload progress bar and feedback */}
          {uploading && (
            <div className="w-full mb-2">
              <div className="h-2 bg-gray-200 rounded">
                <div
                  className="h-2 bg-blue-500 rounded transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-600 mt-1">Uploading... {uploadProgress}%</div>
            </div>
          )}
          {uploadSuccess && (
            <div className="text-xs text-green-600 mb-2 animate-pulse">Upload successful!</div>
          )}
          {uploadError && (
            <div className="text-xs text-red-600 mb-2">{uploadError}</div>
          )}
          <div className="w-full h-[600px] border border-gray-300 rounded">
            <GuacClient
              query={{
                uuid: sessionState.connectionId,
                width: Math.round(window.innerWidth * (window.devicePixelRatio || 1)),
                height: Math.round(window.innerHeight * (window.devicePixelRatio || 1))
              }}
              onDisconnect={handleDisconnect}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficeSession; 