import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { Product } from "@/hooks/useProducts";
import { formatBRL } from "@/lib/utils";

/** Altura fixa da linha: 64px (alvo de toque ≥ 48dp com folga). */
const ROW_HEIGHT = 64;
/** Linhas extras renderizadas acima/abaixo da área visível. */
const OVERSCAN = 4;

interface RowProps {
  product: Product;
  index: number;
  total: number;
  onSelect: (product: Product) => void;
}

const ProductRow = memo(function ProductRow({ product, index, total, onSelect }: RowProps) {
  return (
    <div
      role="listitem"
      aria-setsize={total}
      aria-posinset={index + 1}
      className="absolute left-0 right-0 px-2"
      style={{ height: ROW_HEIGHT, transform: `translateY(${index * ROW_HEIGHT}px)` }}
    >
      <button
        type="button"
        className="w-full h-[60px] flex items-center gap-3 px-3 rounded-lg hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors text-left"
        onClick={() => onSelect(product)}
        aria-label={`Adicionar ${product.name}, ${formatBRL(product.sale_price)}`}
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{product.name}</div>
          <div className="text-sm text-muted-foreground truncate">
            {product.internal_code || product.barcode || ""}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold">{formatBRL(product.sale_price)}</div>
          <div className="text-xs text-muted-foreground">Est: {product.stock_current}</div>
        </div>
        <Plus className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
});

interface Props {
  products: Product[];
  onSelect: (product: Product) => void;
  className?: string;
}

/**
 * Lista de produtos com virtual scrolling: só as linhas visíveis (mais uma
 * pequena margem) existem no DOM, então 10 ou 50.000 produtos custam o mesmo.
 */
export const ProductVirtualList = memo(function ProductVirtualList({ products, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(480);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewport(el.clientHeight || 480);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setViewport(el.clientHeight || 480));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Nova busca: volta ao topo.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = 0;
    setScrollTop(0);
  }, [products]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // No máximo uma atualização de estado por frame durante a rolagem.
  const handleScroll = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (containerRef.current) setScrollTop(containerRef.current.scrollTop);
    });
  }, []);

  const total = products.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(total, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN);

  const rows = [];
  for (let i = start; i < end; i++) {
    const product = products[i];
    rows.push(<ProductRow key={product.id} product={product} index={i} total={total} onSelect={onSelect} />);
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={className}
      style={{ overflowY: "auto", contain: "layout paint" }}
      role="list"
      aria-label={`Produtos (${total})`}
    >
      <div className="relative w-full my-2" style={{ height: total * ROW_HEIGHT }}>
        {rows}
      </div>
    </div>
  );
});
