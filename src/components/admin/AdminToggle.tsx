/**
 * TEMPORARY DEVELOPMENT COMPONENT - REMOVE BEFORE PRODUCTION
 */

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';

interface AdminToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function AdminToggle({ enabled, onToggle }: AdminToggleProps) {
  const { isAdmin } = useAdmin();

  if (!isAdmin) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b">
      <Shield className="h-4 w-4 text-amber-500" />
      <Label htmlFor="admin-mode" className="flex-1 cursor-pointer">
        Admin Mode
      </Label>
      <Switch
        id="admin-mode"
        checked={enabled}
        onCheckedChange={onToggle}
      />
    </div>
  );
}
