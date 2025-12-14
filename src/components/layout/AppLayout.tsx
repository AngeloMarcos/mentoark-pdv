import { ReactNode, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FileBarChart,
  Warehouse,
  Wallet,
  Building2,
  LogOut,
  Menu,
  UtensilsCrossed,
  Users,
  Settings,
  Zap,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { path: "/pdv", label: "PDV", icon: ShoppingBag },
  { path: "/tables", label: "Mesas", icon: UtensilsCrossed },
  { path: "/products", label: "Produtos", icon: Package },
  { path: "/customers", label: "Clientes", icon: Users },
  { path: "/stock", label: "Estoque", icon: Warehouse },
  { path: "/sales-report", label: "Relatórios", icon: FileBarChart },
  { path: "/financial", label: "Financeiro", icon: Wallet },
  { path: "/settings", label: "Configurações", icon: Settings },
];

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { currentTenant, setCurrentTenant } = useTenant();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user && !currentTenant) {
      navigate("/select-tenant");
    }
  }, [user, currentTenant, authLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleChangeTenant = () => {
    setCurrentTenant(null);
    navigate("/select-tenant");
  };

  if (authLoading || !user || !currentTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Branding Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sidebar-foreground text-base">Nexus Retail Cloud</h2>
            <p className="text-[11px] text-sidebar-muted leading-tight">Vendas e estoque na nuvem</p>
          </div>
        </div>
        {/* Tenant Name */}
        <div className="mt-3 px-2 py-1.5 rounded-lg bg-sidebar-accent/50">
          <p className="text-xs text-sidebar-foreground truncate font-medium">{currentTenant.name}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 h-11 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all",
                  isActive && "bg-sidebar-accent text-sidebar-primary font-medium border-l-2 border-sidebar-primary rounded-l-none"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "text-sidebar-primary")} />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-10 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={handleChangeTenant}
        >
          <Building2 className="w-4 h-4" />
          <span className="text-sm">Trocar Empresa</span>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-10 text-sidebar-muted hover:bg-destructive/20 hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Sair</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-sidebar border-r border-sidebar-border flex-col flex-shrink-0">
        <NavContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-4 gap-4 sticky top-0 z-10">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
              <NavContent />
            </SheetContent>
          </Sheet>

          {title && <h1 className="text-lg font-semibold text-foreground">{title}</h1>}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}