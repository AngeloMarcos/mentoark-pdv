import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Package, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useExpiringProducts,
  useUpdateLotStatus,
  getExpiryStatusColor,
} from "@/hooks/useLots";

export function ExpiryAlerts() {
  const [daysFilter, setDaysFilter] = useState<number>(30);
  const { data: expiringProducts = [], isLoading } = useExpiringProducts(daysFilter);
  const updateStatus = useUpdateLotStatus();

  const expiredCount = expiringProducts.filter((p) => p.status === "expired").length;
  const expiringCount = expiringProducts.filter((p) => p.status === "expiring").length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Produtos Vencendo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Produtos Vencendo
          </h3>
          <div className="flex gap-2">
            {expiredCount > 0 && (
              <Badge variant="destructive">{expiredCount} vencido(s)</Badge>
            )}
            {expiringCount > 0 && (
              <Badge variant="secondary">{expiringCount} a vencer</Badge>
            )}
          </div>
        </div>
        <Select
          value={daysFilter.toString()}
          onValueChange={(value) => setDaysFilter(parseInt(value))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Próximos 7 dias</SelectItem>
            <SelectItem value="15">Próximos 15 dias</SelectItem>
            <SelectItem value="30">Próximos 30 dias</SelectItem>
            <SelectItem value="60">Próximos 60 dias</SelectItem>
            <SelectItem value="90">Próximos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {expiringProducts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum produto vencendo nos próximos {daysFilter} dias.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {expiringProducts.map((product) => (
            <Card
              key={product.lot_id}
              className={
                product.status === "expired"
                  ? "border-destructive"
                  : product.days_until_expiry <= 15
                  ? "border-yellow-500"
                  : ""
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="truncate">{product.product_name}</span>
                  <Badge
                    variant={product.status === "expired" ? "destructive" : "secondary"}
                  >
                    {product.status === "expired" ? "Vencido" : "A vencer"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lote:</span>
                  <span className="font-medium">{product.lot_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantidade:</span>
                  <span className="font-medium">{product.quantity}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Validade:</span>
                  <span className={`font-medium ${getExpiryStatusColor(product.days_until_expiry)}`}>
                    {format(parseISO(product.expiry_date), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dias restantes:</span>
                  <span className={`font-medium ${getExpiryStatusColor(product.days_until_expiry)}`}>
                    {product.days_until_expiry < 0
                      ? `${Math.abs(product.days_until_expiry)} dias atrás`
                      : product.days_until_expiry === 0
                      ? "Hoje"
                      : `${product.days_until_expiry} dias`}
                  </span>
                </div>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      updateStatus.mutate({
                        id: product.lot_id,
                        status: "blocked",
                      })
                    }
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Bloquear Lote
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
