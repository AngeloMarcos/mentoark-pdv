// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductVirtualList } from "./ProductVirtualList";
import type { Product } from "@/hooks/useProducts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const makeProducts = (n: number): Product[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    tenant_id: "t",
    name: `Produto ${i}`,
    internal_code: `C${i}`,
    barcode: null,
    category: null,
    sale_price: 10 + i,
    cost_price: null,
    stock_current: i,
    unit: "UN",
    min_stock: null,
    active: true,
    extra_attributes: {},
    created_at: "",
    updated_at: "",
  }));

describe("ProductVirtualList", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    // jsdom não tem requestAnimationFrame síncrono: executa na hora.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("renderiza só as linhas visíveis de uma lista de 20.000 produtos", () => {
    act(() => root.render(<ProductVirtualList products={makeProducts(20000)} onSelect={() => undefined} />));
    const rows = host.querySelectorAll('[role="listitem"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(30);
    expect(host.querySelector('[role="list"]')?.getAttribute("aria-label")).toBe("Produtos (20000)");
    expect(rows[0].getAttribute("aria-setsize")).toBe("20000");
  });

  it("troca as linhas ao rolar e mantém o DOM pequeno", () => {
    act(() => root.render(<ProductVirtualList products={makeProducts(20000)} onSelect={() => undefined} />));
    const list = host.querySelector('[role="list"]') as HTMLDivElement;
    act(() => {
      list.scrollTop = 64 * 10000;
      list.dispatchEvent(new Event("scroll"));
    });
    const rows = host.querySelectorAll('[role="listitem"]');
    expect(rows.length).toBeLessThan(30);
    expect(host.textContent).toContain("Produto 10000");
    expect(host.textContent).not.toContain("Produto 0C0");
  });

  it("clique na linha seleciona o produto", () => {
    const onSelect = vi.fn();
    act(() => root.render(<ProductVirtualList products={makeProducts(5)} onSelect={onSelect} />));
    const button = host.querySelector("button") as HTMLButtonElement;
    expect(button.getAttribute("aria-label")).toContain("Adicionar Produto 0");
    act(() => button.click());
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "p0" }));
  });
});
