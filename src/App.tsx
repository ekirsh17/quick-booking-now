import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminProvider } from "@/contexts/AdminContext";
import { AdminToggle } from "@/components/admin/AdminToggle";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import ConsumerNotify from "./pages/ConsumerNotify";
import QRRedirect from "./pages/QRRedirect";
import ClaimBooking from "./pages/ClaimBooking";
import BookingConfirmed from "./pages/BookingConfirmed";
import MerchantLogin from "./pages/merchant/Login";
import Onboarding from "./pages/merchant/Onboarding";

import Openings from "./pages/merchant/Openings";
import Analytics from "./pages/merchant/Analytics";
import Settings from "./pages/merchant/Settings";
import QRCodePage from "./pages/merchant/QRCode";
import MyNotifications from "./pages/consumer/MyNotifications";
import ConsumerSignIn from "./pages/consumer/SignIn";
import ConsumerSettings from "./pages/consumer/Settings";
import Tools from "./pages/Tools";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AdminProvider>
            <AdminToggle />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/notify/:businessId" element={<ConsumerNotify />} />
          <Route path="/r/:shortCode" element={<QRRedirect />} />
          <Route path="/claim/:slotId" element={<ClaimBooking />} />
          <Route path="/booking-confirmed/:slotId" element={<BookingConfirmed />} />
          <Route path="/my-notifications" element={<MyNotifications />} />
              <Route path="/consumer/sign-in" element={<ConsumerSignIn />} />
              <Route path="/consumer/settings" element={<ConsumerSettings />} />
              <Route path="/merchant/login" element={<MerchantLogin />} />
              <Route path="/merchant/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/merchant/openings" element={<ProtectedRoute><Openings /></ProtectedRoute>} />
              
              <Route path="/merchant/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/merchant/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/merchant/qr-code" element={<ProtectedRoute><QRCodePage /></ProtectedRoute>} />
              <Route path="/tools" element={<Tools />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AdminProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
