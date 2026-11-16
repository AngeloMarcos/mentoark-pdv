import { lazy, type ComponentType } from "react";
import { Loader2 } from "lucide-react";

const RELOAD_KEY = "pdv:chunk-reload";

/**
 * React.lazy para páginas. Se o chunk não existir mais (publicaram uma versão
 * nova e o navegador ainda está com o index antigo), recarrega a página uma
 * única vez para buscar o build atual, em vez de mostrar tela em branco.
 */
// eslint-disable-next-line react-refresh/only-export-components, @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* storage indisponível */
      }
      return mod;
    } catch (err) {
      let alreadyReloaded = true;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === "1";
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {
        /* storage indisponível: não arrisca loop de reload */
      }
      if (!alreadyReloaded) {
        window.location.reload();
        // Mantém o Suspense até o reload acontecer.
        return new Promise<{ default: T }>(() => undefined);
      }
      throw err;
    }
  });
}

export function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
