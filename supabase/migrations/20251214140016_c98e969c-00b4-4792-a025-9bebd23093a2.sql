-- Create atomic stock decrement function to prevent race conditions
CREATE OR REPLACE FUNCTION public.decrement_stock(
  p_product_id UUID,
  p_quantity NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE public.products 
  SET stock_current = COALESCE(stock_current, 0) - p_quantity,
      updated_at = now()
  WHERE id = p_product_id
  AND tenant_id IN (SELECT get_user_tenants());
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or insufficient permissions';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Create atomic stock increment function for purchases/adjustments
CREATE OR REPLACE FUNCTION public.increment_stock(
  p_product_id UUID,
  p_quantity NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE public.products 
  SET stock_current = COALESCE(stock_current, 0) + p_quantity,
      updated_at = now()
  WHERE id = p_product_id
  AND tenant_id IN (SELECT get_user_tenants());
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or insufficient permissions';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;