import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

type ViewMode = 'merchant' | 'consumer';
type SlotRow = Database["public"]["Tables"]["slots"]["Row"];

interface AdminContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isAdminMode: boolean;
  toggleAdminMode: () => void;
  testMerchantId: string | null;
  setTestMerchantId: (id: string) => void;
  availableSlots: SlotRow[];
  refreshTestData: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('merchant');
  // Admin mode disabled by default in production - only enable in dev or with explicit env var
  const [isAdminMode, setIsAdminMode] = useState(
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN === 'true'
  );
  const [testMerchantId, setTestMerchantId] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<SlotRow[]>([]);
  const { user, userType } = useAuth();
  const location = useLocation();
  const isProcessingRef = useRef(false);

  const toggleAdminMode = () => setIsAdminMode(!isAdminMode);

  // Helper to extract merchant ID from current route
  const extractMerchantFromRoute = async (): Promise<string | null> => {
    const path = location.pathname;
    
    // Check /notify/:businessId pattern
    const notifyMatch = path.match(/^\/notify\/([0-9a-f-]{36})/i);
    if (notifyMatch) {
      console.log('[AdminContext] Extracted merchant from /notify route:', notifyMatch[1]);
      return notifyMatch[1];
    }

    // Check /claim/:slotId pattern - fetch slot to get merchant_id
    const claimMatch = path.match(/^\/claim\/([0-9a-f-]{36})/i);
    if (claimMatch) {
      const { data: slot } = await supabase
        .from('slots')
        .select('merchant_id')
        .eq('id', claimMatch[1])
        .maybeSingle();
      if (slot) {
        console.log('[AdminContext] Extracted merchant from /claim slot:', slot.merchant_id);
        return slot.merchant_id;
      }
    }

    // Check /booking-confirmed/:slotId pattern
    const bookingMatch = path.match(/^\/booking-confirmed\/([0-9a-f-]{36})/i);
    if (bookingMatch) {
      const { data: slot } = await supabase
        .from('slots')
        .select('merchant_id')
        .eq('id', bookingMatch[1])
        .maybeSingle();
      if (slot) {
        console.log('[AdminContext] Extracted merchant from /booking-confirmed slot:', slot.merchant_id);
        return slot.merchant_id;
      }
    }

    return null;
  };

  // Set merchant ID based on priority: route-derived (consumer) > logged-in merchant > fallback
  useEffect(() => {
    if (!isAdminMode || isProcessingRef.current) return;

    const determineMerchantId = async () => {
      isProcessingRef.current = true;
      
      try {
        // Priority 1: Consumer view + route-derived merchant
        if (viewMode === 'consumer') {
          const routeMerchantId = await extractMerchantFromRoute();
          if (routeMerchantId && routeMerchantId !== testMerchantId) {
            setTestMerchantId(routeMerchantId);
            console.log('[AdminContext] Using route-derived merchant (consumer view):', routeMerchantId);
            return;
          }
          if (routeMerchantId) return; // Already set, no change needed
        }

        // Priority 2: Merchant view + logged-in merchant
        if (viewMode === 'merchant' && user && userType === 'merchant') {
          if (user.id !== testMerchantId) {
            setTestMerchantId(user.id);
            console.log('[AdminContext] Using logged-in merchant:', user.id);
          }
          return;
        }

        // Priority 3: Fallback to first merchant (only if no merchant set)
        if (!testMerchantId) {
          fetchTestMerchant();
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    determineMerchantId();
  }, [isAdminMode, viewMode, user, userType, location.pathname, testMerchantId]);

  const fetchTestMerchant = async () => {
    const { data: merchant } = await supabase
      .from('profiles')
      .select('id, business_name')
      .limit(1)
      .maybeSingle();
    
    if (merchant) {
      setTestMerchantId(merchant.id);
      console.log('[AdminContext] Test merchant loaded:', merchant.id);
    }
  };

  const refreshTestData = async () => {
    if (!testMerchantId) return;

    // Get future open slots for this merchant
    const { data: slots } = await supabase
      .from('slots')
      .select('*')
      .eq('merchant_id', testMerchantId)
      .eq('status', 'open')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(5);
    
    if (slots) {
      setAvailableSlots(slots);
      console.log('[AdminContext] Available slots refreshed:', slots.length);
    }
  };

  // Refresh slots when testMerchantId changes
  useEffect(() => {
    if (testMerchantId) {
      refreshTestData();
    }
  }, [testMerchantId]);

  return (
    <AdminContext.Provider value={{ 
      viewMode, 
      setViewMode, 
      isAdminMode, 
      toggleAdminMode,
      testMerchantId,
      setTestMerchantId,
      availableSlots,
      refreshTestData,
    }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};
