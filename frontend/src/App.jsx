import { useState, useEffect } from 'react';
import GuacClient from './components/GuacClient';
import OfficeSession from './components/OfficeSession';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

function App() {
  const [activeTab, setActiveTab] = useState('office'); // 'office' or 'manual'
  const [connect, setConnect] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [formData, setFormData] = useState({
    scheme: 'rdp',
    hostname: '0.0.0.0',
    port: '',
    user: '',
    pass: '',
    ignoreCert: true,
    security: '',
    forceHttp: false,
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    // Load saved connection details from localStorage on mount
    if (window.localStorage && window.localStorage.getItem('query')) {
      try {
        const query = JSON.parse(window.localStorage.getItem('query'));
        setFormData({
          scheme: query.scheme || 'rdp',
          hostname: query.hostname || '0.0.0.0',
          port: query.port || '',
          user: query.username || '',
          pass: query.password || '',
          ignoreCert: query['ignore-cert'] !== false,
          security: query.security || '',
          forceHttp: query.forceHttp || false,
          width: window.innerWidth,
          height: window.innerHeight
        });
      } catch (e) {
        window.localStorage.setItem('query', '{}');
      }
    }

    // Update dimensions if window is resized before connection
    const handleResize = () => {
      setFormData(prevData => ({
        ...prevData,
        width: window.innerWidth,
        height: window.innerHeight
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [id]: type === 'checkbox' ? checked : value
    });
  };

  const buildQueryObj = () => {
    return {
      scheme: formData.scheme,
      hostname: formData.hostname,
      port: formData.port,
      'ignore-cert': formData.ignoreCert,
      security: formData.security,
      username: formData.user,
      password: formData.pass,
      width: Math.round(formData.width * (window.devicePixelRatio || 1)),
      height: Math.round(formData.height * (window.devicePixelRatio || 1))
    };
  };

  const buildQueryString = () => {
    const queryString = [];
    const queryObj = buildQueryObj();
    
    for (const [k, v] of Object.entries(queryObj)) {
      if (v) {
        queryString.push(`${k}=${encodeURIComponent(v)}`);
      }
    }
    
    console.log(queryString.join("&"))
    
    return queryString.join("&");
  };

  const getScrubbedQuery = () => {
    return buildQueryString().replace(/password=[^&]+/, 'password=****');
  };

  const handleConnect = () => {
    if (window.localStorage) {
      window.localStorage.setItem('query', JSON.stringify(buildQueryObj()));
    }
    setTransitioning(true);
    setTimeout(() => {
      setConnect(true);
      setTransitioning(false);
    }, 300);
  };

  const handleDisconnected = () => {
    setTransitioning(true);
    setTimeout(() => {
      setConnect(false);
      setTransitioning(false);
    }, 300);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="office">Office Session</TabsTrigger>
          <TabsTrigger value="manual">Manual Connection</TabsTrigger>
        </TabsList>
        
        <TabsContent value="office" className="mt-6">
          <OfficeSession />
        </TabsContent>
        
        <TabsContent value="manual" className="mt-6">
          {!connect ? (
            <Card>
              <CardHeader>
                <CardTitle>React Guacamole client example</CardTitle>
                <CardDescription>Enter connection information to connect</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="scheme">Scheme/Protocol</Label>
                  <Input 
                    type="text" 
                    id="scheme" 
                    value={formData.scheme} 
                    onChange={handleInputChange} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hostname">Hostname or IP Address</Label>
                  <Input 
                    type="text" 
                    id="hostname" 
                    value={formData.hostname} 
                    onChange={handleInputChange} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">Port (if not default)</Label>
                  <Input 
                    type="text" 
                    id="port" 
                    value={formData.port} 
                    onChange={handleInputChange} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user">User name</Label>
                  <Input 
                    type="text" 
                    id="user" 
                    value={formData.user} 
                    onChange={handleInputChange} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pass">Password</Label>
                  <Input 
                    type="password" 
                    id="pass" 
                    value={formData.pass} 
                    onChange={handleInputChange} 
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="ignoreCert" 
                    checked={formData.ignoreCert} 
                    onCheckedChange={(checked) => setFormData({...formData, ignoreCert: checked})}
                  />
                  <Label htmlFor="ignoreCert">Ignore Certificate</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="security">Security</Label>
                  <Input 
                    type="text" 
                    id="security" 
                    value={formData.security} 
                    onChange={handleInputChange} 
                    placeholder="type nla here for Network Level Authentication" 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Query string</Label>
                  <div className="p-2 bg-muted rounded text-sm font-mono overflow-x-auto whitespace-pre">
                    {getScrubbedQuery()}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="forceHttp" 
                    checked={formData.forceHttp} 
                    onCheckedChange={(checked) => setFormData({...formData, forceHttp: checked})}
                  />
                  <Label htmlFor="forceHttp">Force HTTP Tunnel</Label>
                </div>

                <div className="flex justify-center pt-4">
                  <Button onClick={handleConnect}>
                    Connect
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <GuacClient 
              query={buildQueryString()} 
              forceHttp={formData.forceHttp} 
              onDisconnected={handleDisconnected}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;