import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SelectTenant from "./pages/SelectTenant";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import PDV from "./pages/PDV";
import SalesReport from "./pages/SalesReport";
import Stock from "./pages/Stock";
import Financial from "./pages/Financial";
import Tables from "./pages/Tables";
import TabOrder from "./pages/TabOrder";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/select-tenant" element={<SelectTenant />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/pdv" element={<PDV />} />
              <Route path="/sales-report" element={<SalesReport />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/financial" element={<Financial />} />
              <Route path="/tables" element={<Tables />} />
              <Route path="/tabs/:tabId" element={<TabOrder />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
