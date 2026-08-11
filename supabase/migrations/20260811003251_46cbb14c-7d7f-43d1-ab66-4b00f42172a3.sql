-- 1) Saldo esperado do caixa: apenas dinheiro
CREATE OR REPLACE FUNCTION public.calculate_expected_balance(p_session_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_opening NUMERIC(12,2);
  v_movements NUMERIC(12,2);
BEGIN
  SELECT opening_balance INTO v_opening
  FROM public.cash_sessions WHERE id = p_session_id;

  SELECT COALESCE(SUM(
    CASE
      WHEN movement_type = 'sale' AND COALESCE(payment_method,'dinheiro') = 'dinheiro' THEN amount
      WHEN movement_type = 'supply' THEN amount
      WHEN movement_type = 'withdrawal' THEN -amount
      ELSE 0
    END
  ), 0) INTO v_movements
  FROM public.cash_movements
  WHERE session_id = p_session_id;

  RETURN ROUND(COALESCE(v_opening, 0) + v_movements, 2);
END;
$function$;

-- 2/3) Ajustes nas RPCs de venda: estoque negativo + data local
DO $$
DECLARE
  v_src text;
BEGIN
  FOREACH v_src IN ARRAY ARRAY[
    pg_get_functiondef('public.checkout_sale_transaction(jsonb)'::regprocedure),
    pg_get_functiondef('public.close_restaurant_tab(jsonb)'::regprocedure)
  ] LOOP
    v_src := replace(v_src, '''sale'', (v_item->>''quantity'')::numeric', '''sale'', -1 * (v_item->>''quantity'')::numeric');
    v_src := replace(v_src, '''sale'', v_rec.quantity', '''sale'', -1 * v_rec.quantity');
    v_src := replace(v_src, 'CURRENT_DATE', '(now() AT TIME ZONE ''America/Sao_Paulo'')::date');
    EXECUTE v_src;
  END LOOP;
END $$;

-- 4) Suprimento/sangria não são receita/despesa
DROP TRIGGER IF EXISTS mirror_cash_movement_to_financial ON public.cash_movements;
DROP TRIGGER IF EXISTS trg_mirror_cash_movement_to_financial ON public.cash_movements;