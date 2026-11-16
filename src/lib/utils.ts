import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Instância única: criar Intl.NumberFormat a cada chamada é caro em listas longas.
const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number): string {
  return brlFormatter.format(value || 0);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
