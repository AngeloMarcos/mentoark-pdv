-- Sprint 1: Código de Barras e Impressão

-- Múltiplos códigos de barras por produto
CREATE TABLE public.product_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  barcode_type TEXT NOT NULL DEFAULT 'EAN13', -- EAN8, EAN13, INTERNAL
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, barcode)
);

-- Índices para performance
CREATE INDEX idx_product_barcodes_tenant ON public.product_barcodes(tenant_id);
CREATE INDEX idx_product_barcodes_product ON public.product_barcodes(product_id);
CREATE INDEX idx_product_barcodes_barcode ON public.product_barcodes(barcode);

-- RLS para product_barcodes
ALTER TABLE public.product_barcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view barcodes of their tenants"
ON public.product_barcodes FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert barcodes in their tenants"
ON public.product_barcodes FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update barcodes in their tenants"
ON public.product_barcodes FOR UPDATE
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete barcodes"
ON public.product_barcodes FOR DELETE
USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "Super admins can access all barcodes"
ON public.product_barcodes FOR ALL
USING (is_super_admin());

-- Configurações de impressora por tenant
CREATE TABLE public.printer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  printer_type TEXT NOT NULL DEFAULT 'thermal', -- thermal, label, fiscal
  connection_type TEXT NOT NULL DEFAULT 'usb', -- usb, network, bluetooth
  ip_address TEXT,
  port INTEGER,
  paper_width INTEGER DEFAULT 80, -- mm (58 ou 80)
  is_default BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para printer_configs
CREATE INDEX idx_printer_configs_tenant ON public.printer_configs(tenant_id);

-- RLS para printer_configs
ALTER TABLE public.printer_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view printers of their tenants"
ON public.printer_configs FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can manage printers"
ON public.printer_configs FOR ALL
USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "Super admins can access all printers"
ON public.printer_configs FOR ALL
USING (is_super_admin());

-- Função para validar código EAN (dígito verificador)
CREATE OR REPLACE FUNCTION public.validate_ean(barcode TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  len INTEGER;
  sum INTEGER := 0;
  i INTEGER;
  digit INTEGER;
  check_digit INTEGER;
BEGIN
  -- Remove espaços
  barcode := TRIM(barcode);
  len := LENGTH(barcode);
  
  -- Deve ter 8 ou 13 dígitos
  IF len NOT IN (8, 13) THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica se são apenas números
  IF barcode !~ '^[0-9]+$' THEN
    RETURN FALSE;
  END IF;
  
  -- Calcula dígito verificador
  FOR i IN 1..(len - 1) LOOP
    digit := CAST(SUBSTRING(barcode FROM i FOR 1) AS INTEGER);
    IF len = 13 THEN
      IF i % 2 = 0 THEN
        sum := sum + (digit * 3);
      ELSE
        sum := sum + digit;
      END IF;
    ELSE -- EAN8
      IF i % 2 = 1 THEN
        sum := sum + (digit * 3);
      ELSE
        sum := sum + digit;
      END IF;
    END IF;
  END LOOP;
  
  check_digit := (10 - (sum % 10)) % 10;
  
  RETURN check_digit = CAST(SUBSTRING(barcode FROM len FOR 1) AS INTEGER);
END;
$$;

-- Função para gerar código interno único
CREATE OR REPLACE FUNCTION public.generate_internal_barcode(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    -- Gera código de 7 dígitos + check digit
    new_code := LPAD(FLOOR(RANDOM() * 10000000)::TEXT, 7, '0');
    
    -- Calcula dígito verificador (EAN-8 style)
    DECLARE
      sum INTEGER := 0;
      i INTEGER;
      digit INTEGER;
      check_digit INTEGER;
    BEGIN
      FOR i IN 1..7 LOOP
        digit := CAST(SUBSTRING(new_code FROM i FOR 1) AS INTEGER);
        IF i % 2 = 1 THEN
          sum := sum + (digit * 3);
        ELSE
          sum := sum + digit;
        END IF;
      END LOOP;
      check_digit := (10 - (sum % 10)) % 10;
      new_code := new_code || check_digit::TEXT;
    END;
    
    -- Verifica se já existe
    SELECT COUNT(*) INTO exists_count
    FROM public.product_barcodes
    WHERE tenant_id = p_tenant_id AND barcode = new_code;
    
    IF exists_count = 0 THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;