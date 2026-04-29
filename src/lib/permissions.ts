// RBAC: mapeamento de roles existentes (admin/operator/manager/cashier/financial/stock)
// para módulos do sistema. Mantemos enum em inglês e exibimos labels em PT-BR.

export type AppRole = "admin" | "operator" | "manager" | "cashier" | "financial" | "stock";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  operator: "Operador",
  cashier: "Operador de PDV",
  financial: "Financeiro",
  stock: "Estoquista",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Acesso total ao sistema",
  manager: "Acesso a tudo exceto configurações da empresa",
  operator: "Acesso geral de operação",
  cashier: "Acessa apenas PDV, Caixa e Devoluções",
  financial: "Financeiro, Relatórios e Painel",
  stock: "Produtos, Compras, Estoque e Painel",
};

export type Permission =
  | "dashboard"
  | "pdv"
  | "returns"
  | "cash_register"
  | "tables"
  | "products"
  | "stock"
  | "compras"
  | "customers"
  | "promotions"
  | "reports"
  | "financial"
  | "team"
  | "settings";

// Quais roles têm acesso a cada módulo
const PERMISSION_MAP: Record<Permission, AppRole[]> = {
  dashboard:    ["admin", "manager", "operator", "cashier", "financial", "stock"],
  pdv:          ["admin", "manager", "operator", "cashier"],
  returns:      ["admin", "manager", "operator", "cashier"],
  cash_register:["admin", "manager", "operator", "cashier"],
  tables:       ["admin", "manager", "operator", "cashier"],
  products:     ["admin", "manager", "operator", "stock"],
  stock:        ["admin", "manager", "operator", "stock"],
  compras:      ["admin", "manager", "stock"],
  customers:    ["admin", "manager", "operator", "cashier", "financial"],
  promotions:   ["admin", "manager"],
  reports:      ["admin", "manager", "financial"],
  financial:    ["admin", "manager", "financial"],
  team:         ["admin", "manager"],
  settings:     ["admin"],
};

export function roleHasPermission(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSION_MAP[permission]?.includes(role) ?? false;
}

export const ALL_ROLES: AppRole[] = ["admin", "manager", "operator", "cashier", "financial", "stock"];

export const DEPARTMENTS = [
  "Vendas",
  "Administrativo",
  "Estoque",
  "Financeiro",
  "Operacional",
  "TI",
  "Outros",
];

export const CONTRACT_TYPES = ["CLT", "PJ", "Autônomo", "Estagiário"];
