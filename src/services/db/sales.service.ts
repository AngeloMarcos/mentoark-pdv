import { supabase } from "@/integrations/supabase/client";

export interface SaleItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
}

export interface SalePaymentInput {
  payment_method_id?: string | null;
  payment_method_code: string;
  amount: number;
  change_amount?: number;
  installments?: number;
  authorization_code?: string | null;
}

export interface CheckoutSalePayload {
  tenant_id: string;
  user_id: string;
  customer_id?: string | null;
  session_id?: string | null;
  gross_total: number;
  discount_total: number;
  net_total: number;
  payment_method: string;
  notes?: string | null;
  items: SaleItemInput[];
  payments: SalePaymentInput[];
}

export const salesService = {
  /**
   * Executa a finalização da venda em uma única transação atômica
   * via PostgreSQL RPC, garantindo consistência no banco de dados.
   */
  async checkoutSale(payload: CheckoutSalePayload): Promise<{ sale_id: string }> {
    const { data, error } = await supabase.rpc("checkout_sale_transaction", {
      p_payload: payload as any,
    });

    if (error) {
      console.error("[Sales Service] Falha na Transação Atômica:", error);
      throw error;
    }

    // A RPC retorna JSON: { success: true, sale_id: '...' }
    return { sale_id: (data as any)?.sale_id };
  },
};
