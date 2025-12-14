import { ReactNode, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Warehouse,
  Wallet,
  Building2,
  LogOut,
  Menu,
  UtensilsCrossed,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/tables", label: "Mesas", icon: UtensilsCrossed },
  { path: "/pdv", label: "PDV", icon: ShoppingCart },
  { path: "/products", label: "Produtos", icon: Package },
  { path: "/sales-report", label: "Relatórios", icon: BarChart3 },
  { path: "/stock", label: "Estoque", icon: Warehouse },
  { path: "/financial", label: "Financeiro", icon: Wallet },
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
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sidebar-foreground truncate">PDV Universal</h2>
            <p className="text-xs text-sidebar-muted truncate">{currentTenant.name}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleChangeTenant}
        >
          <Building2 className="w-5 h-5" />
          Trocar Empresa
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleSignOut}
        >
          <LogOut className="w-5 h-5" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-sidebar border-r border-sidebar-border flex-col">
        <NavContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center px-4 gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar">
              <NavContent />
            </SheetContent>
          </Sheet>

          {title && <h1 className="text-xl font-semibold text-foreground">{title}</h1>}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
