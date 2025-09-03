import { Badge } from '@/components/ui/badge';
import { Users, Share2 } from 'lucide-react';

const SessionCollaborationInfo = ({ 
  sessionInfo = { userCount: 1, isShared: false },
  connectionState, 
  isSessionOwner, 
  sharingEnabled = false, 
  enableSharing 
}) => {
  if (!sharingEnabled || !sessionInfo?.isShared) {
    return null;
  }

  return (
    <div className="bg-background/80 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Collaborative Session</span>
        <Badge variant="secondary" className="text-xs">
          {sessionInfo.userCount} {sessionInfo.userCount === 1 ? 'user' : 'users'}
        </Badge>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Share2 className="w-3 h-3" />
        <span>
          {isSessionOwner ? 'You are the session owner' : 'You are a participant'}
        </span>
      </div>
      
      {String(connectionState).toLowerCase() === 'connected' && (
        <div className="mt-2 text-xs text-green-600">
          ✓ Connected and sharing
        </div>
      )}
    </div>
  );
};

export default SessionCollaborationInfo; 