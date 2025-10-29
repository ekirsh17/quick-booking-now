import { createContext, useContext, useState, ReactNode } from 'react';

type ViewMode = 'merchant' | 'consumer';

interface AdminContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isAdminMode: boolean;
  toggleAdminMode: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('merchant');
  const [isAdminMode, setIsAdminMode] = useState(true); // Set to true for easy testing

  const toggleAdminMode = () => setIsAdminMode(!isAdminMode);

  return (
    <AdminContext.Provider value={{ viewMode, setViewMode, isAdminMode, toggleAdminMode }}>
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
