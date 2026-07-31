GRANT EXECUTE ON FUNCTION public.increment_stock(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_stock(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_loyalty_points(uuid, uuid, uuid, numeric) TO authenticated;