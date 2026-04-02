import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, CheckCircle2 } from "lucide-react";

interface BusinessData {
  name: string;
  document: string;
  phone: string;
  address: string;
}

interface StepBusinessInfoProps {
  data: BusinessData;
  onChange: (data: BusinessData) => void;
}

function formatCNPJ(value: string) {
  const nums = value.replace(/\D/g, "").slice(0, 14);
  return nums
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatPhone(value: string) {
  const nums = value.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 10) {
    return nums
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return nums
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function StepBusinessInfo({ data, onChange }: StepBusinessInfoProps) {
  const isNameValid = data.name.trim().length >= 2;

  return (
    <div className="max-w-lg mx-auto space-y-6 py-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Dados do negócio
          </h2>
          <p className="text-sm text-muted-foreground">
            Informações básicas do seu estabelecimento
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company-name">
            Nome do estabelecimento <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="company-name"
              placeholder="Ex: Borracharia do João"
              value={data.name}
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              className={isNameValid ? "border-primary/50 pr-10" : ""}
            />
            {isNameValid && (
              <CheckCircle2 className="w-4 h-4 text-primary absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ (opcional)</Label>
          <Input
            id="cnpj"
            placeholder="00.000.000/0000-00"
            value={data.document}
            onChange={(e) =>
              onChange({ ...data, document: formatCNPJ(e.target.value) })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone (opcional)</Label>
          <Input
            id="phone"
            placeholder="(00) 00000-0000"
            value={data.phone}
            onChange={(e) =>
              onChange({ ...data, phone: formatPhone(e.target.value) })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Endereço completo (opcional)</Label>
          <Input
            id="address"
            placeholder="Rua, número, bairro, cidade - UF"
            value={data.address}
            onChange={(e) => onChange({ ...data, address: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
