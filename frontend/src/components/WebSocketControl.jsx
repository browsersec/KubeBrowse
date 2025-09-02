import { useState, useEffect, useRef } from "react";
import { Upload, Clipboard, ClipboardCheck, Download, X, ChevronDown, ChevronUp } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * A collapsible control panel for WebSocket connection management
 * positioned in the bottom right of the screen with a high z-index
 */
function WebSocketControl({
  connectionState,
  onDisconnect,
  connectionId,
  OfficeSession = true,
  isConnectionUnstable = false,
  errorMessage = '',
}) {
  const [expanded, setExpanded] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [animationTimeout, setAnimationTimeout] = useState(null);
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadResponse, setUploadResponse] = useState(null);
  // Track history of all uploads
  const [uploadHistory, setUploadHistory] = useState([]);
  const fileInputRef = useRef();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Track which upload logs are expanded in the modal
  const [expandedLogs, setExpandedLogs] = useState({});

  // copied to clipboard state
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Show toast when connection becomes unstable
  useEffect(() => {
    if (isConnectionUnstable) {
      toast.error("WebSocket connection is unstable", {
        id: "connection-unstable",
        duration: 3000,
        position: "top-right",
        icon: "⚠️",
        style: {
          borderRadius: "10px",
          background: "#FFF3CD",
          color: "#856404",
          border: "1px solid #FFEEBA",
        },
      });
    }
  }, [isConnectionUnstable]);

  // Show toast when there is a tunnel error
  useEffect(() => {
    if (connectionState === 'TUNNEL_ERROR') {
      toast.error(`Tunnel Error: ${errorMessage || 'Unable to connect'}`, {
        id: 'connection-error',
        duration: 3000,
        position: 'top-right',
        icon: '❌',
      });
    }
  }, [connectionState, errorMessage]);

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

  // Upload handlers
  const handleFileUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.value = null;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !connectionId) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(false);
    setUploadResponse(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const xhr = new window.XMLHttpRequest();
      xhr.open("POST", `/sessions/${connectionId}/upload`, true);
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
          
          // Parse and store the response
          try {
            const response = JSON.parse(xhr.responseText);
            const timestamp = new Date();
            
            // Add timestamp and filename to the response
            const enrichedResponse = {
              ...response,
              timestamp,
              filename: file.name,
            };
            
            // Add the new upload to history
            setUploadHistory(prevHistory => [enrichedResponse, ...prevHistory]);
            setUploadResponse(enrichedResponse);
            
            // Check if malware was detected
            checkForMalware(enrichedResponse);
          } catch (parseErr) {
            console.error("Failed to parse upload response", parseErr);
          }
          
          setTimeout(() => setUploadSuccess(false), 2000);
        } else {
          setUploadError("Upload failed");
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        setUploadError("Upload failed");
      };
      xhr.send(formData);
      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          console.log(xhr.responseText);
        }
      }
    } catch (err) {
      setUploading(false);
      setUploadError("Upload failed");
      console.error("Upload error:", err);
    }
  };
  
  // function to check for malware in the upload response
  const checkForMalware = (response) => {
    try {
      // Check if results exists and is an array
      if (!response || !Array.isArray(response.results) || response.results.length === 0) {
        return false;
      }

      // Find the ClamAV result
      const clamavResult = response.results.find(result => result.service === "clamav");
      
      // Return early if no ClamAV result was found
      if (!clamavResult) {
        return false;
      }
      
      if (clamavResult.success && clamavResult.data?.response?.infected) {
        // Get the viruses list if available
        const viruses = clamavResult.data.response.viruses || [];
        const virusNames = viruses.length > 0 ? viruses.join(', ') : 'Unknown threat';
        
        // Show a prominent warning toast
        toast.error(
          <div>
            <div className="font-bold">😈 Malware Detected!</div>
            <div>The file may contain malicious content.</div>
            {viruses.length > 0 && <div className="text-xs mt-1">Detected: {virusNames}</div>}
          </div>,
          {
            id: 'malware-alert',
            duration: 6000,
            position: 'top-center',
            style: {
              background: '#FEE2E2',
              color: '#991B1B',
              border: '1px solid #F87171',
              padding: '16px',
              fontWeight: 'bold',
            },
          }
        );
        
        // Also look for the file name in the clamav response
        const infectedFiles = clamavResult.data.response.data?.result?.filter(file => file.is_infected) || [];
        
        if (infectedFiles.length > 0) {
          // Log detailed information about infected files
          console.warn('Infected files detected:', infectedFiles);
        }
        
        return true;
      }
      
      return false;
    } catch (err) {
      console.error("Error checking for malware:", err);
      return false;
    }
  };

  // Share session handler
  const handleShareSession = async () => {
    if (!connectionId) return;

    try {
      const response = await fetch(`/test/share/${connectionId}`, {
        method: "GET",
        redirect: "follow",
      });

      if (response.ok) {
        const data = await response.json();
        const url = data.websocket_url;
        // Copy the full URL including the base URL for sharing
        const fullUrl = `${window.location.origin}${url}`;
        await navigator.clipboard.writeText(fullUrl);
        setCopiedToClipboard(true);
        
        // Show success toast
        toast.success("Sharing URL copied to clipboard!", {
          duration: 3000,
          position: "top-right",
          icon: "🔗",
        });
        
        setTimeout(() => setCopiedToClipboard(false), 2000);
      } else {
        const errorData = await response.json();
        toast.error(`Failed to share session: ${errorData.error || 'Unknown error'}`, {
          duration: 3000,
          position: "top-right",
        });
        console.error("Failed to share session:", errorData);
      }
    } catch (error) {
      toast.error("Error sharing session", {
        duration: 3000,
        position: "top-right",
      });
      console.error("Error sharing session:", error);
    }
  };

  // Toggle log expansion in the modal
  const toggleLogExpansion = (index) => {
    setExpandedLogs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Handler for showing upload logs modal
  const handleShowLogs = () => {
    if (uploadHistory.length > 0) {
      setIsModalOpen(true);
    } else {
      toast.error("No upload logs available", {
        duration: 2000,
        position: "top-right",
      });
    }
  };

  // Determine connection status for display
  const isConnected =
    connectionState === "CONNECTED" || connectionState === "WAITING";

  return (
    <>
      <Toaster />      {/* Upload Logs Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>File Upload History</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {uploadHistory.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">No upload history available</div>
            ) : (
              <div className="space-y-4">
                {uploadHistory.map((entry, historyIndex) => (
                  <Card key={historyIndex}>
                    <CardContent className="p-0">
                      <div 
                        className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted"
                        onClick={() => toggleLogExpansion(historyIndex)}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={entry.success ? "default" : "destructive"}>
                            {entry.success ? 'Success' : 'Failed'}
                          </Badge>
                          <span className="font-medium">{entry.filename}</span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {expandedLogs[historyIndex] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>

                      {expandedLogs[historyIndex] && (
                        <div className="p-3 border-t">
                          <div className="text-sm mb-2">{entry.message}</div>
                          
                          <div className="space-y-3">
                            {entry.results.map((result, resultIndex) => (
                              <div key={resultIndex} className="border rounded p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <h4 className="font-semibold capitalize">{result.service}</h4>
                                  <Badge variant={result.success ? "default" : "destructive"}>
                                    {result.success ? 'Success' : 'Failed'}
                                  </Badge>
                                </div>
                                
                                {result.error && <div className="text-destructive mb-2">Error: {result.error}</div>}
                                
                                {result.data && (
                                  <div className="text-sm">
                                    {/* File Upload Service */}
                                    {result.service === "file_upload" && result.data.status_code && (
                                      <div>Status Code: {result.data.status_code}</div>
                                    )}
                                    
                                    {/* ClamAV Service */}
                                    {result.service === "clamav" && result.data.response && (
                                      <div className="bg-muted p-2 rounded mt-1">
                                        {result.data.response.infected !== undefined && (
                                          <div className={`font-medium ${result.data.response.infected ? 'text-destructive' : 'text-emerald-600'}`}>
                                            {result.data.response.infected 
                                              ? '⚠️ Malware Detected' 
                                              : '✅ No Malware Detected'}
                                          </div>
                                        )}
                                        {result.data.response.data?.result?.map((file, idx) => (
                                          <div key={idx} className="mt-1">
                                            <div>File: {file.name}</div>
                                            <div>Infected: {file.is_infected ? 'Yes' : 'No'}</div>
                                            {file.viruses && file.viruses.length > 0 && (
                                              <div>Threats: {file.viruses.join(', ')}</div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    {/* MinIO Storage Service */}
                                    {result.service === "minio" && (
                                      <div>
                                        <div>Bucket: {result.data.bucket}</div>
                                        <div>File: {result.data.object_name}</div>
                                        <div>Size: {formatBytes(result.data.size)}</div>
                                        <div>ETag: {result.data.etag}</div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div
        className={`fixed bottom-5 right-5 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden transition-all duration-300 ease-in-out min-w-[50px] max-w-[250px] ${
          expanded ? "w-[200px] h-auto" : "w-[50px] h-[50px]"
        }`}
      >        <div
          className="flex justify-between items-center p-2.5 cursor-pointer bg-muted border-b border-border select-none"
          onClick={toggleExpanded}
        >
          <div className="flex items-center gap-2">
            <div              className={`w-3 h-3 rounded-full ${
                disconnecting
                  ? "bg-yellow-500 animate-pulse animate-pulse-glow"
                  : isConnectionUnstable
                  ? "bg-yellow-500 animate-pulse"
                  : isConnected
                  ? "bg-emerald-500 shadow-[0_0_5px_rgb(34,197,94)]"
                  : "bg-destructive shadow-[0_0_5px_hsl(var(--destructive))]"
              }`}
            ></div>            {expanded && (
              <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                {disconnecting
                  ? "Disconnecting..."
                  : isConnectionUnstable
                  ? "Unstable"
                  : isConnected
                  ? "Connected"
                  : connectionState}
              </span>
            )}
          </div>          <Button variant="ghost" size="sm" className="p-0">
            {expanded ? "▼" : "▲"}
          </Button>
        </div>

        {expanded && (
          <div className="p-2.5">            {/* Session share button */}
            <div className="mb-2 flex items-center gap-2">
              <Button
                onClick={handleShareSession}
                title="Copy connection ID to clipboard"
                disabled={copiedToClipboard}
                size="sm"
                variant="default"
              >
                {copiedToClipboard ? <ClipboardCheck className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
              </Button>
            </div>

            {/* Upload UI */}
            {connectionId && OfficeSession && (
              <div className="mb-2 flex items-center gap-2">
                <Button
                  onClick={handleFileUploadClick}
                  disabled={uploading}
                  title="Upload File"
                  size="sm"
                >
                  <Upload className="w-4 h-4" />
                </Button>
                
                {/* view upload logs button */}
                <Button
                  onClick={handleShowLogs}
                  title="View file upload history"
                  disabled={uploadHistory.length === 0}
                  size="sm"
                  variant="secondary"
                  className="relative"
                >
                  <Download className="w-4 h-4" />
                  {uploadHistory.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                      {uploadHistory.length}
                    </Badge>
                  )}
                </Button>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                  {uploading && (
                  <div className="w-24">
                    <Progress value={uploadProgress} className="h-2" />
                    <div className="text-xs text-muted-foreground mt-1">
                      {uploadProgress}%
                    </div>
                  </div>
                )}
                {uploadSuccess && (
                  <div className="text-xs text-emerald-600 animate-pulse">✓</div>
                )}
                {uploadError && (
                  <div className="text-xs text-destructive">{uploadError}</div>
                )}
              </div>
            )}
              <Button
              variant={disconnecting ? "outline" : isConnected ? "destructive" : "secondary"}
              disabled={!isConnected || disconnecting}
              onClick={handleDisconnect}
              className="w-full relative overflow-hidden"
            >
              {disconnecting && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </span>
              )}              <span className={disconnecting ? "opacity-0" : ""}>
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </span>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default WebSocketControl;
