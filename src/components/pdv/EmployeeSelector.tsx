import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UserCheck, X, Plus, Loader2 } from "lucide-react";
import { useEmployees, useCreateEmployee } from "@/hooks/useEmployees";

interface EmployeeSelectorProps {
  employee: string | null;
  onSelect: (name: string | null) => void;
}

export function EmployeeSelector({ employee, onSelect }: EmployeeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: employees = [], isLoading } = useEmployees();
  const createEmployee = useCreateEmployee();

  const handleSelectEmployee = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (emp) {
      onSelect(emp.name);
      setOpen(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newName.trim()) return;
    const result = await createEmployee.mutateAsync({ name: newName.trim() });
    onSelect(result.name);
    setNewName("");
    setShowAddForm(false);
    setOpen(false);
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
          <button onClick={() => onSelect(null)} className="ml-auto">
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

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); setShowAddForm(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Funcionário Atendente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : employees.length === 0 && !showAddForm ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Nenhum funcionário cadastrado
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Cadastrar primeiro funcionário
                </Button>
              </div>
            ) : !showAddForm ? (
              <>
                <div className="space-y-1">
                  {employees.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{emp.name}</p>
                        {emp.role && (
                          <p className="text-xs text-muted-foreground">{emp.role}</p>
                        )}
                      </div>
                      {employee === emp.name && (
                        <Badge variant="default" className="text-xs">Atual</Badge>
                      )}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Novo funcionário
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome do funcionário</Label>
                  <Input
                    placeholder="Ex: João Silva"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddEmployee()}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setShowAddForm(false)}
                  >
                    Voltar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleAddEmployee}
                    disabled={!newName.trim() || createEmployee.isPending}
                  >
                    {createEmployee.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Cadastrar"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
