import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Truck, MessageCircle, Wallet, Plug } from "lucide-react";

interface Integration {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "Pagamentos" | "Delivery" | "Mensageria";
}

const INTEGRATIONS: Integration[] = [
  {
    key: "stone",
    name: "Stone",
    description: "Maquininha e gateway de pagamento. Conciliação automática de vendas no cartão.",
    icon: CreditCard,
    category: "Pagamentos",
  },
  {
    key: "pagarme",
    name: "Pagar.me",
    description: "Gateway online para PIX, cartão e boleto. Ideal para vendas no link/whatsapp.",
    icon: Wallet,
    category: "Pagamentos",
  },
  {
    key: "ifood",
    name: "iFood",
    description: "Recebe pedidos do iFood direto no PDV e baixa estoque automaticamente.",
    icon: Truck,
    category: "Delivery",
  },
  {
    key: "whatsapp",
    name: "WhatsApp Business",
    description: "Envio de cupom digital, confirmação de pedidos e campanhas para clientes.",
    icon: MessageCircle,
    category: "Mensageria",
  },
];

export function IntegrationsTab() {
  const categories = Array.from(new Set(INTEGRATIONS.map((i) => i.category)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5" /> Integrações
          </CardTitle>
          <CardDescription>
            Conecte serviços externos ao seu PDV. Novas integrações chegando em breve.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {categories.map((cat) => (
            <div key={cat} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {INTEGRATIONS.filter((i) => i.category === cat).map((integration) => {
                  const Icon = integration.icon;
                  return (
                    <div
                      key={integration.key}
                      className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{integration.name}</p>
                          <Badge variant="outline" className="text-xs">Em breve</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {integration.description}
                        </p>
                        <Button variant="ghost" size="sm" disabled className="mt-2 -ml-2">
                          Conectar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
