import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
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
import Returns from "./pages/Returns";
import Compras from "./pages/Compras";
import Promotions from "./pages/Promotions";
import Team from "./pages/Team";
import Fiscal from "./pages/Fiscal";
import SuperAdmin from "./pages/SuperAdmin";
import NotFound from "./pages/NotFound";
import AcceptInvitation from "./pages/AcceptInvitation";
import Warehouses from "./pages/Warehouses";
import Validades from "./pages/Validades";
import Cardapio from "./pages/Cardapio";
import Cozinha from "./pages/Cozinha";
import Pedidos from "./pages/Pedidos";
import Garcom from "./pages/Garcom";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
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
                <Route path="/returns" element={<OnboardingGuard><Returns /></OnboardingGuard>} />
                <Route path="/compras" element={<OnboardingGuard><Compras /></OnboardingGuard>} />
                <Route path="/suppliers" element={<OnboardingGuard><Compras /></OnboardingGuard>} />
                <Route path="/purchase-orders" element={<OnboardingGuard><Compras /></OnboardingGuard>} />
                <Route path="/promotions" element={<OnboardingGuard><Promotions /></OnboardingGuard>} />
                <Route path="/team" element={<OnboardingGuard><Team /></OnboardingGuard>} />
                <Route path="/fiscal" element={<OnboardingGuard><Fiscal /></OnboardingGuard>} />
                <Route path="/warehouses" element={<OnboardingGuard><Warehouses /></OnboardingGuard>} />
                <Route path="/validades" element={<OnboardingGuard><Validades /></OnboardingGuard>} />
                <Route path="/cardapio" element={<OnboardingGuard><Cardapio /></OnboardingGuard>} />
                <Route path="/cozinha" element={<OnboardingGuard><Cozinha /></OnboardingGuard>} />
                <Route path="/pedidos" element={<OnboardingGuard><Pedidos /></OnboardingGuard>} />
                <Route path="/garcom" element={<Garcom />} />
                <Route path="/super-admin" element={<SuperAdmin />} />
                <Route path="/invite/:token" element={<AcceptInvitation />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </CompanyProvider>
      </TenantProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
