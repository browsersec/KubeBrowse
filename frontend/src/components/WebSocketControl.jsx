import { useState, useEffect, useRef } from "react";
import { Upload, Clipboard, ClipboardCheck, Download, X, ChevronDown, ChevronUp, AlertTriangle, Clock, Plus } from "lucide-react";
import toast from 'react-hot-toast';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const API_BASE = ""; // Use relative URLs to leverage Vite's proxy

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
  timeLeft = null,
  onExtendSession = null,
}) {
  const [expanded, setExpanded] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [animationTimeout, setAnimationTimeout] = useState(null);
  const [extending, setExtending] = useState(false);
  const [timeLeftData, setTimeLeftData] = useState(null);
  const [fetchingTime, setFetchingTime] = useState(false);
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

  // Format time display (MM:SS)
  const formatTime = (seconds) => {
    if (!seconds) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Show toast when connection becomes unstable
  useEffect(() => {
    if (isConnectionUnstable) {
      toast.error("WebSocket connection is unstable", {
        duration: 4000,
      });
    }
  }, [isConnectionUnstable]);

  // Show toast when there is a tunnel error
  useEffect(() => {
    if (connectionState === 'TUNNEL_ERROR') {
      toast.error(errorMessage || 'Unable to connect', {
        duration: 4000,
      });
    }
  }, [connectionState, errorMessage]);

  // Fetch time left data from API
  const fetchTimeLeft = async () => {
    if (!connectionId || fetchingTime) return;
    
    setFetchingTime(true);
    try {
      const response = await fetch(`${API_BASE}/sessions/${connectionId}/time-left`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch time left");
      }
      
      const data = await response.json();
      setTimeLeftData(data);
    } catch (error) {
      console.error("Failed to fetch time left:", error);
      // Don't show toast for this error as it's a background operation
    } finally {
      setFetchingTime(false);
    }
  };

  // Auto-fetch time left when component mounts and when connected
  useEffect(() => {
    const isConnected = connectionState === 'CONNECTED';
    if (connectionId && isConnected) {
      fetchTimeLeft();
      
      // Set up interval to fetch time left every 30 seconds
      const interval = setInterval(fetchTimeLeft, 30000);
      
      return () => clearInterval(interval);
    }
  }, [connectionId, connectionState]);

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
    }
  };
  
  // function to check for malware in the upload response
  const checkForMalware = (response) => {
    try {
      // Find the ClamAV result
      const clamavResult = response.results.find(result => result.service === "clamav");
      
      if (clamavResult && clamavResult.success && clamavResult.data?.response?.infected) {
        // Get the viruses list if available
        const viruses = clamavResult.data.response.viruses || [];
        const virusNames = viruses.length > 0 ? viruses.join(', ') : 'Unknown threat';
        
        // Show a prominent warning toast
        toast.error(`😈 Malware Detected! The file may contain malicious content.${viruses.length > 0 ? ` Detected: ${virusNames}` : ''}`, {
          duration: 6000,
        });
      } else {
        // Show success toast
        toast.success("File has been scanned and is safe", {
          duration: 4000,
        });
      }
    } catch (error) {
      console.error("Error checking for malware:", error);
      toast("File uploaded but scan results unavailable", {
        duration: 4000,
      });
    }
  };

  const handleShareSession = async () => {
    if (!connectionId) return;
    
    try {
      await navigator.clipboard.writeText(connectionId);
      setCopiedToClipboard(true);
      toast.success("Connection ID has been copied to clipboard", {
        duration: 3000,
      });
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      toast.error("Failed to copy connection ID to clipboard", {
        duration: 4000,
      });
    }
  };

  const toggleLogExpansion = (index) => {
    setExpandedLogs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleShowLogs = () => {
    setIsModalOpen(true);
  };

  // Extend session time
  const handleExtendSession = async () => {
    if (!connectionId || extending) return;
    
    setExtending(true);
    try {
      const response = await fetch(`${API_BASE}/sessions/${connectionId}/extend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectionID: connectionId,
          ExtensionMinutes: 5
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to extend session");
      }
      
      const data = await response.json();
      toast.success("Session extended successfully", {
        duration: 3000,
      });
      
      // Refresh time left data after successful extension
      fetchTimeLeft();
      
      // Call the parent's onExtendSession if it exists (for backward compatibility)
      if (onExtendSession) {
        onExtendSession();
      }
    } catch (error) {
      console.error("Failed to extend session:", error);
      toast.error("Failed to extend session", {
        duration: 4000,
      });
    } finally {
      setExtending(false);
    }
  };

  const isConnected = connectionState === 'CONNECTED';

  return (
    <>
      {/* Upload History Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>File Upload History</DialogTitle>
            <DialogDescription>
              View details of all uploaded files and their scan results
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {uploadHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No upload history available
              </div>
            ) : (
              uploadHistory.map((upload, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{upload.filename}</CardTitle>
                        <Badge variant={upload.results?.some(r => r.success && r.data?.response?.infected) ? "destructive" : "default"}>
                          {upload.results?.some(r => r.success && r.data?.response?.infected) ? "Infected" : "Clean"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLogExpansion(index)}
                      >
                        {expandedLogs[index] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {upload.timestamp.toLocaleString()}
                    </div>
                  </CardHeader>
                  
                  {expandedLogs[index] && (
                    <CardContent>
                      <div className="space-y-3">
                        {upload.results?.map((result, resultIndex) => (
                          <div key={resultIndex} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{result.service}</span>
                              <Badge variant={result.success ? "default" : "destructive"}>
                                {result.success ? "Success" : "Failed"}
                              </Badge>
                            </div>
                            
                            {result.success && result.data && (
                              <div className="space-y-2 text-sm">
                                {result.data.response?.infected && (
                                  <div className="flex items-center gap-2 text-destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>Malware detected!</span>
                                  </div>
                                )}
                                
                                {result.data.response?.viruses && result.data.response.viruses.length > 0 && (
                                  <div>
                                    <span className="font-medium">Detected threats:</span>
                                    <ul className="list-disc list-inside ml-2">
                                      {result.data.response.viruses.map((virus, virusIndex) => (
                                        <li key={virusIndex}>{virus}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {result.data.response?.size && (
                                  <div>
                                    <span className="font-medium">File size:</span> {formatBytes(result.data.response.size)}
                                  </div>
                                )}
                                
                                {result.data.response?.scan_time && (
                                  <div>
                                    <span className="font-medium">Scan time:</span> {result.data.response.scan_time}ms
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {!result.success && result.error && (
                              <div className="text-sm text-destructive">
                                Error: {result.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Card
        className={cn(
          "fixed bottom-5 right-5 z-50 transition-all duration-300 ease-in-out",
          expanded ? "w-[200px]" : "w-[50px]"
        )}
      >
        <CardHeader className="p-2.5 cursor-pointer select-none" onClick={toggleExpanded}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-3 h-3 rounded-full",
                  disconnecting
                    ? "bg-yellow-500 animate-pulse"
                    : isConnectionUnstable
                    ? "bg-yellow-500 animate-pulse"
                    : isConnected
                    ? "bg-green-500"
                    : "bg-red-500"
                )}
              />
              {expanded && (
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
              {expanded && timeLeftData && isConnected && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className={timeLeftData.total_seconds < 300 ? "text-orange-500 font-medium" : ""}>
                    {timeLeftData.time_left}
                  </span>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="p-2.5 space-y-2">
            {/* Extend session button */}
            {timeLeftData && isConnected && timeLeftData.can_extend && (
              <Button
                onClick={handleExtendSession}
                variant="outline"
                size="sm"
                disabled={extending}
                className="w-full flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {extending ? "Extending..." : "Extend"}
              </Button>
            )}
            
            {/* Session share button */}
            <Button
              onClick={handleShareSession}
              title="Copy connection ID to clipboard"
              variant="outline"
              size="sm"
              disabled={copiedToClipboard}
              className="w-full"
            >
              {copiedToClipboard ? (
                <ClipboardCheck className="w-4 h-4" />
              ) : (
                <Clipboard className="w-4 h-4" />
              )}
            </Button>

            {/* Upload UI */}
            {connectionId && OfficeSession && (
              <div className="space-y-2">
                <Button
                  onClick={handleFileUploadClick}
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  title="Upload File"
                  className="w-full"
                >
                  <Upload className="w-4 h-4" />
                </Button>
                
                <Button
                  onClick={handleShowLogs}
                  title="View file upload history"
                  variant="outline"
                  size="sm"
                  disabled={uploadHistory.length === 0}
                  className="w-full relative"
                >
                  <Download className="w-4 h-4" />
                  {uploadHistory.length > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
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
                  <div className="space-y-1">
                    <Progress value={uploadProgress} className="h-2" />
                    <div className="text-xs text-muted-foreground text-center">
                      {uploadProgress}%
                    </div>
                  </div>
                )}
                
                {uploadSuccess && (
                  <div className="text-xs text-green-600 text-center animate-pulse">✓ Upload Complete</div>
                )}
                
                {uploadError && (
                  <div className="text-xs text-red-600 text-center">{uploadError}</div>
                )}
              </div>
            )}
            
            <Button
              variant={disconnecting ? "secondary" : isConnected ? "destructive" : "secondary"}
              size="sm"
              onClick={handleDisconnect}
              disabled={!isConnected || disconnecting}
              className="w-full"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </Button>
          </CardContent>
        )}
      </Card>
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

