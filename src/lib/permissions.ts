// RBAC: mapeamento de roles existentes (admin/operator/manager/cashier/financial/stock/waiter)
// para módulos do sistema. Mantemos enum em inglês e exibimos labels em PT-BR.

export type AppRole = "admin" | "operator" | "manager" | "cashier" | "financial" | "stock" | "waiter";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  operator: "Operador",
  cashier: "Operador de PDV",
  financial: "Financeiro",
  stock: "Estoquista",
  waiter: "Garçom",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Acesso total ao sistema",
  manager: "Acesso a tudo exceto configurações da empresa",
  operator: "Acesso geral de operação",
  cashier: "Acessa apenas PDV, Caixa e Devoluções",
  financial: "Financeiro, Relatórios e Painel",
  stock: "Produtos, Compras, Estoque e Painel",
  waiter: "Salão, comandas e cardápio no celular",
};

export type Permission =
  | "dashboard"
  | "pdv"
  | "returns"
  | "cash_register"
  | "tables"
  | "waiter"
  | "kitchen"
  | "orders"
  | "menu"
  | "products"
  | "stock"
  | "compras"
  | "customers"
  | "promotions"
  | "reports"
  | "financial"
  | "team"
  | "fiscal"
  | "settings";

// Quais roles têm acesso a cada módulo
const PERMISSION_MAP: Record<Permission, AppRole[]> = {
  dashboard:    ["admin", "manager", "operator", "cashier", "financial", "stock"],
  pdv:          ["admin", "manager", "operator", "cashier"],
  returns:      ["admin", "manager", "operator", "cashier"],
  cash_register:["admin", "manager", "operator", "cashier"],
  tables:       ["admin", "manager", "operator", "cashier", "waiter"],
  waiter:       ["admin", "manager", "operator", "cashier", "waiter"],
  kitchen:      ["admin", "manager", "operator", "stock", "waiter"],
  orders:       ["admin", "manager", "operator", "cashier", "waiter"],
  menu:         ["admin", "manager", "operator"],
  products:     ["admin", "manager", "operator", "stock"],
  stock:        ["admin", "manager", "operator", "stock"],
  compras:      ["admin", "manager", "stock"],
  customers:    ["admin", "manager", "operator", "cashier", "financial"],
  promotions:   ["admin", "manager"],
  reports:      ["admin", "manager", "financial"],
  financial:    ["admin", "manager", "financial"],
  team:         ["admin", "manager"],
  fiscal:       ["admin", "manager"],
  settings:     ["admin"],
};

export function roleHasPermission(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSION_MAP[permission]?.includes(role) ?? false;
}

export const ALL_ROLES: AppRole[] = ["admin", "manager", "operator", "cashier", "financial", "stock", "waiter"];

export const DEPARTMENTS = [
  "Vendas",
  "Administrativo",
  "Estoque",
  "Financeiro",
  "Operacional",
  "Cozinha",
  "Salão",
  "TI",
  "Outros",
];

export const CONTRACT_TYPES = ["CLT", "PJ", "Autônomo", "Estagiário"];
