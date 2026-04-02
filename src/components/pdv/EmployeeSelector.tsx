import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserCheck, X } from "lucide-react";

interface EmployeeSelectorProps {
  employee: string | null;
  onSelect: (name: string | null) => void;
}

export function EmployeeSelector({ employee, onSelect }: EmployeeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleConfirm = () => {
    if (name.trim()) {
      onSelect(name.trim());
      setOpen(false);
      setName("");
    }
  };

  return (
    <>
      {employee ? (
        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg text-sm">
          <UserCheck className="w-4 h-4 text-primary" />
          <span>Atendente:</span>
          <Badge variant="secondary" className="font-medium">
            {employee}
          </Badge>
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-primary hover:underline ml-1"
          >
            trocar
          </button>
          <button
            onClick={() => onSelect(null)}
            className="ml-auto"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setOpen(true)}
        >
          <UserCheck className="w-4 h-4" />
          Selecionar Funcionário
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Funcionário Atendente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Nome do funcionário"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              autoFocus
            />
            <Button
              className="w-full"
              onClick={handleConfirm}
              disabled={!name.trim()}
            >
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
