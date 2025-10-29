/**
 * TEMPORARY DEVELOPMENT COMPONENT - REMOVE BEFORE PRODUCTION
 */

import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';

export function AdminBadge() {
  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
      <Shield className="h-3 w-3 mr-1" />
      Admin
    </Badge>
  );
}
