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
import ClaimBooking from "./pages/ClaimBooking";
import BookingConfirmed from "./pages/BookingConfirmed";
import MerchantLogin from "./pages/merchant/Login";
import MerchantDashboard from "./pages/merchant/Dashboard";
import Openings from "./pages/merchant/Openings";
import Analytics from "./pages/merchant/Analytics";
import Settings from "./pages/merchant/Settings";
import QRCodePage from "./pages/merchant/QRCode";
import MyNotifications from "./pages/consumer/MyNotifications";
import ConsumerSignIn from "./pages/consumer/SignIn";
import ConsumerSettings from "./pages/consumer/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <AdminProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AdminToggle />
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/notify/:businessId" element={<ConsumerNotify />} />
          <Route path="/claim/:slotId" element={<ClaimBooking />} />
          <Route path="/booking-confirmed/:slotId" element={<BookingConfirmed />} />
          <Route path="/my-notifications" element={<MyNotifications />} />
          <Route path="/consumer/sign-in" element={<ConsumerSignIn />} />
          <Route path="/consumer/settings" element={<ConsumerSettings />} />
          <Route path="/merchant/login" element={<MerchantLogin />} />
          <Route path="/merchant/openings" element={<ProtectedRoute><Openings /></ProtectedRoute>} />
          <Route path="/merchant/dashboard" element={<ProtectedRoute><MerchantDashboard /></ProtectedRoute>} />
          <Route path="/merchant/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/merchant/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/merchant/qr-code" element={<ProtectedRoute><QRCodePage /></ProtectedRoute>} />
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
