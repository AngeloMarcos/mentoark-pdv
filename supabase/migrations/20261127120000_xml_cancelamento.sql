-- XML do evento de cancelamento da NFC-e (vai no pacote mensal do contador).
-- Gravado só pelo serviço fiscal; a trava guard_real_fiscal_documents já
-- impede o navegador de alterar documento real.
ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS xml_cancelamento_url text;

-- Pacote mensal: notas reais de uma empresa num intervalo de datas.
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_mensal
  ON public.fiscal_documents(tenant_id, created_at)
  WHERE provider <> 'simulado' AND status IN ('autorizado', 'cancelado');
