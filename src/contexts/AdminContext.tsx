import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { supabase } from '@/integrations/supabase/client';

type ViewMode = 'merchant' | 'consumer';

interface AdminContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isAdminMode: boolean;
  toggleAdminMode: () => void;
  testMerchantId: string | null;
  setTestMerchantId: (id: string) => void;
  availableSlots: any[];
  refreshTestData: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('merchant');
  const [isAdminMode, setIsAdminMode] = useState(true);
  const [testMerchantId, setTestMerchantId] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);

  const toggleAdminMode = () => setIsAdminMode(!isAdminMode);

  // Fetch test merchant on mount
  useEffect(() => {
    if (isAdminMode) {
      fetchTestMerchant();
    }
  }, [isAdminMode]);

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

    // Get available slots for this merchant
    const { data: slots } = await supabase
      .from('slots')
      .select('*')
      .eq('merchant_id', testMerchantId)
      .eq('status', 'open')
      .order('start_time', { ascending: true })
      .limit(5);
    
    if (slots) {
      setAvailableSlots(slots);
      console.log('[AdminContext] Available slots refreshed:', slots.length);
    }
  };

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
