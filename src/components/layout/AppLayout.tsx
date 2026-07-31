import { ReactNode, useEffect, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ShoppingCart, Package, Boxes, Warehouse, CalendarClock, Building2, LogOut, Menu, UtensilsCrossed, Users, Settings, BarChart3, Wallet, DollarSign, RotateCcw, Truck, Tag, UserCog, FileText, ShieldCheck } from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/useSuperAdmin";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AppLayoutSkeleton } from "@/components/ui/skeletons";
import { useCurrentRole } from "@/hooks/usePermission";
import { roleHasPermission, Permission } from "@/lib/permissions";
import brandLogo from "@/assets/mentoark-logo.png.asset.json";

type NavItem = { path: string; label: string; icon: typeof LayoutDashboard; feature: string | null; permission: Permission; group: string };

const NAV_GROUPS = ["Geral", "Operação", "Catálogo & Estoque", "Gestão"] as const;

const ALL_NAV_ITEMS: NavItem[] = [
  { path: "/dashboard", label: "Painel", icon: LayoutDashboard, feature: null, permission: "dashboard", group: "Geral" },
  { path: "/pdv", label: "PDV", icon: ShoppingCart, feature: null, permission: "pdv", group: "Operação" },
  { path: "/returns", label: "Devoluções", icon: RotateCcw, feature: null, permission: "returns", group: "Operação" },
  { path: "/cash-register", label: "Caixa", icon: Wallet, feature: "cash_register", permission: "cash_register", group: "Operação" },
  { path: "/tables", label: "Mesas", icon: UtensilsCrossed, feature: "tables", permission: "tables", group: "Operação" },
  { path: "/products", label: "Produtos", icon: Package, feature: null, permission: "products", group: "Catálogo & Estoque" },
  { path: "/stock", label: "Estoque", icon: Boxes, feature: null, permission: "stock", group: "Catálogo & Estoque" },
  { path: "/warehouses", label: "Depósitos", icon: Warehouse, feature: null, permission: "stock", group: "Catálogo & Estoque" },
  { path: "/validades", label: "Validades", icon: CalendarClock, feature: null, permission: "stock", group: "Catálogo & Estoque" },
  { path: "/compras", label: "Compras", icon: Truck, feature: null, permission: "compras", group: "Catálogo & Estoque" },
  { path: "/promotions", label: "Promoções", icon: Tag, feature: null, permission: "promotions", group: "Catálogo & Estoque" },
  { path: "/customers", label: "Clientes", icon: Users, feature: null, permission: "customers", group: "Gestão" },
  { path: "/reports", label: "Relatórios", icon: BarChart3, feature: null, permission: "reports", group: "Gestão" },
  { path: "/financial", label: "Financeiro", icon: DollarSign, feature: null, permission: "financial", group: "Gestão" },
  { path: "/team", label: "Equipe", icon: UserCog, feature: null, permission: "team", group: "Gestão" },
  { path: "/fiscal", label: "Fiscal", icon: FileText, feature: null, permission: "fiscal", group: "Gestão" },
  { path: "/settings", label: "Configurações", icon: Settings, feature: null, permission: "settings", group: "Gestão" },
];

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { currentTenant, setCurrentTenant, isLoading: tenantLoading } = useTenant();
  const { hasFeature, isOnboardingCompleted } = useCompany();

  const { role } = useCurrentRole();
  const { data: isSuperAdmin } = useIsSuperAdmin();

  const NAV_ITEMS = useMemo(() => {
    const base = !isOnboardingCompleted
      ? ALL_NAV_ITEMS
      : ALL_NAV_ITEMS.filter((item) => item.feature === null || hasFeature(item.feature));
    // Filter by role permissions (only if role is loaded; otherwise show base to avoid flash)
    if (!role) return base;
    return base.filter((item) => roleHasPermission(role, item.permission));
  }, [isOnboardingCompleted, hasFeature, role]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !tenantLoading && user && !currentTenant) {
      navigate("/select-tenant");
    }
  }, [user, currentTenant, authLoading, tenantLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleChangeTenant = () => {
    setCurrentTenant(null);
    navigate("/select-tenant");
  };

  if (authLoading || tenantLoading || !user || !currentTenant) {
    return <AppLayoutSkeleton />;
  }

  const NavContent = () => (
    <div className="flex flex-col h-full relative">
      {/* Reflexo sutil no topo do sidebar (apenas dark) */}
      <div className="hidden dark:block pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Branding Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center shrink-0">
            <img src={brandLogo.url} alt="MentoArk" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base leading-tight">
              <span className="gradient-brand-text">Mento</span>
              <span className="text-sidebar-foreground">Ark</span>
            </h2>
            <p className="text-[11px] text-sidebar-muted leading-tight">Vendas e estoque na nuvem</p>
          </div>
        </div>
        {/* Tenant Name */}
        <div className="mt-3 px-2 py-1.5 rounded-lg gradient-brand-subtle border border-sidebar-border">
          <p className="text-xs text-sidebar-foreground truncate font-medium">{currentTenant.name}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-3 space-y-3 overflow-auto">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="space-y-1">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">
                {group}
              </p>
              {items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} className="block">
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-2.5 h-9 rounded-lg transition-all duration-200 relative",
                        isActive
                          ? "gradient-brand text-white font-medium glow-primary hover:opacity-95 hover:text-white"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5",
                      )}
                    >
                      <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-white" : "text-sidebar-muted")} />
                      <span className="text-sm truncate">{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>


      {/* Footer Actions */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {isSuperAdmin && (
          <Link to="/super-admin">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 h-9 text-primary hover:bg-primary/10"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="text-sm">Super Admin</span>
            </Button>
          </Link>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-2.5 h-9 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={handleChangeTenant}
        >
          <Building2 className="w-4 h-4" />
          <span className="text-sm">Trocar Empresa</span>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2.5 h-9 text-sidebar-muted hover:bg-destructive/20 hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Sair</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Orbs de luz ambiente — decorativos (mais sutis no light) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-primary/5 dark:bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[520px] h-[520px] rounded-full bg-accent/5 dark:bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-[420px] h-[420px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-56 xl:w-60 sidebar-gradient border-r border-sidebar-border flex-col flex-shrink-0 relative z-10">
        <NavContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header */}
        <header className="h-12 border-b border-border/60 bg-card/60 backdrop-blur-md flex items-center px-4 gap-4 sticky top-0 z-20 relative">
          {/* Linha degradê na base do header */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-60 sidebar-gradient border-sidebar-border">
              <NavContent />
            </SheetContent>
          </Sheet>

          {title && <h1 className="text-lg font-semibold text-foreground">{title}</h1>}

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-3 lg:p-5">{children}</main>
      </div>
    </div>
  );
}