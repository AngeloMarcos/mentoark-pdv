DROP POLICY IF EXISTS images_tenant ON public.product_images;
DROP POLICY IF EXISTS kits_tenant ON public.product_kits;
DROP POLICY IF EXISTS variants_tenant ON public.product_variants;
DROP POLICY IF EXISTS sbw_tenant ON public.stock_by_warehouse;
DROP POLICY IF EXISTS reservations_tenant ON public.stock_reservations;
DROP POLICY IF EXISTS transfers_tenant ON public.stock_transfers;
DROP POLICY IF EXISTS warehouses_tenant ON public.warehouses;

CREATE POLICY images_tenant ON public.product_images FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id)) WITH CHECK (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY kits_tenant ON public.product_kits FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id)) WITH CHECK (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY variants_tenant ON public.product_variants FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id)) WITH CHECK (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY sbw_tenant ON public.stock_by_warehouse FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id)) WITH CHECK (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY reservations_tenant ON public.stock_reservations FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id)) WITH CHECK (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY transfers_tenant ON public.stock_transfers FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id)) WITH CHECK (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY warehouses_tenant ON public.warehouses FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id)) WITH CHECK (public.user_belongs_to_tenant(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images, public.product_kits, public.product_variants,
  public.stock_by_warehouse, public.stock_reservations, public.stock_transfers, public.warehouses TO authenticated;
GRANT ALL ON public.product_images, public.product_kits, public.product_variants,
  public.stock_by_warehouse, public.stock_reservations, public.stock_transfers, public.warehouses TO service_role;

CREATE OR REPLACE FUNCTION public.soft_delete_product(_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.products WHERE id = _product_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE public.products SET deleted_at = now(), active = false WHERE id = _product_id;
END $$;

CREATE OR REPLACE FUNCTION public.write_off_expired_lot(_lot_id uuid, _reason text DEFAULT 'Baixa por vencimento')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lot RECORD;
BEGIN
  SELECT * INTO v_lot FROM public.product_lots WHERE id = _lot_id FOR UPDATE;
  IF v_lot.id IS NULL THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  IF NOT public.user_belongs_to_tenant(v_lot.tenant_id) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.product_lots SET quantity = 0, status = 'written_off', notes = COALESCE(_reason, notes)
    WHERE id = _lot_id;

  UPDATE public.products SET stock_current = GREATEST(COALESCE(stock_current,0) - v_lot.quantity, 0), updated_at = now()
    WHERE id = v_lot.product_id;

  INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, description)
  VALUES (v_lot.tenant_id, v_lot.product_id, 'adjustment', -v_lot.quantity, COALESCE(_reason, 'Baixa por vencimento'));
END $$;

CREATE OR REPLACE FUNCTION public.list_expiring_lots(_days integer DEFAULT 30)
RETURNS TABLE(lot_id uuid, product_id uuid, product_name text, lot_number text, quantity numeric, expiry_date date, days_left integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.product_id, p.name, l.lot_number, l.quantity, l.expiry_date, (l.expiry_date - CURRENT_DATE)::integer
  FROM public.product_lots l JOIN public.products p ON p.id = l.product_id
  WHERE l.tenant_id IN (SELECT public.get_user_tenants())
    AND l.status = 'active' AND l.quantity > 0 AND l.expiry_date IS NOT NULL
    AND l.expiry_date <= CURRENT_DATE + _days
  ORDER BY l.expiry_date ASC
$$;

CREATE OR REPLACE FUNCTION public.transfer_stock(_from_warehouse uuid, _to_warehouse uuid, _product_id uuid, _quantity numeric, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_available numeric; v_id uuid;
BEGIN
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser positiva'; END IF;
  IF _from_warehouse = _to_warehouse THEN RAISE EXCEPTION 'Depósitos devem ser diferentes'; END IF;

  SELECT tenant_id INTO v_tenant FROM public.warehouses WHERE id = _from_warehouse;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Depósito de origem não encontrado'; END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = _to_warehouse AND tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Depósito de destino inválido';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id AND tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Produto inválido';
  END IF;

  SELECT quantity - reserved INTO v_available FROM public.stock_by_warehouse
    WHERE warehouse_id = _from_warehouse AND product_id = _product_id AND tenant_id = v_tenant FOR UPDATE;
  IF v_available IS NULL OR v_available < _quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente no depósito de origem';
  END IF;

  UPDATE public.stock_by_warehouse SET quantity = quantity - _quantity, updated_at = now()
    WHERE warehouse_id = _from_warehouse AND product_id = _product_id;

  INSERT INTO public.stock_by_warehouse(tenant_id, warehouse_id, product_id, quantity)
    VALUES (v_tenant, _to_warehouse, _product_id, _quantity)
    ON CONFLICT (warehouse_id, product_id)
    DO UPDATE SET quantity = stock_by_warehouse.quantity + EXCLUDED.quantity, updated_at = now();

  INSERT INTO public.stock_transfers(tenant_id, from_warehouse_id, to_warehouse_id, product_id, quantity, status, notes, created_by, completed_at)
    VALUES (v_tenant, _from_warehouse, _to_warehouse, _product_id, _quantity, 'completed', _notes, auth.uid(), now())
    RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_product(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.write_off_expired_lot(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_expiring_lots(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_off_expired_lot(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_expiring_lots(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) TO authenticated;