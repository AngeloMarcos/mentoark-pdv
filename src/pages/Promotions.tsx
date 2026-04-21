import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Tag, Trash2, Calendar, Percent, DollarSign } from "lucide-react";
import { usePromotions, useTogglePromotion, useDeletePromotion, Promotion } from "@/hooks/usePromotions";
import { NewPromotionDialog } from "@/components/promotions/NewPromotionDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const scopeLabel: Record<string, string> = {
  all: "Todos os produtos",
  category: "Por categoria",
  products: "Produtos específicos",
};

export default function Promotions() {
  const [showNew, setShowNew] = useState(false);
  const [toDelete, setToDelete] = useState<Promotion | null>(null);
  const { data: promotions = [], isLoading } = usePromotions();
  const toggle = useTogglePromotion();
  const remove = useDeletePromotion();

  return (
    <AppLayout title="Promoções">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold gradient-brand-text inline-block">Promoções</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Crie descontos para aplicar manualmente nos itens do PDV.
            </p>
          </div>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova promoção
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : promotions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Tag className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-lg">Nenhuma promoção cadastrada</p>
              <p className="text-sm">Crie a primeira para começar a aplicar descontos no PDV.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.map((p) => {
              const expired = p.ends_at && new Date(p.ends_at) < new Date();
              return (
                <Card key={p.id} className={!p.active ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Tag className="w-4 h-4 text-primary" /> {p.name}
                      </CardTitle>
                      <Switch
                        checked={p.active}
                        onCheckedChange={(v) => toggle.mutate({ id: p.id, active: v })}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {p.description && <p className="text-muted-foreground">{p.description}</p>}

                    <div className="flex items-center gap-2">
                      {p.discount_type === "percentage" ? (
                        <Badge className="gap-1"><Percent className="w-3 h-3" />{p.discount_value}% OFF</Badge>
                      ) : (
                        <Badge className="gap-1"><DollarSign className="w-3 h-3" />R$ {Number(p.discount_value).toFixed(2)} OFF</Badge>
                      )}
                      <Badge variant="outline">{scopeLabel[p.scope]}</Badge>
                    </div>

                    {p.scope === "category" && p.category && (
                      <p className="text-xs text-muted-foreground">Categoria: <strong>{p.category}</strong></p>
                    )}
                    {p.scope === "products" && p.product_ids && (
                      <p className="text-xs text-muted-foreground">{p.product_ids.length} produtos</p>
                    )}

                    <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t">
                      <Calendar className="w-3 h-3" />
                      <span>{fmtDate(p.starts_at)} → {fmtDate(p.ends_at)}</span>
                    </div>

                    {expired && <Badge variant="destructive" className="text-xs">Expirada</Badge>}

                    <div className="pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setToDelete(p)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <NewPromotionDialog open={showNew} onOpenChange={setShowNew} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir promoção?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.name}" será removida. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (toDelete) {
                  await remove.mutateAsync(toDelete.id);
                  setToDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
