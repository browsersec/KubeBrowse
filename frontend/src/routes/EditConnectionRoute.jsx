import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';

export default function EditConnectionRoute() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { connections, updateConnection } = useOutletContext();
  
  const [formData, setFormData] = useState({
    name: '',
    scheme: 'rdp',
    hostname: '0.0.0.0',
    port: '',
    username: '',
    password: '',
    ignoreCert: true,
    security: '',
  });
  
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // Find the connection with the given ID
    const foundConnection = connections.find(conn => conn.id === id);
    
    if (!foundConnection) {
      setNotFound(true);
      return;
    }
    
    setFormData(foundConnection);
  }, [id, connections]);

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [id]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateConnection(id, formData);
    navigate('/');
  };

  if (notFound) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl text-destructive mb-4">Connection Not Found</CardTitle>
            <CardDescription className="mb-6">
              The connection you are trying to edit does not exist.
            </CardDescription>
            <Button onClick={() => navigate('/')} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Edit Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Connection Name</Label>
                <Input 
                  type="text" 
                  id="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  placeholder="My Connection"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="scheme">Scheme/Protocol</Label>
                <Select value={formData.scheme} onValueChange={(value) => setFormData({...formData, scheme: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rdp">RDP</SelectItem>
                    <SelectItem value="vnc">VNC</SelectItem>
                    <SelectItem value="ssh">SSH</SelectItem>
                    <SelectItem value="telnet">Telnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hostname">Hostname or IP Address</Label>
                <Input 
                  type="text" 
                  id="hostname" 
                  value={formData.hostname} 
                  onChange={handleInputChange} 
                  required
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
                <Label htmlFor="username">Username</Label>
                <Input 
                  type="text" 
                  id="username" 
                  value={formData.username} 
                  onChange={handleInputChange} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  type="password" 
                  id="password" 
                  value={formData.password || ''} 
                  onChange={handleInputChange} 
                  placeholder="Leave empty to keep current password"
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
                  placeholder="e.g., nla for Network Level Authentication" 
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Update Connection
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
} 