-- Apaga TODOS os dados operacionais de uma empresa da homologação, mantendo a
-- empresa, os usuários e as configurações. Serve para limpar o seed-demo.sql.
--
--   docker exec -i pdv_hml_db psql -U postgres -d pdv -v ON_ERROR_STOP=1 \
--     -v tenant=<uuid da empresa> < seed-demo-reset.sql
--
-- Gatilhos desligados nesta sessão (session_replication_role = replica): sem
-- isso, as travas de acesso/auditoria e a proteção de documentos fiscais
-- reais bloqueariam a limpeza feita fora de uma requisição de usuário.
\set ON_ERROR_STOP 1
SELECT set_config('pdv.reset_tenant', :'tenant', false);
BEGIN;
SET LOCAL session_replication_role = replica;

DO $$
DECLARE
  v_tenant uuid := current_setting('pdv.reset_tenant')::uuid;
  t text;
  n bigint;
  total bigint := 0;
BEGIN
  -- filhos sem tenant_id
  DELETE FROM public.sale_payments WHERE sale_id IN (SELECT id FROM public.sales WHERE tenant_id = v_tenant);
  DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE tenant_id = v_tenant);
  DELETE FROM public.purchase_order_items WHERE order_id IN (SELECT id FROM public.purchase_orders WHERE tenant_id = v_tenant);
  -- tabelas com tenant_id, das dependentes para as principais
  FOREACH t IN ARRAY ARRAY[
    'audit_logs','customer_points','customer_credits','cash_movements','financial_entries','accounts',
    'fiscal_documents','stock_movements','stock_by_warehouse','stock_reservations','stock_transfers',
    'product_lots','product_barcodes','product_images','product_variants','product_kits',
    'sale_return_items','sale_returns','sales','cash_sessions','cash_registers','purchase_orders',
    'promotions','products','suppliers','employees','customers','financial_categories',
    'payment_methods','warehouses'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL AND EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('DELETE FROM public.%I WHERE tenant_id = $1', t) USING v_tenant;
      GET DIAGNOSTICS n = ROW_COUNT;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'Linhas apagadas: %', total;
END $$;

COMMIT;
