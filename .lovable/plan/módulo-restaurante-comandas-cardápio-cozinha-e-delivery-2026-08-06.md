# Módulo Restaurante — Comandas, Cardápio, Cozinha e Delivery

Novo setor do sistema voltado a restaurantes, bares e lanchonetes, reaproveitando e evoluindo o que já existe (Mesas, Comandas, Produtos, Estoque, PDV, Caixa, Financeiro).

## O que já existe e será aproveitado
- Mesas (`tables`) e Comandas (`tabs` / `tab_items`) com abertura, itens e fechamento.
- Produtos, estoque atômico, caixa, pagamentos múltiplos, impressão térmica, RBAC por papel.

## O que será construído

### 1. Cardápio digital (separado dos produtos)
Estrutura própria de cardápio, ligada ao estoque por ficha técnica:
- Cardápios (ex.: Almoço, Noite, Delivery) com horário de disponibilidade.
- Seções (Entradas, Pratos, Bebidas, Sobremesas) com ordem de exibição.
- Itens do cardápio: nome, descrição, foto, preço, tempo de preparo, destino de produção (cozinha/bar), disponível/esgotado.
- Complementos e opções por item (ex.: ponto da carne, adicionais pagos, remover ingrediente), com grupos obrigatórios/opcionais e limite de escolhas.
- Tela `/cardapio` para o gestor montar tudo, com arrastar para ordenar e botão rápido "esgotado hoje".

### 2. Ficha técnica (baixa de insumos)
- Cada item do cardápio recebe uma receita: quais produtos de estoque e em que quantidade.
- Ao confirmar o pedido, o estoque dos insumos é baixado automaticamente e de forma atômica; cancelamento devolve.
- Cálculo de custo do prato e margem real na tela do cardápio.

### 3. Comandas melhoradas (salão)
- Juntar comandas, transferir comanda/itens entre mesas, dividir conta (por pessoa ou igualmente).
- Taxa de serviço 10% configurável, couvert, número de pessoas na mesa.
- Mapa de mesas com status visual (livre, ocupada, conta pedida, reservada) e tempo de permanência.
- Fechamento gerando venda no caixa com pagamentos múltiplos já existentes.

### 4. App do garçom (mobile dedicado)
- Rota `/garcom`, layout de toque em tela cheia, otimizado para celular.
- Fluxo: escolher mesa → navegar no cardápio por seções → escolher complementos → observações ("sem cebola") → enviar para cozinha.
- Consulta rápida de disponibilidade e preço; ver comanda da mesa e chamar a conta.
- Acesso restrito ao papel de garçom (novo papel no RBAC), que vê apenas salão e cardápio.

### 5. Cozinha em tempo real (KDS estilo iFood)
- Tela `/cozinha` com colunas: Novos → Em preparo → Prontos → Entregues.
- Cartões de pedido com mesa/comanda, itens, complementos, observações, cronômetro e alerta de atraso.
- Atualização em tempo real (sem recarregar), som ao chegar pedido novo.
- Separação por destino de produção: filtro Cozinha / Bar / Chapa.
- Impressão automática opcional do pedido na impressora térmica ao enviar.

### 6. Delivery e balcão
- Tela `/pedidos` no estilo iFood: lista de pedidos com status (Recebido, Em preparo, Pronto, Saiu para entrega, Concluído, Cancelado).
- Tipos de pedido: mesa, balcão/retirada, delivery.
- Delivery: cliente, telefone, endereço, taxa de entrega, entregador, tempo estimado.
- Reaproveita a base de clientes e gera venda + lançamento financeiro no fechamento.

### 7. Configurações do segmento
- Nova aba em Configurações: taxa de serviço, couvert, tipos de destino de produção, impressão automática na cozinha, tempo-alvo de preparo, ativar/desativar delivery.
- Ativação dos módulos pelas feature flags já existentes por empresa.

## Detalhes técnicos

Novas tabelas (todas com `tenant_id`, RLS por empresa, GRANTs e trigger `assert_tenant_access`):
`menus`, `menu_sections`, `menu_items`, `menu_item_options`, `menu_item_option_values`, `menu_item_recipe` (ficha técnica), `orders`, `order_items`, `order_item_options`, `delivery_info`, `production_stations`.

Alterações em tabelas existentes: `tabs` ganha `people_count`, `service_fee`, `merged_into_tab_id`; `tables` ganha status expandido e reservas; novo papel `waiter` no enum de papéis e no mapa de permissões.

- Realtime habilitado em `orders` e `order_items` para o KDS e o app do garçom, com assinatura dentro de `useEffect` e limpeza no unmount.
- Baixa de insumos e mudança de status via funções no banco (`security definer`) para garantir atomicidade, seguindo o padrão de `checkout_sale_transaction`.
- Fechamento de comanda/pedido reutiliza o fluxo de venda e caixa atual.
- Novos hooks: `useMenus`, `useMenuItems`, `useRecipes`, `useOrders`, `useKitchenOrders`, `useDelivery`.
- Novas rotas: `/cardapio`, `/garcom`, `/cozinha`, `/pedidos`, protegidas por permissão e feature flag.

## Entrega em etapas

1. Banco: cardápio, ficha técnica, pedidos, delivery, papel garçom, realtime.
2. Gestão do cardápio (`/cardapio`) com seções, itens, complementos e ficha técnica.
3. App do garçom (`/garcom`) e comandas melhoradas (juntar, transferir, dividir, taxa de serviço).
4. Cozinha (`/cozinha`) em tempo real, com impressão opcional.
5. Delivery/balcão (`/pedidos`) e configurações do segmento.
