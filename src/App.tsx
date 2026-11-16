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
import { useAppVersionCheck } from "@/hooks/useAppVersionCheck";
import { Suspense } from "react";
import { lazyPage, PageFallback } from "@/lib/lazy-page";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PDV from "./pages/PDV";
import NotFound from "./pages/NotFound";

// Code-splitting por rota: login e PDV entram no bundle inicial; as demais
// telas (relatórios, PDF, planilhas, gráficos...) só baixam quando abertas.
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));
const SelectTenant = lazyPage(() => import("./pages/SelectTenant"));
const Dashboard = lazyPage(() => import("./pages/Dashboard"));
const Products = lazyPage(() => import("./pages/Products"));
const SalesReport = lazyPage(() => import("./pages/SalesReport"));
const Reports = lazyPage(() => import("./pages/Reports"));
const Stock = lazyPage(() => import("./pages/Stock"));
const Financial = lazyPage(() => import("./pages/Financial"));
const Tables = lazyPage(() => import("./pages/Tables"));
const TabOrder = lazyPage(() => import("./pages/TabOrder"));
const Customers = lazyPage(() => import("./pages/Customers"));
const Settings = lazyPage(() => import("./pages/Settings"));
const CashRegister = lazyPage(() => import("./pages/CashRegister"));
const Inventory = lazyPage(() => import("./pages/Inventory"));
const Returns = lazyPage(() => import("./pages/Returns"));
const Compras = lazyPage(() => import("./pages/Compras"));
const Promotions = lazyPage(() => import("./pages/Promotions"));
const Team = lazyPage(() => import("./pages/Team"));
const Fiscal = lazyPage(() => import("./pages/Fiscal"));
const SuperAdmin = lazyPage(() => import("./pages/SuperAdmin"));
const AcceptInvitation = lazyPage(() => import("./pages/AcceptInvitation"));
const Warehouses = lazyPage(() => import("./pages/Warehouses"));
const Validades = lazyPage(() => import("./pages/Validades"));
const Cardapio = lazyPage(() => import("./pages/Cardapio"));
const Cozinha = lazyPage(() => import("./pages/Cozinha"));
const Pedidos = lazyPage(() => import("./pages/Pedidos"));
const Garcom = lazyPage(() => import("./pages/Garcom"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Após inatividade, revalida ao voltar para a aba / reconectar
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 30_000,
      retry: (failureCount, error: any) => {
        const status = error?.status ?? error?.code;
        if (status === 401 || status === 403) return failureCount < 2;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

const App = () => {
  useAppVersionCheck();

  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <TenantProvider>
        <CompanyProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageFallback />}>
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
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </CompanyProvider>
      </TenantProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
