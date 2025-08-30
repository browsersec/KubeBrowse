import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Chrome, Shredder, Share, Settings, Sun, Moon, ChevronLeft, ChevronRight, LogIn } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { UserMenu } from '../auth/UserMenu';
import { AuthModal } from '../auth/AuthModal';

export default function Sidebar() {
  const [expanded, setExpanded] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <motion.div 
      className={`h-screen bg-card border-r ${expanded ? 'w-64' : 'w-20'} transition-all duration-300 flex flex-col`}
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        {expanded ? (
          <h1 className="text-xl font-semibold">KubeBrowse</h1>
        ) : (
          <h1 className="text-xl font-semibold">KB</h1>
        )}
        <Button 
          variant="ghost"
          size="icon"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-grow overflow-y-auto py-6">
        <div className="mb-6 px-4">
          <NavLink 
            to="/browser-session"
            className={({ isActive }) => 
              `flex items-center py-3 px-4 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`
            }
          >
            <Chrome className="h-5 w-5" />
            {expanded && <span className="ml-3">Browser Session</span>}
          </NavLink>
        </div>
      
        <div className="mb-6 px-4">
          <NavLink 
            to="/office-session"
            className={({ isActive }) => 
              `flex items-center py-3 px-4 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`
            }
          >
            <Shredder className="h-5 w-5" />
            {expanded && <span className="ml-3">Office Session</span>}
          </NavLink>
        </div>

        <div className='mb-6 px-4'> 
          <NavLink 
            to="/share-ws-url"
            className={({ isActive }) => 
              `flex items-center py-3 px-4 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`
            }
          >
            <Share className="h-5 w-5" />
            {expanded && <span className="ml-3">Share WS URL</span>}
          </NavLink>
        </div>
      </nav>

      <div className="p-4 border-t border-border flex flex-col space-y-2">
        {/* Authentication Section */}
        {!isLoading && (
          <div className="mb-2">
            {isAuthenticated ? (
              <UserMenu />
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowAuthModal(true)}
                className={expanded ? "justify-start w-full" : "w-full"}
              >
                <LogIn className="h-5 w-5" />
                {expanded && <span className="ml-3">Sign In</span>}
              </Button>
            )}
          </div>
        )}

        <NavLink 
          to="/settings"
          className={({ isActive }) => 
            `flex items-center py-3 px-4 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`
          }
        >
          <Settings className="h-5 w-5" />
          {expanded && <span className="ml-3">Settings</span>}
        </NavLink>

        {expanded && (
          <Button
            variant="ghost"
            onClick={toggleTheme}
            className="justify-start"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="ml-3">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </Button>
        )}
        
        {!expanded && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </motion.div>
  );
}