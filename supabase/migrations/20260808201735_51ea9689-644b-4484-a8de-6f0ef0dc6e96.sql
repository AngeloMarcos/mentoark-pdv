CREATE OR REPLACE FUNCTION public.calculate_expected_balance(p_session_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_opening NUMERIC(12,2);
  v_movements NUMERIC(12,2);
BEGIN
  SELECT opening_balance INTO v_opening
  FROM public.cash_sessions
  WHERE id = p_session_id;

  SELECT COALESCE(SUM(
    CASE
      WHEN movement_type IN ('sale', 'supply') THEN amount
      WHEN movement_type = 'withdrawal' THEN -amount
      ELSE 0
    END
  ), 0) INTO v_movements
  FROM public.cash_movements
  WHERE session_id = p_session_id;

  RETURN COALESCE(v_opening, 0) + v_movements;
END;
$$;

DELETE FROM public.cash_movements
WHERE movement_type = 'closing' AND description = 'diag';