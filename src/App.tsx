import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminProvider } from "@/contexts/AdminContext"; // TEMPORARY - Remove before production
import ProtectedRoute from "@/components/ProtectedRoute";
import { DevModeIndicator } from "@/components/dev/DevModeIndicator"; // TEMPORARY - Remove before production
import { FEATURES } from "@/config/features"; // TEMPORARY - Remove before production
import Landing from "./pages/Landing";
import ConsumerNotify from "./pages/ConsumerNotify";
import ClaimBooking from "./pages/ClaimBooking";
import BookingConfirmed from "./pages/BookingConfirmed";
import MerchantLogin from "./pages/merchant/Login";
import MerchantDashboard from "./pages/merchant/Dashboard";
import AddAvailability from "./pages/merchant/AddAvailability";
import Analytics from "./pages/merchant/Analytics";
import Settings from "./pages/merchant/Settings";
import AdminDashboard from "./pages/admin/Dashboard"; // TEMPORARY - Remove before production
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AdminProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <DevModeIndicator /> {/* TEMPORARY - Remove before production */}
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/notify/:businessId" element={<ConsumerNotify />} />
              <Route path="/claim/:slotId" element={<ClaimBooking />} />
              <Route path="/booking-confirmed/:slotId" element={<BookingConfirmed />} />
              <Route path="/merchant/login" element={<MerchantLogin />} />
              <Route path="/merchant/dashboard" element={<ProtectedRoute><MerchantDashboard /></ProtectedRoute>} />
              <Route path="/merchant/add-availability" element={<ProtectedRoute><AddAvailability /></ProtectedRoute>} />
              <Route path="/merchant/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/merchant/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              
              {/* TEMPORARY ADMIN ROUTES - Remove before production */}
              {FEATURES.ADMIN_PANEL && (
                <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              )}
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AdminProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
