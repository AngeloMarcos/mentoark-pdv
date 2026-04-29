import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Trash2, ShieldAlert } from "lucide-react";
import {
  useExportMyData,
  useMyDeletionRequest,
  useRequestAccountDeletion,
} from "@/hooks/useLGPD";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function PrivacyTab() {
  const exportData = useExportMyData();
  const { data: deletion } = useMyDeletionRequest();
  const requestDeletion = useRequestAccountDeletion();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");

  const handleConfirm = async () => {
    await requestDeletion.mutateAsync(reason);
    setConfirmOpen(false);
    setReason("");
  };

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" /> Exportar meus dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Baixe um arquivo JSON com todos os seus dados pessoais armazenados na plataforma
            (LGPD Art. 18).
          </p>
          <Button onClick={() => exportData.mutate()} disabled={exportData.isPending}>
            <Download className="w-4 h-4 mr-2" />
            {exportData.isPending ? "Gerando..." : "Baixar meus dados (JSON)"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" /> Excluir minha conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deletion ? (
            <Alert>
              <ShieldAlert className="w-4 h-4" />
              <AlertDescription>
                Sua solicitação de exclusão está com status:{" "}
                <strong>{deletion.status}</strong>.{" "}
                Solicitada em{" "}
                {new Date(deletion.requested_at).toLocaleDateString("pt-BR")}.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Esta ação solicita a exclusão definitiva da sua conta e dos seus dados pessoais.
                A equipe processará em até 15 dias.
              </p>
              <Button
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={requestDeletion.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Solicitar exclusão
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar solicitação de exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita após processada. Conte-nos brevemente o motivo
              (opcional).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo da exclusão (opcional)"
            maxLength={500}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={handleConfirm}
            >
              Confirmar solicitação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
