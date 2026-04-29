import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Global barcode scanner hook.
 *
 * Detecta padrão típico de leitor: vários keystrokes em <50ms terminados em Enter.
 * Ignora digitação humana normal e quando o usuário está em input/textarea/select.
 *
 * Uso:
 *   const { pause, resume, paused } = useBarcodeScanner((code) => { ... });
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  options: {
    minLength?: number;
    maxInterKeyMs?: number;
    /** se true, ignora quando foco está em input/textarea/[contenteditable] */
    ignoreInputs?: boolean;
  } = {}
) {
  const { minLength = 4, maxInterKeyMs = 50, ignoreInputs = true } = options;

  const bufferRef = useRef("");
  const lastTimeRef = useRef(0);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (ignoreInputs) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (t && (t as HTMLElement).isContentEditable)
        ) {
          return;
        }
      }

      const now = performance.now();
      const delta = now - lastTimeRef.current;

      if (e.key === "Enter") {
        if (bufferRef.current.length >= minLength && delta < maxInterKeyMs * 4) {
          e.preventDefault();
          const code = bufferRef.current;
          bufferRef.current = "";
          lastTimeRef.current = 0;
          onScanRef.current(code);
        } else {
          bufferRef.current = "";
          lastTimeRef.current = 0;
        }
        return;
      }

      // Only printable single-char keys (digits/letters)
      if (e.key.length !== 1) return;
      if (!/[\w-]/.test(e.key)) return;

      // If too slow between keys, reset buffer (human typing)
      if (lastTimeRef.current > 0 && delta > maxInterKeyMs) {
        bufferRef.current = "";
      }
      bufferRef.current += e.key;
      lastTimeRef.current = now;
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [minLength, maxInterKeyMs, ignoreInputs]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
  }, []);

  return { pause, resume, paused };
}
