-- Integridade e desempenho do schema (auditoria de 2026-11-17).
--
-- Só ADICIONA estrutura; não renomeia nem apaga nada, e não altera dados.
-- Feita para rodar com segurança também em produção (Supabase Cloud):
--   * chaves estrangeiras e CHECKs entram como NOT VALID (valem para linhas
--     novas na hora) e só são validados contra os dados antigos se estes
--     estiverem limpos; se houver linha antiga fora da regra, a constraint
--     continua NOT VALID e um NOTICE avisa, em vez de a migration falhar;
--   * índices com IF NOT EXISTS.

-- Auxiliar: valida uma constraint se os dados permitirem.
CREATE OR REPLACE FUNCTION pg_temp.try_validate(_table regclass, _constraint text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', _table, _constraint);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Constraint % em % ficou NOT VALID (dados antigos fora da regra): %', _constraint, _table, SQLERRM;
END $$;

-- Auxiliar: cria constraint só se ainda não existir.
CREATE OR REPLACE FUNCTION pg_temp.add_constraint(_table regclass, _constraint text, _definition text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = _table AND conname = _constraint) THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s NOT VALID', _table, _constraint, _definition);
  END IF;
  PERFORM pg_temp.try_validate(_table, _constraint);
END $$;

-- 1. tenant_id sem chave estrangeira para tenants ---------------------------
-- Todas as outras 37 tabelas usam ON DELETE CASCADE; estas passam a seguir o
-- mesmo padrão (empresa apagada não deixa linhas órfãs).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts','financial_categories','fiscal_documents','product_images','product_kits',
    'product_variants','stock_by_warehouse','stock_reservations','stock_transfers','warehouses'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      PERFORM pg_temp.add_constraint(('public.' || t)::regclass, t || '_tenant_id_fkey',
        'FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE');
    END IF;
  END LOOP;
END $$;

-- 2. Outras referências sem chave estrangeira -------------------------------
SELECT pg_temp.add_constraint('public.accounts', 'accounts_customer_id_fkey',
  'FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL');
-- Documento fiscal sobrevive à venda (registro legal); só perde o vínculo.
SELECT pg_temp.add_constraint('public.fiscal_documents', 'fiscal_documents_sale_id_fkey',
  'FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL');

-- 3. Valores que nunca podem ser negativos ----------------------------------
SELECT pg_temp.add_constraint('public.products', 'products_sale_price_nonneg', 'CHECK (sale_price >= 0)');
SELECT pg_temp.add_constraint('public.products', 'products_cost_price_nonneg', 'CHECK (cost_price IS NULL OR cost_price >= 0)');
SELECT pg_temp.add_constraint('public.sale_items', 'sale_items_quantity_positive', 'CHECK (quantity > 0)');
SELECT pg_temp.add_constraint('public.sale_items', 'sale_items_values_nonneg',
  'CHECK (unit_price >= 0 AND total >= 0 AND COALESCE(discount, 0) >= 0)');
SELECT pg_temp.add_constraint('public.sales', 'sales_totals_nonneg',
  'CHECK (gross_total >= 0 AND net_total >= 0 AND COALESCE(discount_total, 0) >= 0)');
SELECT pg_temp.add_constraint('public.sale_payments', 'sale_payments_values_nonneg',
  'CHECK (amount >= 0 AND COALESCE(change_amount, 0) >= 0)');

-- 4. Índices em chaves estrangeiras -----------------------------------------
-- Sem eles, joins, filtros e o ON DELETE CASCADE varrem a tabela inteira.
-- tenant_users(user_id) é consultado pela RLS (user_belongs_to_tenant) em
-- praticamente toda requisição.
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON public.tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_user ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_method ON public.sale_payments(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_sale ON public.stock_movements(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_created ON public.stock_movements(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cash_movements_sale ON public.cash_movements(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_entries_sale ON public.financial_entries(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_points_sale ON public.customer_points(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_category ON public.accounts(category_id);
CREATE INDEX IF NOT EXISTS idx_accounts_customer ON public.accounts(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_lots_product ON public.product_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_kits_child ON public.product_kits(child_product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON public.purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_count_items_product ON public.inventory_count_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_product ON public.sale_return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_session ON public.sale_returns(session_id);
CREATE INDEX IF NOT EXISTS idx_stock_by_warehouse_product ON public.stock_by_warehouse(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product ON public.stock_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_warehouse ON public.stock_reservations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_product ON public.stock_transfers(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from ON public.stock_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to ON public.stock_transfers(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_menu_item ON public.sale_items(menu_item_id) WHERE menu_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tab_items_product ON public.tab_items(product_id);
CREATE INDEX IF NOT EXISTS idx_tabs_merged_into ON public.tabs(merged_into_tab_id) WHERE merged_into_tab_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_sale ON public.orders(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_table ON public.orders(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON public.order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_station ON public.order_items(station_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON public.order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_item_options_item ON public.order_item_options(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_options_tenant ON public.order_item_options(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menus_tenant ON public.menus(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_sections_menu ON public.menu_sections(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_sections_tenant ON public.menu_sections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant ON public.menu_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_station ON public.menu_items(station_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_options_item ON public.menu_item_options(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_options_tenant ON public.menu_item_options(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_option_values_option ON public.menu_item_option_values(option_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_option_values_tenant ON public.menu_item_option_values(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_recipe_product ON public.menu_item_recipe(product_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_recipe_tenant ON public.menu_item_recipe(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_info_tenant ON public.delivery_info(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant ON public.warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_categories_tenant ON public.financial_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_images_tenant ON public.product_images(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_kits_tenant ON public.product_kits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_by_warehouse_tenant ON public.stock_by_warehouse(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_tenant ON public.stock_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant ON public.stock_transfers(tenant_id);

-- 5. Venda: item precisa ser de produto da mesma empresa ---------------------
-- sale_items não tem tenant_id; antes, o checkout aceitava qualquer
-- product_id vindo do navegador (inclusive de outra empresa). Mesma função,
-- com duas checagens a mais no laço de itens.
CREATE OR REPLACE FUNCTION public.checkout_sale_transaction(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := (p_payload->>'tenant_id')::uuid;
  v_user uuid := auth.uid();
  v_session uuid := NULLIF(p_payload->>'session_id','')::uuid;
  v_customer uuid := NULLIF(p_payload->>'customer_id','')::uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_pay jsonb;
  v_code text;
  v_amount numeric;
  v_is_credit boolean;
  v_settings jsonb;
  v_due_days integer;
  v_category uuid;
  v_customer_name text;
  v_product uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Empresa não informada'; END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  IF v_customer IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers WHERE id = v_customer AND tenant_id = v_tenant
  ) THEN
    RAISE EXCEPTION 'Cliente não pertence a esta empresa';
  END IF;

  SELECT settings INTO v_settings FROM public.tenants WHERE id = v_tenant;
  v_due_days := COALESCE((v_settings->>'fiado_due_days')::int, 30);

  INSERT INTO public.sales (
    tenant_id, datetime, user_id, customer_id, gross_total, discount_total,
    net_total, payment_method, notes, session_id
  ) VALUES (
    v_tenant, now(), v_user, v_customer,
    COALESCE((p_payload->>'gross_total')::numeric,0),
    COALESCE((p_payload->>'discount_total')::numeric,0),
    COALESCE((p_payload->>'net_total')::numeric,0),
    COALESCE(p_payload->>'payment_method','dinheiro'),
    NULLIF(p_payload->>'notes',''),
    v_session
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items','[]'::jsonb)) LOOP
    v_product := NULLIF(v_item->>'product_id','')::uuid;

    IF COALESCE((v_item->>'quantity')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida no item da venda';
    END IF;
    IF v_product IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.products WHERE id = v_product AND tenant_id = v_tenant
    ) THEN
      RAISE EXCEPTION 'Produto não pertence a esta empresa';
    END IF;

    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, discount, total)
    VALUES (
      v_sale_id, v_product,
      (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'discount')::numeric,0), (v_item->>'total')::numeric
    );

    UPDATE public.products
      SET stock_current = COALESCE(stock_current,0) - (v_item->>'quantity')::numeric,
          updated_at = now()
      WHERE id = v_product AND tenant_id = v_tenant;

    INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, sale_id, description)
    VALUES (v_tenant, v_product, 'sale', -1 * (v_item->>'quantity')::numeric, v_sale_id, 'Venda no PDV');

    PERFORM public.consume_lots_fefo(v_tenant, v_product, (v_item->>'quantity')::numeric);
  END LOOP;

  FOR v_pay IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'payments','[]'::jsonb)) LOOP
    v_code := v_pay->>'payment_method_code';
    v_amount := (v_pay->>'amount')::numeric - COALESCE((v_pay->>'change_amount')::numeric,0);

    SELECT EXISTS (
      SELECT 1 FROM public.payment_methods pm
      WHERE pm.tenant_id = v_tenant AND pm.code = v_code AND pm.type = 'credit'
    ) OR v_code = 'fiado' INTO v_is_credit;

    INSERT INTO public.sale_payments (
      sale_id, payment_method_id, payment_method_code, amount, change_amount, installments, authorization_code
    ) VALUES (
      v_sale_id, NULLIF(v_pay->>'payment_method_id','')::uuid,
      v_code, (v_pay->>'amount')::numeric,
      COALESCE((v_pay->>'change_amount')::numeric,0),
      COALESCE((v_pay->>'installments')::int,1),
      NULLIF(v_pay->>'authorization_code','')
    );

    IF v_is_credit THEN
      IF v_customer IS NULL THEN
        RAISE EXCEPTION 'Venda no fiado exige um cliente vinculado';
      END IF;

      SELECT name INTO v_customer_name FROM public.customers WHERE id = v_customer AND tenant_id = v_tenant;

      SELECT id INTO v_category FROM public.financial_categories
        WHERE tenant_id = v_tenant AND type = 'receita' AND name = 'Vendas a Prazo' LIMIT 1;

      IF v_category IS NULL THEN
        INSERT INTO public.financial_categories (tenant_id, name, type, color)
        VALUES (v_tenant, 'Vendas a Prazo', 'receita', '#22c55e')
        RETURNING id INTO v_category;
      END IF;

      INSERT INTO public.accounts (
        tenant_id, type, description, amount, due_date, status,
        category_id, party_name, customer_id, notes, created_by
      ) VALUES (
        v_tenant, 'receber',
        'Venda a prazo - ' || COALESCE(v_customer_name, 'Cliente'),
        v_amount, (now() AT TIME ZONE 'America/Sao_Paulo')::date + v_due_days, 'aberta',
        v_category, v_customer_name, v_customer,
        'Gerado automaticamente pela venda no PDV (fiado). Venda: ' || v_sale_id::text,
        v_user
      );
    ELSE
      IF v_session IS NOT NULL THEN
        INSERT INTO public.cash_movements (
          tenant_id, session_id, user_id, movement_type, amount, payment_method, sale_id, description
        ) VALUES (
          v_tenant, v_session, v_user, 'sale', v_amount, v_code, v_sale_id, 'Venda no PDV'
        );
      END IF;

      INSERT INTO public.financial_entries (
        tenant_id, entry_date, type, description, amount, payment_method, sale_id
      ) VALUES (
        v_tenant, (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'income', 'Venda no PDV', v_amount, v_code, v_sale_id
      );
    END IF;
  END LOOP;

  IF v_customer IS NOT NULL THEN
    PERFORM public.credit_loyalty_points(v_tenant, v_customer, v_sale_id,
      COALESCE((p_payload->>'net_total')::numeric,0));
  END IF;

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id);
END;
$function$;
