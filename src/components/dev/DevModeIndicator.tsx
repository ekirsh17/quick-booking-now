/**
 * TEMPORARY DEVELOPMENT COMPONENT - REMOVE BEFORE PRODUCTION
 * 
 * Visual indicator when dev features are enabled
 */

import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { FEATURES } from '@/config/features';

export function DevModeIndicator() {
  if (!FEATURES.DEBUG_MODE) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        DEV MODE
      </Badge>
    </div>
  );
}
