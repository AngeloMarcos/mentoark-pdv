export interface FeatureConfig {
  key: string;
  label: string;
  description?: string;
  default: boolean;
  category: string;
}

export interface SegmentOption {
  value: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
}

export const SEGMENT_OPTIONS: SegmentOption[] = [
  { value: "borracharia", icon: "Wrench", label: "Borracharia", description: "Serviços automotivos, O.S." },
  { value: "casa_racao", icon: "PawPrint", label: "Casa de Ração / Pet", description: "Produtos para pets, ração a granel" },
  { value: "adega", icon: "Wine", label: "Adega / Distribuidora", description: "Bebidas, atacado e varejo" },
  { value: "bar_restaurante", icon: "UtensilsCrossed", label: "Bar / Restaurante", description: "Mesas, comandas, delivery" },
  { value: "mercado", icon: "ShoppingCart", label: "Mercado / Minimercado", description: "PDV rápido, código de barras" },
  { value: "farmacia", icon: "Pill", label: "Farmácia / Drogaria", description: "Prescrições, controlados" },
  { value: "loja_roupas", icon: "Shirt", label: "Loja de Roupas", description: "Grade de tamanhos, cores" },
  { value: "outro", icon: "Store", label: "Outro", description: "Configuração personalizada" },
];

export const SEGMENT_FEATURES: Record<string, FeatureConfig[]> = {
  borracharia: [
    { key: "employee_selection", label: "Seleção de Funcionário na Venda", description: "Perguntar qual funcionário está atendendo antes de cada venda", default: true, category: "Vendas" },
    { key: "service_orders", label: "Ordem de Serviço (O.S.)", description: "Criar e gerenciar ordens de serviço para clientes", default: true, category: "Operações" },
    { key: "vehicle_plate", label: "Placa do Veículo", description: "Associar venda/O.S. à placa do veículo do cliente", default: true, category: "Operações" },
    { key: "barcode_reader", label: "Leitor de Código de Barras", description: "Usar leitor para buscar produtos rapidamente", default: true, category: "PDV" },
    { key: "cash_register", label: "Controle de Caixa", description: "Abertura, fechamento e sangria de caixa", default: true, category: "Financeiro" },
    { key: "loyalty_points", label: "Programa de Fidelidade", description: "Pontos por compra para clientes frequentes", default: false, category: "Marketing" },
  ],
  casa_racao: [
    { key: "weight_control", label: "Controle por Peso (kg)", description: "Vender produtos a granel por quilograma", default: true, category: "Estoque" },
    { key: "barcode_reader", label: "Leitor de Código de Barras", default: true, category: "PDV" },
    { key: "cash_register", label: "Controle de Caixa", default: true, category: "Financeiro" },
    { key: "employee_selection", label: "Seleção de Funcionário", default: false, category: "Vendas" },
    { key: "loyalty_points", label: "Programa de Fidelidade", default: true, category: "Marketing" },
    { key: "delivery", label: "Entrega / Delivery", default: false, category: "Operações" },
  ],
  adega: [
    { key: "barcode_reader", label: "Leitor de Código de Barras", default: true, category: "PDV" },
    { key: "cash_register", label: "Controle de Caixa", default: true, category: "Financeiro" },
    { key: "employee_selection", label: "Seleção de Funcionário", default: false, category: "Vendas" },
    { key: "delivery", label: "Entrega / Delivery", default: true, category: "Operações" },
    { key: "loyalty_points", label: "Programa de Fidelidade", default: true, category: "Marketing" },
    { key: "wholesale_pricing", label: "Tabela de Preço Atacado/Varejo", description: "Preços diferentes por quantidade", default: true, category: "Vendas" },
  ],
  bar_restaurante: [
    { key: "tables", label: "Controle de Mesas", description: "Mapa visual de mesas e comandas por mesa", default: true, category: "Operações" },
    { key: "kitchen_display", label: "Exibição para Cozinha (KDS)", description: "Tela de pedidos para a cozinha", default: true, category: "Operações" },
    { key: "delivery", label: "Delivery", default: false, category: "Operações" },
    { key: "employee_selection", label: "Seleção de Garçom", description: "Associar atendimento ao garçom responsável", default: true, category: "Vendas" },
    { key: "cash_register", label: "Controle de Caixa", default: true, category: "Financeiro" },
    { key: "loyalty_points", label: "Programa de Fidelidade", default: false, category: "Marketing" },
  ],
  mercado: [
    { key: "barcode_reader", label: "Leitor de Código de Barras", default: true, category: "PDV" },
    { key: "quick_pdv", label: "PDV Rápido", description: "Interface simplificada para caixa rápido", default: true, category: "PDV" },
    { key: "cash_register", label: "Controle de Caixa", default: true, category: "Financeiro" },
    { key: "employee_selection", label: "Seleção de Operador de Caixa", default: false, category: "Vendas" },
    { key: "loyalty_points", label: "Cartão Fidelidade", default: true, category: "Marketing" },
    { key: "weight_control", label: "Balança Integrada", default: false, category: "PDV" },
  ],
  farmacia: [
    { key: "barcode_reader", label: "Leitor de Código de Barras", default: true, category: "PDV" },
    { key: "prescriptions", label: "Controle de Prescrições", description: "Registro de receitas médicas para medicamentos controlados", default: true, category: "Regulatório" },
    { key: "cash_register", label: "Controle de Caixa", default: true, category: "Financeiro" },
    { key: "employee_selection", label: "Identificação do Farmacêutico", default: true, category: "Vendas" },
    { key: "loyalty_points", label: "Programa Fidelidade", default: false, category: "Marketing" },
  ],
  loja_roupas: [
    { key: "size_grid", label: "Grade de Tamanhos", description: "Estoque por cor e tamanho (PP, P, M, G, GG)", default: true, category: "Estoque" },
    { key: "barcode_reader", label: "Leitor de Etiqueta", default: true, category: "PDV" },
    { key: "cash_register", label: "Controle de Caixa", default: true, category: "Financeiro" },
    { key: "employee_selection", label: "Seleção de Vendedor (comissão)", default: true, category: "Vendas" },
    { key: "loyalty_points", label: "Programa Fidelidade", default: true, category: "Marketing" },
  ],
  outro: [
    { key: "barcode_reader", label: "Leitor de Código de Barras", default: true, category: "PDV" },
    { key: "cash_register", label: "Controle de Caixa", default: true, category: "Financeiro" },
    { key: "employee_selection", label: "Seleção de Funcionário", default: false, category: "Vendas" },
    { key: "tables", label: "Controle de Mesas", default: false, category: "Operações" },
    { key: "service_orders", label: "Ordem de Serviço", default: false, category: "Operações" },
    { key: "weight_control", label: "Controle por Peso", default: false, category: "Estoque" },
    { key: "delivery", label: "Delivery", default: false, category: "Operações" },
    { key: "loyalty_points", label: "Programa de Fidelidade", default: false, category: "Marketing" },
    { key: "prescriptions", label: "Controle de Prescrições", default: false, category: "Regulatório" },
    { key: "size_grid", label: "Grade de Tamanhos", default: false, category: "Estoque" },
    { key: "wholesale_pricing", label: "Preço Atacado/Varejo", default: false, category: "Vendas" },
    { key: "kitchen_display", label: "Exibição para Cozinha", default: false, category: "Operações" },
  ],
};

export function getDefaultFeatures(segment: string): Record<string, boolean> {
  const features = SEGMENT_FEATURES[segment] || SEGMENT_FEATURES["outro"];
  const result: Record<string, boolean> = {};
  features.forEach((f) => {
    result[f.key] = f.default;
  });
  return result;
}
