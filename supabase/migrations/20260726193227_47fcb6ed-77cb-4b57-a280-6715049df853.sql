
CREATE OR REPLACE FUNCTION public.consume_lots_fefo(
  _tenant_id uuid, _product_id uuid, _quantity numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  remaining numeric := _quantity;
  lot_row RECORD;
  consumed jsonb := '[]'::jsonb;
  take numeric;
BEGIN
  IF _quantity <= 0 THEN RETURN consumed; END IF;
  FOR lot_row IN
    SELECT id, quantity, expiry_date, lot_number FROM public.product_lots
    WHERE tenant_id = _tenant_id AND product_id = _product_id
      AND status = 'active' AND quantity > 0
    ORDER BY expiry_date NULLS LAST, created_at FOR UPDATE
  LOOP
    EXIT WHEN remaining <= 0;
    take := LEAST(lot_row.quantity, remaining);
    UPDATE public.product_lots
      SET quantity = quantity - take,
          status = CASE WHEN quantity - take <= 0 THEN 'depleted' ELSE status END
      WHERE id = lot_row.id;
    consumed := consumed || jsonb_build_object('lot_id', lot_row.id, 'lot_number', lot_row.lot_number, 'quantity', take, 'expiry_date', lot_row.expiry_date);
    remaining := remaining - take;
  END LOOP;
  RETURN jsonb_build_object('consumed', consumed, 'remaining', remaining);
END $$;
REVOKE ALL ON FUNCTION public.consume_lots_fefo(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_lots_fefo(uuid, uuid, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_expiring_lots(_days integer DEFAULT 30)
RETURNS TABLE (lot_id uuid, product_id uuid, product_name text, lot_number text, quantity numeric, expiry_date date, days_left integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.product_id, p.name, l.lot_number, l.quantity, l.expiry_date, (l.expiry_date - CURRENT_DATE)::integer
  FROM public.product_lots l JOIN public.products p ON p.id = l.product_id
  WHERE l.tenant_id = public.get_current_tenant_id()
    AND l.status = 'active' AND l.quantity > 0 AND l.expiry_date IS NOT NULL
    AND l.expiry_date <= CURRENT_DATE + _days
  ORDER BY l.expiry_date ASC
$$;
REVOKE ALL ON FUNCTION public.list_expiring_lots(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_expiring_lots(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.write_off_expired_lot(_lot_id uuid, _reason text DEFAULT 'Vencido')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lot RECORD;
BEGIN
  SELECT * INTO v_lot FROM public.product_lots WHERE id = _lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  IF v_lot.tenant_id <> public.get_current_tenant_id() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  INSERT INTO public.stock_movements(tenant_id, product_id, movement_type, quantity, description)
    VALUES (v_lot.tenant_id, v_lot.product_id, 'loss', -v_lot.quantity, format('Perda lote %s: %s', v_lot.lot_number, _reason));
  UPDATE public.products SET stock_current = GREATEST(0, stock_current - v_lot.quantity) WHERE id = v_lot.product_id;
  UPDATE public.product_lots SET quantity = 0, status = 'expired', notes = COALESCE(notes,'') || ' | Baixa: ' || _reason WHERE id = _lot_id;
END $$;
REVOKE ALL ON FUNCTION public.write_off_expired_lot(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_off_expired_lot(uuid, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text NOT NULL,
  barcode text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  sale_price numeric,
  cost_price numeric,
  stock_current numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY variants_tenant ON public.product_variants FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
CREATE TRIGGER variants_assert_tenant BEFORE INSERT ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_access();
CREATE TRIGGER variants_updated BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.product_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  parent_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  child_product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_product_id, child_product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_kits TO authenticated;
GRANT ALL ON public.product_kits TO service_role;
ALTER TABLE public.product_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY kits_tenant ON public.product_kits FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
CREATE TRIGGER kits_assert_tenant BEFORE INSERT ON public.product_kits
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_access();

CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text,
  position integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY images_tenant ON public.product_images FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
CREATE TRIGGER images_assert_tenant BEFORE INSERT ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_access();

DO $$ BEGIN
  CREATE POLICY "product_images_read" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "product_images_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "product_images_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "product_images_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  address text,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY warehouses_tenant ON public.warehouses FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
CREATE TRIGGER warehouses_assert BEFORE INSERT ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_access();
CREATE TRIGGER warehouses_updated BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.stock_by_warehouse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  reserved numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_by_warehouse TO authenticated;
GRANT ALL ON public.stock_by_warehouse TO service_role;
ALTER TABLE public.stock_by_warehouse ENABLE ROW LEVEL SECURITY;
CREATE POLICY sbw_tenant ON public.stock_by_warehouse FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
CREATE TRIGGER sbw_assert BEFORE INSERT ON public.stock_by_warehouse
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_access();

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  from_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  to_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY transfers_tenant ON public.stock_transfers FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
CREATE TRIGGER transfers_assert BEFORE INSERT ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_access();

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES public.warehouses(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  reference_type text,
  reference_id uuid,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_reservations TO authenticated;
GRANT ALL ON public.stock_reservations TO service_role;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY reservations_tenant ON public.stock_reservations FOR ALL TO authenticated
  USING (tenant_id = public.get_current_tenant_id()) WITH CHECK (tenant_id = public.get_current_tenant_id());
CREATE TRIGGER reservations_assert BEFORE INSERT ON public.stock_reservations
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_access();

CREATE OR REPLACE FUNCTION public.transfer_stock(
  _from_warehouse uuid, _to_warehouse uuid, _product_id uuid, _quantity numeric, _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.get_current_tenant_id(); v_available numeric; v_id uuid;
BEGIN
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser positiva'; END IF;
  IF _from_warehouse = _to_warehouse THEN RAISE EXCEPTION 'Depósitos devem ser diferentes'; END IF;
  SELECT quantity - reserved INTO v_available FROM public.stock_by_warehouse
    WHERE warehouse_id = _from_warehouse AND product_id = _product_id AND tenant_id = v_tenant FOR UPDATE;
  IF v_available IS NULL OR v_available < _quantity THEN RAISE EXCEPTION 'Estoque insuficiente no depósito de origem'; END IF;
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
REVOKE ALL ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) TO authenticated;

ALTER TABLE public.products   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.customers  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.suppliers  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.employees  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.trg_audit_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid;
BEGIN
  BEGIN v_tenant := public.get_current_tenant_id(); EXCEPTION WHEN OTHERS THEN v_tenant := NULL; END;
  INSERT INTO public.audit_logs(tenant_id, user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    COALESCE(v_tenant, (CASE WHEN TG_OP='DELETE' THEN (to_jsonb(OLD)->>'tenant_id')::uuid ELSE (to_jsonb(NEW)->>'tenant_id')::uuid END)),
    auth.uid(), TG_OP, TG_TABLE_NAME,
    COALESCE((CASE WHEN TG_OP='DELETE' THEN (to_jsonb(OLD)->>'id')::uuid ELSE (to_jsonb(NEW)->>'id')::uuid END)),
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','customers','suppliers','employees','sales','cash_sessions','purchase_orders','fiscal_documents']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%s ON public.%s', t, t);
    EXECUTE format('CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.trg_audit_row()', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.products_active AS SELECT * FROM public.products WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW public.customers_active AS SELECT * FROM public.customers WHERE deleted_at IS NULL;
GRANT SELECT ON public.products_active TO authenticated;
GRANT SELECT ON public.customers_active TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_product(_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products SET deleted_at = now(), active = false
    WHERE id = _product_id AND tenant_id = public.get_current_tenant_id();
END $$;
REVOKE ALL ON FUNCTION public.soft_delete_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_product(uuid) TO authenticated;
