-- Validação de valores da venda no servidor.
--
-- Antes, checkout_sale_transaction gravava preço, desconto e totais exatamente
-- como chegavam do navegador. Agora o banco:
--   1) confere se o produto é da empresa e se o preço bate com o cadastro
--      (preço de venda ou preço de atacado);
--   2) recalcula total de cada item = round(qtd × preço, 2) − desconto;
--   3) recalcula bruto, desconto e líquido da venda;
--   4) exige que a soma de (amount − change_amount) dos pagamentos seja igual ao
--      líquido. Padrão já usado pela comanda: amount = valor entregue, change = troco.
--
-- A função de checkout NÃO é reescrita: só é injetada uma chamada à validação
-- logo após a checagem de permissão, preservando os ajustes feitos por
-- migrations anteriores (estoque negativo, data local etc.).

CREATE OR REPLACE FUNCTION public.normalize_checkout_payload(p_payload jsonb, p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_pay jsonb;
  v_items jsonb := '[]'::jsonb;
  v_qty numeric;
  v_price numeric;
  v_disc numeric;
  v_line_gross numeric;
  v_gross numeric := 0;
  v_disc_total numeric := 0;
  v_extra_disc numeric;
  v_net numeric;
  v_paid numeric := 0;
  v_change numeric;
  v_prod record;
BEGIN
  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'Venda sem itens';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    v_qty   := COALESCE((v_item->>'quantity')::numeric, 0);
    v_price := round(COALESCE((v_item->>'unit_price')::numeric, -1), 2);
    v_disc  := round(COALESCE((v_item->>'discount')::numeric, 0), 2);

    IF v_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    IF v_price < 0 THEN RAISE EXCEPTION 'Preço inválido'; END IF;

    SELECT name, sale_price, wholesale_price INTO v_prod
      FROM public.products
     WHERE id = (v_item->>'product_id')::uuid AND tenant_id = p_tenant;

    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado nesta empresa'; END IF;

    IF v_price <> round(v_prod.sale_price, 2)
       AND (v_prod.wholesale_price IS NULL OR v_price <> round(v_prod.wholesale_price, 2)) THEN
      RAISE EXCEPTION 'O preço de "%" mudou. Remova e adicione o item novamente.', v_prod.name;
    END IF;

    v_line_gross := round(v_qty * v_price, 2);
    IF v_disc < 0 OR v_disc > v_line_gross THEN
      RAISE EXCEPTION 'Desconto inválido no item "%"', v_prod.name;
    END IF;

    v_gross := v_gross + v_line_gross;
    v_disc_total := v_disc_total + v_disc;

    v_items := v_items || jsonb_build_array(
      v_item || jsonb_build_object(
        'unit_price', v_price,
        'discount', v_disc,
        'total', v_line_gross - v_disc
      )
    );
  END LOOP;

  -- desconto geral da venda (além dos descontos por item), se houver
  v_extra_disc := round(
    COALESCE((p_payload->>'discount_total')::numeric, v_disc_total) - v_disc_total, 2);
  IF v_extra_disc < 0 THEN v_extra_disc := 0; END IF;
  v_disc_total := v_disc_total + v_extra_disc;

  v_net := v_gross - v_disc_total;
  IF v_net < 0 THEN RAISE EXCEPTION 'Total líquido não pode ser negativo'; END IF;

  FOR v_pay IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'payments', '[]'::jsonb)) LOOP
    v_change := round(COALESCE((v_pay->>'change_amount')::numeric, 0), 2);
    IF round(COALESCE((v_pay->>'amount')::numeric, 0), 2) <= 0 OR v_change < 0
       OR v_change >= round((v_pay->>'amount')::numeric, 2) THEN
      RAISE EXCEPTION 'Pagamento com valor inválido';
    END IF;
    v_paid := v_paid + round((v_pay->>'amount')::numeric, 2) - v_change;
  END LOOP;

  IF v_paid <> v_net THEN
    RAISE EXCEPTION 'Soma dos pagamentos (%) diferente do total da venda (%)', v_paid, v_net;
  END IF;

  RETURN p_payload || jsonb_build_object(
    'items', v_items,
    'gross_total', v_gross,
    'discount_total', v_disc_total,
    'net_total', v_net
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.normalize_checkout_payload(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_checkout_payload(jsonb, uuid) TO authenticated, service_role;

-- Injeta a validação no checkout existente, logo após a checagem de permissão
DO $$
DECLARE
  v_src text;
  v_anchor text := 'IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION ''Sem permissão''; END IF;';
  v_inject text := 'p_payload := public.normalize_checkout_payload(p_payload, v_tenant);';
BEGIN
  v_src := pg_get_functiondef('public.checkout_sale_transaction(jsonb)'::regprocedure);

  IF position(v_inject IN v_src) > 0 THEN
    RETURN; -- já aplicado
  END IF;

  IF position(v_anchor IN v_src) = 0 THEN
    RAISE EXCEPTION 'checkout_sale_transaction: ponto de injeção não encontrado; revise a migration';
  END IF;

  v_src := replace(v_src, v_anchor, v_anchor || E'\n  ' || v_inject);
  EXECUTE v_src;
END $$;
