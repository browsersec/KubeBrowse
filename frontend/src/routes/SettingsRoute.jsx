import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, User, Lock, Settings as SettingsIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SettingsRoute() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  
  const [settings, setSettings] = useState({
    theme: theme, // Use theme from context
    autoReconnect: true,
    inactivityTimeout: 30,
    language: 'en'
  });

  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    // Load settings from localStorage on mount
    if (window.localStorage) {
      try {
        const savedSettings = JSON.parse(window.localStorage.getItem('settings') || '{}');
        setSettings(prevSettings => ({
          ...prevSettings,
          ...savedSettings,
          theme: theme // Always use theme from context
        }));
      } catch (e) {
        // Handle error
      }
    }
  }, [theme]);

  const handleInputChange = (field, value) => {
    // If theme is changed, update the theme context
    if (field === 'theme') {
      setTheme(value);
    }
    
    setSettings(prevSettings => ({
      ...prevSettings,
      [field]: value
    }));
  };

  const handleSave = () => {
    // Save settings to localStorage
    if (window.localStorage) {
      window.localStorage.setItem('settings', JSON.stringify(settings));
      setSaveStatus('saved');
      
      setTimeout(() => {
        setSaveStatus(null);
      }, 2000);
    }
  };

  return (
    <div className="p-8">
      <motion.div 
        className="max-w-4xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold mb-6">Settings</h1>

        {/* Profile and Security Section */}
        {user && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Profile Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Update your profile information, avatar, and personal details.
                </p>
                <Link to="/profile">
                  <Button className="w-full" variant="outline">
                    <User className="h-4 w-4 mr-2" />
                    Manage Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lock className="h-5 w-5 mr-2" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Change your password and manage security settings.
                </p>
                <Link to="/password">
                  <Button className="w-full" variant="outline">
                    <Lock className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}

        {/* App Settings Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <SettingsIcon className="h-5 w-5 mr-2" />
              Application Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="theme">Theme</Label>
                <Select value={settings.theme} onValueChange={(value) => handleInputChange('theme', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System Default</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="language">Language</Label>
                <Select value={settings.language} onValueChange={(value) => handleInputChange('language', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="autoReconnect">Auto-reconnect on disconnect</Label>
                <Switch
                  id="autoReconnect"
                  checked={settings.autoReconnect}
                  onCheckedChange={(checked) => handleInputChange('autoReconnect', checked)}
                />
              </div>

              <div>
                <Label htmlFor="inactivityTimeout">Inactivity Timeout (minutes)</Label>
                <Input
                  type="number"
                  id="inactivityTimeout"
                  value={settings.inactivityTimeout}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(1440, parseInt(e.target.value, 10) || 0));
                    handleInputChange('inactivityTimeout', v);
                  }}
                  min="0"
                  max="1440"
                  step="1"
                  className="mt-1"
                />
                <p className="text-sm text-muted-foreground mt-1">Set to 0 to disable timeout</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveStatus === 'saved'}>
            {saveStatus === 'saved' ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved
              </>
            ) : 'Save Settings'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
} 