-- Checkout do PDV validado no banco.
--
-- Antes, checkout_sale_transaction gravava preço, desconto e totais como
-- vinham do navegador. Qualquer usuário da empresa podia chamar a RPC direto
-- e registrar uma venda pelo preço que quisesse. Agora o banco:
--   1. usa o preço do cadastro (sale_price, ou wholesale_price a partir de
--      wholesale_min_qty) e recusa item com preço diferente;
--   2. só aceita desconto vindo de uma promoção vigente da empresa, recalculado
--      aqui com a mesma regra de calcPromotionDiscount (src/hooks/usePromotions.ts);
--   3. recalcula bruto, desconto e líquido e recusa se o total que o operador
--      viu na tela for diferente;
--   4. exige que o pago (valor recebido - troco) feche com o líquido;
--   5. exige caixa aberto da própria empresa;
--   6. aceita client_request_id: repetir a mesma chave devolve a venda já
--      gravada, em vez de duplicar (rede caiu depois de gravar, reenvio).
--
-- Convenção de pagamento (a mesma das comandas e da NFC-e):
--   amount = valor entregue pelo cliente nessa forma; change_amount = troco.
--   O que entra no caixa/financeiro é amount - change_amount.

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS sales_tenant_client_request_uidx
  ON public.sales (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.checkout_sale_transaction(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := NULLIF(p_payload->>'tenant_id','')::uuid;
  v_user uuid := auth.uid();
  v_session uuid := NULLIF(p_payload->>'session_id','')::uuid;
  v_customer uuid := NULLIF(p_payload->>'customer_id','')::uuid;
  v_request uuid := NULLIF(p_payload->>'client_request_id','')::uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_pay jsonb;
  v_code text;
  v_amount numeric;
  v_change numeric;
  v_is_credit boolean;
  v_settings jsonb;
  v_due_days integer;
  v_category uuid;
  v_customer_name text;
  v_product uuid;
  v_prod record;
  v_promo record;
  v_promo_id uuid;
  v_qty numeric;
  v_price numeric;
  v_line_gross numeric;
  v_line_discount numeric;
  v_items jsonb := '[]'::jsonb;
  v_gross numeric := 0;
  v_discount numeric := 0;
  v_net numeric;
  v_paid numeric := 0;
  -- O navegador soma sem arredondar (ex.: 0,375 kg x 39,90); o banco arredonda
  -- cada linha a centavos. Meio centavo por item cobre essa diferença.
  v_tol numeric := 0.01 + 0.005 * jsonb_array_length(COALESCE(p_payload->'items','[]'::jsonb));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Empresa não informada'; END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  -- Reenvio da mesma venda: devolve a que já existe.
  IF v_request IS NOT NULL THEN
    SELECT id INTO v_sale_id FROM public.sales
      WHERE tenant_id = v_tenant AND client_request_id = v_request;
    IF v_sale_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'duplicate', true);
    END IF;
  END IF;

  -- Caixa: obrigatório, aberto e da mesma empresa.
  IF v_session IS NULL THEN RAISE EXCEPTION 'Abra o caixa antes de realizar vendas'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.cash_sessions
    WHERE id = v_session AND tenant_id = v_tenant AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'O caixa informado não está aberto nesta empresa';
  END IF;

  IF v_customer IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers WHERE id = v_customer AND tenant_id = v_tenant
  ) THEN
    RAISE EXCEPTION 'Cliente não pertence a esta empresa';
  END IF;

  IF jsonb_array_length(COALESCE(p_payload->'items','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Venda deve ter pelo menos um item';
  END IF;

  -- 1ª passada: preço e desconto calculados pelo banco.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    v_product := NULLIF(v_item->>'product_id','')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0);

    IF v_product IS NULL THEN RAISE EXCEPTION 'Item da venda sem produto'; END IF;
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida no item da venda'; END IF;

    SELECT id, name, category, sale_price, wholesale_price, wholesale_min_qty, active, deleted_at
      INTO v_prod
      FROM public.products WHERE id = v_product AND tenant_id = v_tenant;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não pertence a esta empresa'; END IF;
    IF v_prod.deleted_at IS NOT NULL OR v_prod.active IS FALSE THEN
      RAISE EXCEPTION 'O produto "%" está inativo', v_prod.name;
    END IF;

    v_price := ROUND((v_item->>'unit_price')::numeric, 2);
    IF v_price IS DISTINCT FROM ROUND(v_prod.sale_price, 2)
       AND NOT (v_prod.wholesale_price IS NOT NULL
                AND v_qty >= COALESCE(v_prod.wholesale_min_qty, 0)
                AND v_price = ROUND(v_prod.wholesale_price, 2)) THEN
      RAISE EXCEPTION 'O preço de "%" mudou. Revise o carrinho.', v_prod.name;
    END IF;

    v_line_gross := ROUND(v_qty * v_price, 2);
    v_line_discount := 0;
    v_promo_id := NULLIF(v_item->>'promotion_id','')::uuid;

    IF v_promo_id IS NOT NULL THEN
      -- Mesma regra de get_applicable_promotions.
      SELECT p.discount_type, p.discount_value INTO v_promo
        FROM public.promotions p
        WHERE p.id = v_promo_id
          AND p.tenant_id = v_tenant
          AND p.active = TRUE
          AND (p.starts_at IS NULL OR p.starts_at <= now())
          AND (p.ends_at   IS NULL OR p.ends_at   >= now())
          AND (
            p.scope = 'all'
            OR (p.scope = 'category' AND p.category IS NOT NULL AND v_prod.category = p.category)
            OR (p.scope = 'products' AND v_product = ANY(p.product_ids))
          );
      IF NOT FOUND THEN
        RAISE EXCEPTION 'A promoção aplicada em "%" não vale mais. Revise o carrinho.', v_prod.name;
      END IF;

      IF v_promo.discount_type = 'percentage' THEN
        v_line_discount := ROUND(v_price * v_qty * v_promo.discount_value / 100, 2);
      ELSE
        v_line_discount := ROUND(v_promo.discount_value * v_qty, 2);
      END IF;
      v_line_discount := LEAST(GREATEST(v_line_discount, 0), v_line_gross);
    END IF;

    IF ABS(COALESCE((v_item->>'discount')::numeric, 0) - v_line_discount) > 0.01 THEN
      RAISE EXCEPTION 'O desconto de "%" não confere. Revise o carrinho.', v_prod.name;
    END IF;

    v_items := v_items || jsonb_build_object(
      'product_id', v_product, 'quantity', v_qty, 'unit_price', v_price,
      'discount', v_line_discount, 'total', v_line_gross - v_line_discount
    );
    v_gross := v_gross + v_line_gross;
    v_discount := v_discount + v_line_discount;
  END LOOP;

  v_net := v_gross - v_discount;

  -- O total que o operador viu precisa ser o mesmo que o banco calculou.
  IF ABS(COALESCE((p_payload->>'net_total')::numeric, -1) - v_net) > v_tol THEN
    RAISE EXCEPTION 'O total da venda não confere (banco: R$ %). Revise o carrinho.',
      replace(to_char(v_net, 'FM999999990.00'), '.', ',');
  END IF;

  -- Pagamentos: valores válidos e soma fechando com o líquido.
  IF jsonb_array_length(COALESCE(p_payload->'payments','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Selecione uma forma de pagamento';
  END IF;
  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payload->'payments') LOOP
    v_amount := COALESCE((v_pay->>'amount')::numeric, 0);
    v_change := COALESCE((v_pay->>'change_amount')::numeric, 0);
    IF v_amount <= 0 OR v_change < 0 OR v_change >= v_amount THEN
      RAISE EXCEPTION 'Valor de pagamento inválido';
    END IF;
    IF NULLIF(v_pay->>'payment_method_code','') IS NULL THEN
      RAISE EXCEPTION 'Forma de pagamento não informada';
    END IF;
    v_paid := v_paid + v_amount - v_change;
  END LOOP;

  IF v_paid < v_net - v_tol THEN
    RAISE EXCEPTION 'Valor dos pagamentos insuficiente';
  END IF;
  IF v_paid > v_net + v_tol THEN
    RAISE EXCEPTION 'Pagamentos somam mais que o total da venda; informe o excedente como troco';
  END IF;

  SELECT settings INTO v_settings FROM public.tenants WHERE id = v_tenant;
  v_due_days := COALESCE((v_settings->>'fiado_due_days')::int, 30);

  BEGIN
    INSERT INTO public.sales (
      tenant_id, datetime, user_id, customer_id, gross_total, discount_total,
      net_total, payment_method, notes, session_id, client_request_id
    ) VALUES (
      v_tenant, now(), v_user, v_customer, v_gross, v_discount, v_net,
      COALESCE(p_payload->'payments'->0->>'payment_method_code', 'dinheiro'),
      NULLIF(p_payload->>'notes',''),
      v_session, v_request
    ) RETURNING id INTO v_sale_id;
  EXCEPTION WHEN unique_violation THEN
    -- Dois envios simultâneos da mesma venda: o outro gravou primeiro.
    IF v_request IS NULL THEN RAISE; END IF;
    SELECT id INTO v_sale_id FROM public.sales
      WHERE tenant_id = v_tenant AND client_request_id = v_request;
    RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'duplicate', true);
  END;

  -- 2ª passada: grava itens já validados e baixa estoque.
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_product := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, discount, total)
    VALUES (
      v_sale_id, v_product, v_qty, (v_item->>'unit_price')::numeric,
      (v_item->>'discount')::numeric, (v_item->>'total')::numeric
    );

    UPDATE public.products
      SET stock_current = COALESCE(stock_current,0) - v_qty,
          updated_at = now()
      WHERE id = v_product AND tenant_id = v_tenant;

    INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, sale_id, description)
    VALUES (v_tenant, v_product, 'sale', -1 * v_qty, v_sale_id, 'Venda no PDV');

    PERFORM public.consume_lots_fefo(v_tenant, v_product, v_qty);
  END LOOP;

  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payload->'payments') LOOP
    v_code := v_pay->>'payment_method_code';
    v_change := COALESCE((v_pay->>'change_amount')::numeric,0);
    v_amount := (v_pay->>'amount')::numeric - v_change;

    SELECT EXISTS (
      SELECT 1 FROM public.payment_methods pm
      WHERE pm.tenant_id = v_tenant AND pm.code = v_code AND pm.type = 'credit'
    ) OR v_code = 'fiado' INTO v_is_credit;

    INSERT INTO public.sale_payments (
      sale_id, payment_method_id, payment_method_code, amount, change_amount, installments, authorization_code
    ) VALUES (
      v_sale_id, NULLIF(v_pay->>'payment_method_id','')::uuid,
      v_code, (v_pay->>'amount')::numeric, v_change,
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
      INSERT INTO public.cash_movements (
        tenant_id, session_id, user_id, movement_type, amount, payment_method, sale_id, description
      ) VALUES (
        v_tenant, v_session, v_user, 'sale', v_amount, v_code, v_sale_id, 'Venda no PDV'
      );

      INSERT INTO public.financial_entries (
        tenant_id, entry_date, type, description, amount, payment_method, sale_id
      ) VALUES (
        v_tenant, (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'income', 'Venda no PDV', v_amount, v_code, v_sale_id
      );
    END IF;
  END LOOP;

  IF v_customer IS NOT NULL THEN
    PERFORM public.credit_loyalty_points(v_tenant, v_customer, v_sale_id, v_net);
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'sale_id', v_sale_id, 'duplicate', false,
    'gross_total', v_gross, 'discount_total', v_discount, 'net_total', v_net
  );
END;
$function$;
