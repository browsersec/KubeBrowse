import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function NewConnectionRoute() {
  const navigate = useNavigate();
  const { addConnection } = useOutletContext();

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

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [id]: type === 'checkbox' ? checked : value
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const newConnection = addConnection(formData);
      navigate('/');
    } catch (error) {
      console.error("Failed to add connection:", error);
      setError("Failed to save connection. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>New Connection</CardTitle>
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
                  pattern="^$|^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$"
                  title="Port number must be between 1 and 65535"
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
                  value={formData.password}
                  onChange={handleInputChange}
                  autoComplete="new-password"
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

              {error && <div className="text-destructive text-sm">{error}</div>}

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Connection'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
} 