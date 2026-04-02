-- Fix search_path on update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix search_path on validate_ean
CREATE OR REPLACE FUNCTION public.validate_ean(barcode TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  len INTEGER;
  sum INTEGER := 0;
  i INTEGER;
  digit INTEGER;
  check_digit INTEGER;
BEGIN
  barcode := TRIM(barcode);
  len := LENGTH(barcode);
  IF len NOT IN (8, 13) THEN RETURN FALSE; END IF;
  IF barcode !~ '^[0-9]+$' THEN RETURN FALSE; END IF;
  FOR i IN 1..(len - 1) LOOP
    digit := CAST(SUBSTRING(barcode FROM i FOR 1) AS INTEGER);
    IF len = 13 THEN
      IF i % 2 = 0 THEN sum := sum + (digit * 3);
      ELSE sum := sum + digit; END IF;
    ELSE
      IF i % 2 = 1 THEN sum := sum + (digit * 3);
      ELSE sum := sum + digit; END IF;
    END IF;
  END LOOP;
  check_digit := (10 - (sum % 10)) % 10;
  RETURN check_digit = CAST(SUBSTRING(barcode FROM len FOR 1) AS INTEGER);
END;
$$;

-- Fix RLS always-true on tenants INSERT policy
DROP POLICY IF EXISTS "Users can create tenants" ON public.tenants;
CREATE POLICY "Authenticated users can create tenants"
  ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);