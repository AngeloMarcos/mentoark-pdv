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
import { AuthGuard } from "@/components/auth/AuthGuard";
import Index from "./pages/Index";
import ResetPassword from "./pages/ResetPassword";
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
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/select-tenant" element={<AuthGuard requireTenant={false}><SelectTenant /></AuthGuard>} />
                <Route path="/dashboard" element={<AuthGuard><OnboardingGuard><Dashboard /></OnboardingGuard></AuthGuard>} />
                <Route path="/products" element={<AuthGuard><OnboardingGuard><Products /></OnboardingGuard></AuthGuard>} />
                <Route path="/pdv" element={<AuthGuard><OnboardingGuard><PDV /></OnboardingGuard></AuthGuard>} />
                <Route path="/sales-report" element={<AuthGuard><OnboardingGuard><SalesReport /></OnboardingGuard></AuthGuard>} />
                <Route path="/reports" element={<AuthGuard><OnboardingGuard><Reports /></OnboardingGuard></AuthGuard>} />
                <Route path="/stock" element={<AuthGuard><OnboardingGuard><Stock /></OnboardingGuard></AuthGuard>} />
                <Route path="/financial" element={<AuthGuard><OnboardingGuard><Financial /></OnboardingGuard></AuthGuard>} />
                <Route path="/tables" element={<AuthGuard><OnboardingGuard><Tables /></OnboardingGuard></AuthGuard>} />
                <Route path="/tabs/:tabId" element={<AuthGuard><OnboardingGuard><TabOrder /></OnboardingGuard></AuthGuard>} />
                <Route path="/customers" element={<AuthGuard><OnboardingGuard><Customers /></OnboardingGuard></AuthGuard>} />
                <Route path="/settings" element={<AuthGuard><OnboardingGuard><Settings /></OnboardingGuard></AuthGuard>} />
                <Route path="/cash-register" element={<AuthGuard><OnboardingGuard><CashRegister /></OnboardingGuard></AuthGuard>} />
                <Route path="/inventory" element={<AuthGuard><OnboardingGuard><Inventory /></OnboardingGuard></AuthGuard>} />
                <Route path="/returns" element={<AuthGuard><OnboardingGuard><Returns /></OnboardingGuard></AuthGuard>} />
                <Route path="/compras" element={<AuthGuard><OnboardingGuard><Compras /></OnboardingGuard></AuthGuard>} />
                <Route path="/suppliers" element={<AuthGuard><OnboardingGuard><Compras /></OnboardingGuard></AuthGuard>} />
                <Route path="/purchase-orders" element={<AuthGuard><OnboardingGuard><Compras /></OnboardingGuard></AuthGuard>} />
                <Route path="/promotions" element={<AuthGuard><OnboardingGuard><Promotions /></OnboardingGuard></AuthGuard>} />
                <Route path="/team" element={<AuthGuard><OnboardingGuard><Team /></OnboardingGuard></AuthGuard>} />
                <Route path="/fiscal" element={<AuthGuard><OnboardingGuard><Fiscal /></OnboardingGuard></AuthGuard>} />
                <Route path="/warehouses" element={<AuthGuard><OnboardingGuard><Warehouses /></OnboardingGuard></AuthGuard>} />
                <Route path="/validades" element={<AuthGuard><OnboardingGuard><Validades /></OnboardingGuard></AuthGuard>} />
                <Route path="/cardapio" element={<AuthGuard><OnboardingGuard><Cardapio /></OnboardingGuard></AuthGuard>} />
                <Route path="/cozinha" element={<AuthGuard><OnboardingGuard><Cozinha /></OnboardingGuard></AuthGuard>} />
                <Route path="/pedidos" element={<AuthGuard><OnboardingGuard><Pedidos /></OnboardingGuard></AuthGuard>} />
                <Route path="/garcom" element={<AuthGuard><Garcom /></AuthGuard>} />
                <Route path="/super-admin" element={<AuthGuard requireTenant={false} requireSuperAdmin><SuperAdmin /></AuthGuard>} />
                <Route path="/invite/:token" element={<AuthGuard requireTenant={false}><AcceptInvitation /></AuthGuard>} />
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
