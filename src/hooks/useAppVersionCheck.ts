import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Detecta quando existe uma versão mais nova do app publicada e o
 * navegador ainda está com o bundle antigo em cache — causa clássica de
 * "já corrigi mas o cliente continua vendo o bug antigo" em SPA. Não
 * recarrega sozinho (evita interromper uma venda em andamento no PDV):
 * só avisa, com botão pra atualizar quando for seguro.
 */
let alreadyNotified = false;

async function checkVersion() {
  if (alreadyNotified) return;

  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;

    const data = await res.json();
    if (data?.buildId && data.buildId !== __APP_BUILD_ID__) {
      alreadyNotified = true;
      toast.info("Nova versão disponível", {
        description: "Correções e melhorias foram publicadas. Atualize quando for conveniente.",
        duration: Infinity,
        action: {
          label: "Atualizar agora",
          onClick: () => window.location.reload(),
        },
      });
    }
  } catch {
    // silencioso: falha de rede não deve incomodar o usuário
  }
}

export function useAppVersionCheck() {
  useEffect(() => {
    checkVersion();

    const interval = window.setInterval(checkVersion, 10 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);
}
