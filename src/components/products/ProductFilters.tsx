import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, LayoutList, LayoutGrid } from "lucide-react";

export type ProductStatusFilter = "all" | "active" | "inactive";
export type ProductStockFilter = "all" | "low" | "out" | "in_stock";
export type ProductSortBy = "name" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc" | "newest";
export type ProductView = "list" | "table";

export interface ProductFilterState {
  search: string;
  category: string; // "" = all
  status: ProductStatusFilter;
  stock: ProductStockFilter;
  sortBy: ProductSortBy;
  view: ProductView;
}

export const DEFAULT_PRODUCT_FILTERS: ProductFilterState = {
  search: "",
  category: "",
  status: "active",
  stock: "all",
  sortBy: "name",
  view: "list",
};

interface Props {
  filters: ProductFilterState;
  onChange: (next: ProductFilterState) => void;
  categories: string[];
  showing: number;
  total: number;
}

export function ProductFilters({ filters, onChange, categories, showing, total }: Props) {
  const set = <K extends keyof ProductFilterState>(k: K, v: ProductFilterState[K]) =>
    onChange({ ...filters, [k]: v });

  const isFiltered =
    filters.search !== "" ||
    filters.category !== "" ||
    filters.status !== "active" ||
    filters.stock !== "all" ||
    filters.sortBy !== "name";

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código ou código de barras..."
            className="pl-9 h-9"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={filters.category || "__all__"} onValueChange={(v) => set("category", v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas categorias</SelectItem>
              {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={filters.status} onValueChange={(v: ProductStatusFilter) => set("status", v)}>
            <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.stock} onValueChange={(v: ProductStockFilter) => set("stock", v)}>
            <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Estoque: todos</SelectItem>
              <SelectItem value="in_stock">Com estoque</SelectItem>
              <SelectItem value="low">Estoque baixo</SelectItem>
              <SelectItem value="out">Sem estoque</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.sortBy} onValueChange={(v: ProductSortBy) => set("sortBy", v)}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nome (A-Z)</SelectItem>
              <SelectItem value="price_asc">Preço ↑</SelectItem>
              <SelectItem value="price_desc">Preço ↓</SelectItem>
              <SelectItem value="stock_asc">Estoque ↑</SelectItem>
              <SelectItem value="stock_desc">Estoque ↓</SelectItem>
              <SelectItem value="newest">Mais recentes</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border rounded-md overflow-hidden">
            <Button
              type="button"
              variant={filters.view === "list" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => set("view", "list")}
              title="Visualização em lista"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={filters.view === "table" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => set("view", "table")}
              title="Tabela compacta"
            >
              <LayoutList className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Exibindo <strong className="text-foreground">{showing}</strong> de{" "}
          <strong className="text-foreground">{total}</strong> produto(s)
        </span>
        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_PRODUCT_FILTERS)}>
            <X className="w-3 h-3 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
