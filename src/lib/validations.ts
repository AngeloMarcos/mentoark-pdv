import { z } from "zod";

// Product validation schema
export const ProductInputSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  internal_code: z.string().max(50, "Código muito longo").nullable().optional(),
  barcode: z.string().max(50, "Código de barras muito longo").nullable().optional(),
  category: z.string().max(100, "Categoria muito longa").nullable().optional(),
  sale_price: z.number().positive("Preço deve ser positivo").max(999999.99, "Preço muito alto"),
  cost_price: z.number().nonnegative("Custo não pode ser negativo").max(999999.99, "Custo muito alto").nullable().optional(),
  stock_current: z.number().nonnegative("Estoque não pode ser negativo").max(999999.999, "Estoque muito alto").optional(),
  unit: z.string().max(10, "Unidade muito longa").optional(),
  min_stock: z.number().nonnegative("Estoque mínimo não pode ser negativo").max(999999.999, "Estoque mínimo muito alto").nullable().optional(),
  active: z.boolean().optional(),
});

// Sale item validation schema
export const SaleItemSchema = z.object({
  product_id: z.string().uuid("ID do produto inválido"),
  quantity: z.number().positive("Quantidade deve ser positiva").max(99999, "Quantidade muito alta"),
  unit_price: z.number().positive("Preço unitário deve ser positivo").max(999999.99, "Preço muito alto"),
  discount: z.number().nonnegative("Desconto não pode ser negativo").max(999999.99, "Desconto muito alto"),
  total: z.number().min(0, "Total não pode ser negativo").max(9999999.99, "Total muito alto"),
  product_name: z.string().optional(),
});

// Sale payment validation schema
export const SalePaymentSchema = z.object({
  payment_method_id: z.string().uuid("ID da forma de pagamento inválido").optional(),
  payment_method_code: z.string().min(1, "Código da forma de pagamento é obrigatório").max(50, "Código muito longo"),
  amount: z.number().positive("Valor deve ser positivo").max(9999999.99, "Valor muito alto"),
  change_amount: z.number().nonnegative("Troco não pode ser negativo").max(999999.99, "Troco muito alto").optional(),
  installments: z.number().int().positive("Parcelas devem ser positivas").max(48, "Máximo 48 parcelas").optional(),
  authorization_code: z.string().max(50, "Código de autorização muito longo").optional(),
});

// Create sale input validation schema
export const CreateSaleInputSchema = z.object({
  items: z.array(SaleItemSchema).min(1, "Venda deve ter pelo menos um item"),
  customer_id: z.string().uuid("ID do cliente inválido").nullable().optional(),
  payment_method: z.string().max(50, "Forma de pagamento muito longa").optional(),
  payments: z.array(SalePaymentSchema).optional(),
  discount_total: z.number().nonnegative("Desconto não pode ser negativo").max(999999.99, "Desconto muito alto").optional(),
  notes: z.string().max(1000, "Observações muito longas").optional(),
  session_id: z.string().uuid("ID da sessão inválido").nullable().optional(),
});

// Tab item validation schema
export const AddTabItemInputSchema = z.object({
  tab_id: z.string().uuid("ID da comanda inválido"),
  product_id: z.string().uuid("ID do produto inválido"),
  quantity: z.number().positive("Quantidade deve ser positiva").max(99999, "Quantidade muito alta"),
  unit_price: z.number().positive("Preço unitário deve ser positivo").max(999999.99, "Preço muito alto"),
  discount: z.number().nonnegative("Desconto não pode ser negativo").max(999999.99, "Desconto muito alto").optional(),
  notes: z.string().max(500, "Observações muito longas").optional(),
});

// Create tab input validation schema
export const CreateTabInputSchema = z.object({
  table_id: z.string().uuid("ID da mesa inválido").optional(),
  customer_name: z.string().max(200, "Nome muito longo").optional(),
  notes: z.string().max(1000, "Observações muito longas").optional(),
});

// Stock movement validation schema
export const CreateStockMovementInputSchema = z.object({
  product_id: z.string().uuid("ID do produto inválido"),
  movement_type: z.enum(["purchase", "adjustment_plus", "adjustment_minus"], {
    errorMap: () => ({ message: "Tipo de movimentação inválido" }),
  }),
  quantity: z.number().positive("Quantidade deve ser positiva").max(999999.999, "Quantidade muito alta"),
  description: z.string().max(500, "Descrição muito longa").optional(),
});

// Financial entry validation schema
export const CreateFinancialEntryInputSchema = z.object({
  entry_date: z.string().min(1, "Data é obrigatória"),
  type: z.enum(["income", "expense"], {
    errorMap: () => ({ message: "Tipo deve ser 'income' ou 'expense'" }),
  }),
  description: z.string().min(1, "Descrição é obrigatória").max(500, "Descrição muito longa"),
  amount: z.number().positive("Valor deve ser positivo").max(9999999.99, "Valor muito alto"),
  payment_method: z.string().max(50, "Forma de pagamento muito longa").nullable().optional(),
});

// Table validation schema
export const TableInputSchema = z.object({
  number: z.string().min(1, "Número é obrigatório").max(20, "Número muito longo"),
  name: z.string().max(100, "Nome muito longo").nullable().optional(),
  capacity: z.number().int().positive("Capacidade deve ser positiva").max(999, "Capacidade muito alta").nullable().optional(),
});

// Validation helper function
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(firstError?.message || "Dados inválidos");
  }
  return result.data;
}
