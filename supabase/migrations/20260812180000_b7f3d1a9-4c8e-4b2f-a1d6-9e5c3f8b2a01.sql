-- Corrige bug em transfer_tab: a mesa antiga era marcada como status
-- 'free', mas a constraint de public.tables só aceita
-- ('available', 'occupied', 'reserved') — todo "transferir comanda de
-- mesa" que tivesse uma mesa anterior para liberar falhava com violação
-- de CHECK constraint (a transação inteira era revertida, incluindo os
-- UPDATEs de tabs/orders que já tinham sido feitos na mesma função).
CREATE OR REPLACE FUNCTION public.transfer_tab(p_tab_id uuid, p_table_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tenant uuid; v_old_table uuid;
BEGIN
  SELECT tenant_id, table_id INTO v_tenant, v_old_table FROM public.tabs WHERE id = p_tab_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tables WHERE id = p_table_id AND tenant_id = v_tenant
  ) THEN RAISE EXCEPTION 'Mesa inválida'; END IF;

  UPDATE public.tabs SET table_id = p_table_id WHERE id = p_tab_id;
  UPDATE public.orders SET table_id = p_table_id WHERE tab_id = p_tab_id;
  IF v_old_table IS NOT NULL THEN
    UPDATE public.tables SET status = 'available' WHERE id = v_old_table;
  END IF;
  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables SET status = 'occupied' WHERE id = p_table_id;
  END IF;
END $$;
