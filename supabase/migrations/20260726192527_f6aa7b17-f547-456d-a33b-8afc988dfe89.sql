
CREATE OR REPLACE FUNCTION public.get_session_payment_breakdown(p_session_id uuid)
RETURNS TABLE(payment_method text, expected numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.payment_method_code::text AS payment_method,
         COALESCE(SUM(sp.amount), 0)::numeric AS expected
  FROM public.sales s
  JOIN public.sale_payments sp ON sp.sale_id = s.id
  WHERE s.session_id = p_session_id
  GROUP BY sp.payment_method_code
  ORDER BY sp.payment_method_code;
$$;

REVOKE ALL ON FUNCTION public.get_session_payment_breakdown(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_payment_breakdown(uuid) TO authenticated;
