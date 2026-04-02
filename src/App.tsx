import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { OnboardingGuard } from "@/components/onboarding/OnboardingGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SelectTenant from "./pages/SelectTenant";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import PDV from "./pages/PDV";
import SalesReport from "./pages/SalesReport";
import Reports from "./pages/Reports";
import Stock from "./pages/Stock";
import Financial from "./pages/Financial";
import Tables from "./pages/Tables";
import TabOrder from "./pages/TabOrder";
import Customers from "./pages/Customers";
import Settings from "./pages/Settings";
import CashRegister from "./pages/CashRegister";
import Inventory from "./pages/Inventory";
import NotFound from "./pages/NotFound";
import AcceptInvitation from "./pages/AcceptInvitation";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <CompanyProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/select-tenant" element={<SelectTenant />} />
                <Route path="/dashboard" element={<OnboardingGuard><Dashboard /></OnboardingGuard>} />
                <Route path="/products" element={<OnboardingGuard><Products /></OnboardingGuard>} />
                <Route path="/pdv" element={<OnboardingGuard><PDV /></OnboardingGuard>} />
                <Route path="/sales-report" element={<OnboardingGuard><SalesReport /></OnboardingGuard>} />
                <Route path="/reports" element={<OnboardingGuard><Reports /></OnboardingGuard>} />
                <Route path="/stock" element={<OnboardingGuard><Stock /></OnboardingGuard>} />
                <Route path="/financial" element={<OnboardingGuard><Financial /></OnboardingGuard>} />
                <Route path="/tables" element={<OnboardingGuard><Tables /></OnboardingGuard>} />
                <Route path="/tabs/:tabId" element={<OnboardingGuard><TabOrder /></OnboardingGuard>} />
                <Route path="/customers" element={<OnboardingGuard><Customers /></OnboardingGuard>} />
                <Route path="/settings" element={<OnboardingGuard><Settings /></OnboardingGuard>} />
                <Route path="/cash-register" element={<OnboardingGuard><CashRegister /></OnboardingGuard>} />
                <Route path="/inventory" element={<OnboardingGuard><Inventory /></OnboardingGuard>} />
                <Route path="/invite/:token" element={<AcceptInvitation />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </CompanyProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
