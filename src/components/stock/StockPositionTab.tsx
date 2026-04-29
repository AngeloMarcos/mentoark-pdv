import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus } from "lucide-react";

export interface StockPositionProduct {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  stock_current: number;
  min_stock: number | null;
  cost_price: number | null;
  sale_price: number;
}

interface Props {
  products: StockPositionProduct[];
  onReplenish?: (product: StockPositionProduct) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function statusOf(p: StockPositionProduct): { label: string; variant: "default" | "destructive" | "secondary" | "outline" } {
  const stock = Number(p.stock_current) || 0;
  if (stock <= 0) return { label: "Sem estoque", variant: "destructive" };
  if (p.min_stock != null && stock < Number(p.min_stock)) return { label: "Baixo", variant: "secondary" };
  return { label: "OK", variant: "outline" };
}

export function StockPositionTab({ products, onReplenish }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (s && !p.name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [products, search, category]);

  const totalValue = filtered.reduce(
    (sum, p) => sum + Number(p.stock_current) * Number(p.cost_price || p.sale_price || 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category || "__all__"} onValueChange={(v) => setCategory(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas categorias</SelectItem>
            {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground">{filtered.length}</strong> produto(s)
        </span>
        <span>
          Valor total: <strong className="text-foreground">{formatCurrency(totalValue)}</strong>
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum produto encontrado</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Mín.</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Valor em estoque</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {onReplenish && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const status = statusOf(p);
                  const value = Number(p.stock_current) * Number(p.cost_price || p.sale_price || 0);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.category || "—"}</TableCell>
                      <TableCell className="text-right">{p.stock_current} {p.unit}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.min_stock ?? "—"}</TableCell>
                      <TableCell className="text-right">{p.cost_price ? formatCurrency(Number(p.cost_price)) : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(value)}</TableCell>
                      <TableCell className="text-center"><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      {onReplenish && (
                        <TableCell className="text-right">
                          {(status.label !== "OK") && (
                            <Button variant="ghost" size="sm" onClick={() => onReplenish(p)}>
                              <Plus className="w-3 h-3 mr-1" /> Repor
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
