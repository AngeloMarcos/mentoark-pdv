-- Dados FICTÍCIOS de demonstração para uma empresa da homologação.
--
-- Uso (no servidor):
--   docker exec -i pdv_hml_db psql -U postgres -d pdv -v ON_ERROR_STOP=1 \
--     -v tenant=<uuid da empresa> -v usuario=<uuid do usuário admin> < seed-demo.sql
--
-- Gera ~45 dias de operação de um mercadinho: produtos com NCM/EAN, clientes,
-- fornecedores, funcionários, caixas com sessões abertas/fechadas, vendas
-- (todas pela mesma checkout_sale_transaction do PDV), compras, lotes com
-- validade, contas a pagar/receber, promoções e fidelidade.
-- Recusa rodar se a empresa já tiver produtos. Para limpar: seed-demo-reset.sql.
-- Nomes, CPFs, CNPJs, telefones e e-mails são inventados (e-mails em
-- example.com); documentos têm dígito verificador válido só para passar nas
-- validações do sistema.

\set ON_ERROR_STOP 1
SELECT set_config('pdv.seed_tenant', :'tenant', false), set_config('pdv.seed_user', :'usuario', false);

BEGIN;

-- Roda como o usuário admin: RLS, gatilhos de acesso e auditoria se comportam como no app.
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('pdv.seed_user'), 'role', 'authenticated')::text, true);

CREATE FUNCTION pg_temp.dv11(_digits text, _weights int[]) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN s % 11 < 2 THEN 0 ELSE 11 - s % 11 END
  FROM (SELECT sum(substr(_digits, i, 1)::int * _weights[i]) AS s FROM generate_subscripts(_weights, 1) i) x
$$;
CREATE FUNCTION pg_temp.cpf(n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE b text := lpad((n * 7919 % 999999999)::text, 9, '1'); d1 int; d2 int; f text;
BEGIN
  d1 := pg_temp.dv11(b, ARRAY[10,9,8,7,6,5,4,3,2]);
  d2 := pg_temp.dv11(b || d1, ARRAY[11,10,9,8,7,6,5,4,3,2]);
  f := b || d1 || d2;
  RETURN substr(f,1,3)||'.'||substr(f,4,3)||'.'||substr(f,7,3)||'-'||substr(f,10,2);
END $$;
CREATE FUNCTION pg_temp.cnpj(n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE b text := lpad((n * 104729 % 99999999)::text, 8, '3') || '0001'; d1 int; d2 int; f text;
BEGIN
  d1 := pg_temp.dv11(b, ARRAY[5,4,3,2,9,8,7,6,5,4,3,2]);
  d2 := pg_temp.dv11(b || d1, ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2]);
  f := b || d1 || d2;
  RETURN substr(f,1,2)||'.'||substr(f,3,3)||'.'||substr(f,6,3)||'/'||substr(f,9,4)||'-'||substr(f,13,2);
END $$;
CREATE FUNCTION pg_temp.ean13(n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE b text := '789' || lpad((900000 + n)::text, 9, '0'); s int := 0;
BEGIN
  FOR i IN 1..12 LOOP s := s + substr(b, i, 1)::int * CASE WHEN i % 2 = 0 THEN 3 ELSE 1 END; END LOOP;
  RETURN b || ((10 - s % 10) % 10);
END $$;
-- Horário local (São Paulo) -> timestamptz
CREATE FUNCTION pg_temp.at(_day date, _minutes int) RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT ((_day + make_interval(mins => _minutes))::timestamp AT TIME ZONE 'America/Sao_Paulo')
$$;

CREATE FUNCTION pg_temp.seed(v_tenant uuid, v_user uuid) RETURNS text LANGUAGE plpgsql AS $seed$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_now_min int := extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo')::int * 60
                 + extract(minute FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
  v_days int := 45;
  v_wh uuid; v_reg1 uuid; v_reg2 uuid; v_session uuid;
  v_pool uuid[] := '{}'; v_customers uuid[]; v_cats jsonb := '{}';
  d int; v_day date; v_dow int; v_n int; v_s int; v_k int; v_items int;
  v_minute int; v_prod record; v_qty numeric; v_disc numeric; v_line numeric;
  v_items_json jsonb; v_gross numeric; v_disc_total numeric; v_net numeric;
  v_customer uuid; v_method text; v_paid numeric; v_change numeric; v_inst int;
  v_payload jsonb; v_sale uuid; v_ts timestamptz; v_cash numeric; v_withdraw numeric;
  v_open_bal numeric := 200; v_regs uuid[]; v_reg uuid; v_diff numeric;
  v_sales int := 0; v_supplier uuid[]; v_po uuid; v_cat uuid; v_m int; v_pick uuid;
  r record;
BEGIN
  PERFORM setseed(0.4217);

  IF NOT public.user_belongs_to_tenant(v_tenant) THEN
    RAISE EXCEPTION 'Usuário % não pertence à empresa %', v_user, v_tenant;
  END IF;
  IF EXISTS (SELECT 1 FROM public.products WHERE tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'A empresa já tem produtos; rode seed-demo-reset.sql antes de gerar de novo';
  END IF;

  -- Configurações -----------------------------------------------------------
  UPDATE public.tenants SET settings = settings
    || jsonb_build_object(
      'loyalty_enabled', true, 'loyalty_points_per_currency', 1,
      'loyalty_points_expiration_days', 365, 'loyalty_min_redeem_points', 100,
      'loyalty_currency_per_points', 0.05, 'fiado_due_days', 30, 'low_stock_alert_threshold', 10)
    || jsonb_build_object('fiscal', COALESCE(settings->'fiscal', '{}'::jsonb) || jsonb_build_object(
      'provider', 'simulado', 'ambiente', 'homologacao', 'uf', 'SP', 'municipio_ibge', '3550308',
      'regime_tributario', 'simples_nacional', 'crt', '1', 'serie_nfce', '1', 'proximo_numero', 1,
      'emite_nfce', false,
      'reforma', jsonb_build_object('enabled', true, 'modo', 'informativo', 'cbs', 0.9, 'ibs_uf', 0.1, 'ibs_mun', 0,
        'is_rules', jsonb_build_array(
          jsonb_build_object('id','fumo','label','Produtos fumígenos','match','ncm_prefix','value','24','aliquota',0,'active',false),
          jsonb_build_object('id','alcool','label','Bebidas alcoólicas','match','ncm_prefix','value','2203','aliquota',0,'active',false),
          jsonb_build_object('id','acucaradas','label','Bebidas açucaradas','match','ncm_prefix','value','2202','aliquota',0,'active',false)))))
  WHERE id = v_tenant;

  PERFORM public.seed_default_payment_methods(v_tenant);

  INSERT INTO public.warehouses (tenant_id, code, name, address, is_default, active)
  VALUES (v_tenant, 'LOJA', 'Loja (salão de vendas)', 'Rua das Palmeiras, 120 - São Paulo/SP', true, true),
         (v_tenant, 'DEP', 'Depósito dos fundos', 'Rua das Palmeiras, 120 - fundos', false, true);
  SELECT id INTO v_wh FROM public.warehouses WHERE tenant_id = v_tenant AND code = 'LOJA';

  INSERT INTO public.cash_registers (tenant_id, name, code, active) VALUES (v_tenant, 'Caixa 01', '01', true) RETURNING id INTO v_reg1;
  INSERT INTO public.cash_registers (tenant_id, name, code, active) VALUES (v_tenant, 'Caixa 02', '02', true) RETURNING id INTO v_reg2;

  -- Categorias financeiras --------------------------------------------------
  INSERT INTO public.financial_categories (tenant_id, name, type, color) VALUES
    (v_tenant,'Vendas no balcão','receita','#16a34a'), (v_tenant,'Vendas a Prazo','receita','#22c55e'),
    (v_tenant,'Outras receitas','receita','#84cc16'), (v_tenant,'Fornecedores','despesa','#ef4444'),
    (v_tenant,'Aluguel','despesa','#f97316'), (v_tenant,'Energia elétrica','despesa','#eab308'),
    (v_tenant,'Água','despesa','#0ea5e9'), (v_tenant,'Internet e telefone','despesa','#6366f1'),
    (v_tenant,'Salários e encargos','despesa','#a855f7'), (v_tenant,'Contabilidade','despesa','#64748b'),
    (v_tenant,'Impostos (DAS)','despesa','#dc2626'), (v_tenant,'Manutenção','despesa','#78716c');
  SELECT jsonb_object_agg(name, id) INTO v_cats FROM public.financial_categories WHERE tenant_id = v_tenant;

  -- Pessoas -------------------------------------------------------------------
  INSERT INTO public.employees (tenant_id, name, role, phone, active, email, cpf, department, salary, hire_date, contract_type, notes)
  SELECT v_tenant, e.name, e.role, '(11) 9' || lpad((41000000 + i * 137731 % 8999999)::text, 4, '0') || '-' || lpad((i * 4421 % 9999)::text, 4, '0'),
         true, lower(translate(split_part(e.name, ' ', 1), 'ÁáâãÉéêÍíÓóôõÚúçÇ', 'aaaaeeeiiooooouucc')) || '.' || i || '@example.com',
         pg_temp.cpf(500 + i), e.dept, e.salary, v_today - e.days, 'CLT', 'Funcionário fictício (dados de demonstração)'
  FROM (VALUES (1,'Renata Albuquerque','Gerente','Administração',3800,900),
               (2,'Diego Moreira','Operador de caixa','Frente de loja',2100,420),
               (3,'Patrícia Nogueira','Operadora de caixa','Frente de loja',2100,260),
               (4,'Lucas Ferraz','Repositor','Estoque',1900,180),
               (5,'Sônia Rezende','Açougue e frios','Perecíveis',2300,610))
       AS e(i, name, role, dept, salary, days);

  INSERT INTO public.customers (tenant_id, name, phone, document, email, notes)
  SELECT v_tenant, c.name,
         '(11) 9' || lpad((70000000 + i * 7919 % 29999999)::text, 8, '0')::text,
         pg_temp.cpf(i::int), lower(translate(split_part(c.name,' ',1) || '.' || split_part(c.name,' ',2), 'áâãéêíóôõúç', 'aaaeeiooouc')) || '@example.com',
         CASE WHEN i % 7 = 0 THEN 'Compra fiado com frequência' ELSE 'Cliente fictício (dados de demonstração)' END
  FROM unnest(ARRAY[
    'Ana Paula Ribeiro','Bruno Carvalho','Carla Mendes','Daniel Souza','Eduarda Lima','Fábio Rocha','Gabriela Martins',
    'Henrique Alves','Isabela Freitas','João Pedro Santos','Karina Duarte','Leonardo Pires','Mariana Costa','Nelson Barbosa',
    'Olívia Teixeira','Paulo Henrique Dias','Queila Moraes','Rafael Antunes','Sabrina Lopes','Thiago Monteiro',
    'Úrsula Campos','Vinícius Araújo','Wagner Nunes','Yasmin Cardoso','Zélia Fontes','Marcos Vieira','Luana Prado',
    'Otávio Brandão','Cristina Saldanha','Roberto Guimarães']) WITH ORDINALITY AS c(name, i);
  SELECT array_agg(id ORDER BY name) INTO v_customers FROM public.customers WHERE tenant_id = v_tenant;

  INSERT INTO public.suppliers (tenant_id, name, fantasy_name, document, phone, email, category, payment_terms, due_days,
                                street, number, neighborhood, city, state, zip_code, active, notes)
  SELECT v_tenant, s.name, s.fantasy, pg_temp.cnpj(i::int), '(11) 3' || lpad((i * 4999 % 999)::text, 3, '0') || '-' || lpad((i * 7333 % 9999)::text, 4, '0'),
         'comercial@' || lower(replace(s.fantasy, ' ', '')) || '.example.com', s.cat, s.terms, s.due,
         s.street, (100 + i * 37)::text, s.bairro, 'São Paulo', 'SP', '0' || (2000000 + i * 31337 % 999999)::text, true,
         'Fornecedor fictício (dados de demonstração)'
  FROM (VALUES
    ('Atacadão Boa Safra Distribuidora Ltda','Boa Safra','Mercearia','28 dias',28,'Av. do Estado','Cambuci'),
    ('Laticínios Serra Azul Ltda','Serra Azul','Laticínios e frios','14 dias',14,'Rua Guaicurus','Lapa'),
    ('Bebidas Rio Claro Comércio Ltda','Rio Claro Bebidas','Bebidas','21 dias',21,'Rua Sorocabanos','Ipiranga'),
    ('Hortifruti Ceasinha Comércio de Frutas Ltda','Ceasinha','Hortifruti','à vista',0,'Av. Dr. Gastão Vidigal','Vila Leopoldina'),
    ('Limpa Bem Produtos de Limpeza Ltda','Limpa Bem','Limpeza e higiene','30 dias',30,'Rua Coronel Bento Bicudo','Piqueri'),
    ('Panificadora Trigo de Ouro Ltda','Trigo de Ouro','Padaria','7 dias',7,'Rua Silva Bueno','Ipiranga'),
    ('Distribuidora Tabacaria Paulista Ltda','Tabacaria Paulista','Tabacaria','14 dias',14,'Rua Florêncio de Abreu','Centro'),
    ('Frigorífico Vale do Tietê Ltda','Vale do Tietê','Carnes e congelados','14 dias',14,'Av. Presidente Wilson','Mooca'))
    AS s(name, fantasy, cat, terms, due, street, bairro)
  CROSS JOIN LATERAL (SELECT ascii(s.fantasy) * 31 + length(s.name) AS i) x;
  SELECT array_agg(id ORDER BY name) INTO v_supplier FROM public.suppliers WHERE tenant_id = v_tenant;

  -- Produtos ----------------------------------------------------------------
  -- peso = popularidade nas vendas; reducao = redução IBS/CBS (100 cesta básica/hortifruti, 60 higiene)
  CREATE TEMP TABLE seed_products ON COMMIT DROP AS
  SELECT p.*, row_number() OVER () AS seq FROM (VALUES
    ('Arroz branco tipo 1 5kg','Mercearia','10063021','UN',19.90,27.90,15,9,100,null,'5102','102',null),
    ('Feijão carioca tipo 1 1kg','Mercearia','07133319','UN',6.10,8.99,20,9,100,null,'5102','102',null),
    ('Feijão preto tipo 1 1kg','Mercearia','07133399','UN',6.80,9.49,10,4,100,null,'5102','102',null),
    ('Açúcar refinado 1kg','Mercearia','17019900','UN',3.60,5.29,20,7,100,null,'5102','102',null),
    ('Café torrado e moído 500g','Mercearia','09012100','UN',14.50,21.90,15,8,100,null,'5102','102',null),
    ('Óleo de soja 900ml','Mercearia','15079011','UN',5.40,7.99,20,8,100,null,'5102','102',null),
    ('Farinha de trigo 1kg','Mercearia','11010010','UN',3.90,5.79,10,4,100,null,'5102','102',null),
    ('Macarrão espaguete 500g','Mercearia','19021900','UN',2.70,4.49,15,6,0,null,'5102','102',null),
    ('Molho de tomate tradicional 340g','Mercearia','21032010','UN',1.90,3.29,15,6,0,null,'5102','102',null),
    ('Sal refinado iodado 1kg','Mercearia','25010020','UN',1.40,2.49,10,3,100,null,'5102','102',null),
    ('Biscoito cream cracker 400g','Mercearia','19053100','UN',3.80,5.99,12,5,0,null,'5102','102',null),
    ('Biscoito recheado chocolate 140g','Mercearia','19053100','UN',1.70,2.99,20,6,0,null,'5102','102',null),
    ('Achocolatado em pó 400g','Mercearia','18069000','UN',5.90,8.99,8,4,0,null,'5102','102',null),
    ('Leite em pó integral 400g','Mercearia','04022110','UN',14.20,19.90,6,2,100,null,'5102','102',null),
    ('Vinagre de álcool 750ml','Mercearia','22090000','UN',1.80,2.99,8,2,0,null,'5102','102',null),
    ('Leite UHT integral 1L','Laticínios','04011010','UN',3.70,5.49,30,10,100,null,'5102','102',null),
    ('Manteiga com sal 200g','Laticínios','04051000','UN',8.90,12.99,8,4,100,60,'5102','102',null),
    ('Queijo muçarela fatiado (kg)','Laticínios','04061010','KG',32.00,49.90,5,5,0,20,'5102','102',null),
    ('Presunto cozido fatiado (kg)','Laticínios','16024100','KG',24.00,36.90,5,5,0,15,'5102','102',null),
    ('Iogurte natural 170g','Laticínios','04032000','UN',1.90,3.29,12,5,0,25,'5102','102',null),
    ('Requeijão cremoso 200g','Laticínios','04061090','UN',5.20,7.99,8,4,0,40,'5102','102',null),
    ('Ovos brancos (dúzia)','Hortifruti','04072100','UN',8.40,12.49,10,7,100,21,'5102','102',null),
    ('Banana prata (kg)','Hortifruti','08039000','KG',3.10,5.99,8,7,100,null,'5102','102',null),
    ('Tomate italiano (kg)','Hortifruti','07020000','KG',4.20,7.99,8,6,100,null,'5102','102',null),
    ('Batata inglesa (kg)','Hortifruti','07019000','KG',2.90,5.49,10,6,100,null,'5102','102',null),
    ('Cebola (kg)','Hortifruti','07031019','KG',2.60,4.99,8,5,100,null,'5102','102',null),
    ('Alface crespa (unidade)','Hortifruti','07051900','UN',1.50,2.99,6,4,100,null,'5102','102',null),
    ('Maçã gala (kg)','Hortifruti','08081000','KG',6.50,10.99,6,4,100,null,'5102','102',null),
    ('Pão francês (kg)','Padaria','19059090','KG',9.50,16.90,5,10,0,null,'5102','102',null),
    ('Pão de forma tradicional 500g','Padaria','19059010','UN',5.60,8.49,8,5,0,7,'5102','102',null),
    ('Bolo de fubá (unidade)','Padaria','19059090','UN',7.00,12.90,4,2,0,5,'5102','102',null),
    ('Frango congelado inteiro (kg)','Carnes','02071200','KG',8.90,13.99,10,5,100,180,'5102','102',null),
    ('Carne bovina patinho (kg)','Carnes','02013000','KG',34.00,47.90,6,5,100,null,'5102','102',null),
    ('Linguiça toscana (kg)','Carnes','16010000','KG',16.50,24.90,6,4,0,30,'5102','102',null),
    ('Sorvete pote 1,5L','Congelados','21050010','UN',14.00,22.90,4,2,0,240,'5405','500',null),
    ('Pizza congelada muçarela 460g','Congelados','19022000','UN',9.80,15.90,6,3,0,180,'5102','102',null),
    ('Refrigerante cola 2L','Bebidas','22021000','UN',6.20,9.99,24,9,0,null,'5405','500',null),
    ('Refrigerante guaraná 2L','Bebidas','22021000','UN',4.90,7.99,24,8,0,null,'5405','500',null),
    ('Água mineral sem gás 500ml','Bebidas','22011000','UN',0.80,2.49,48,8,0,null,'5405','500',null),
    ('Suco de uva integral 1L','Bebidas','20096100','UN',9.20,14.90,6,3,0,null,'5102','102',null),
    ('Energético lata 250ml','Bebidas','22029900','UN',4.10,7.49,12,3,0,null,'5405','500',null),
    ('Cerveja pilsen lata 350ml','Bebidas alcoólicas','22030000','UN',2.70,4.49,48,10,0,null,'5405','500',null),
    ('Cerveja puro malte long neck 330ml','Bebidas alcoólicas','22030000','UN',4.30,7.29,24,5,0,null,'5405','500',null),
    ('Cachaça 965ml','Bebidas alcoólicas','22084000','UN',9.50,16.90,4,2,0,null,'5405','500',null),
    ('Vinho tinto seco 750ml','Bebidas alcoólicas','22042100','UN',22.00,36.90,4,1,0,null,'5405','500',null),
    ('Cigarro maço 20 unidades','Tabacaria','24022000','UN',8.10,10.50,30,6,0,null,'5405','500',null),
    ('Isqueiro descartável','Tabacaria','96131000','UN',2.20,4.99,10,2,0,null,'5102','102',null),
    ('Sabão em pó 1,6kg','Limpeza','34022000','UN',14.80,21.90,8,4,0,null,'5102','102',null),
    ('Detergente líquido 500ml','Limpeza','34022000','UN',1.70,2.79,20,6,0,null,'5102','102',null),
    ('Água sanitária 2L','Limpeza','28289011','UN',3.30,5.49,10,4,0,null,'5102','102',null),
    ('Desinfetante lavanda 2L','Limpeza','38089419','UN',5.90,9.49,8,3,0,null,'5102','102',null),
    ('Esponja multiuso (3 unidades)','Limpeza','39249000','UN',2.30,4.29,10,3,0,null,'5102','102',null),
    ('Papel higiênico folha dupla (12 rolos)','Higiene','48181000','UN',15.90,23.90,8,5,60,null,'5102','102',null),
    ('Creme dental 90g','Higiene','33061000','UN',2.90,4.99,12,4,60,null,'5405','500',null),
    ('Sabonete em barra 85g','Higiene','34011190','UN',1.30,2.49,20,5,60,null,'5405','500',null),
    ('Shampoo 350ml','Higiene','33051000','UN',9.40,15.90,6,2,0,null,'5405','500',null),
    ('Desodorante aerosol 150ml','Higiene','33072010','UN',9.90,16.90,6,2,0,null,'5405','500',null),
    ('Absorvente com abas (8 unidades)','Higiene','96190000','UN',3.80,6.49,8,2,100,null,'5102','102',null),
    ('Ração para cães adulto 1kg','Pet','23091000','UN',11.50,18.90,5,2,0,null,'5102','102',null),
    ('Areia higiênica para gatos 4kg','Pet','25081000','UN',9.90,16.90,4,1,0,null,'5102','102',null),
    ('Pilha alcalina AA (2 unidades)','Utilidades','85061019','UN',6.90,11.90,6,1,0,null,'5102','102',null),
    ('Carvão vegetal 3kg','Utilidades','44029000','UN',10.50,17.90,4,2,0,null,'5102','102',null)
  ) AS p(name, category, ncm, unit, cost, price, min_stock, weight, reducao, lot_days, cfop, csosn, cest);

  INSERT INTO public.products (tenant_id, name, internal_code, barcode, ean, category, sale_price, cost_price, weighted_avg_cost,
                               stock_current, unit, unidade_medida, min_stock, active, ncm, cfop, csosn, origem,
                               controls_lot, extra_attributes)
  SELECT v_tenant, sp.name, 'P' || lpad(sp.seq::text, 4, '0'),
         CASE WHEN sp.unit = 'KG' THEN null ELSE pg_temp.ean13(sp.seq::int) END,
         CASE WHEN sp.unit = 'KG' THEN null ELSE pg_temp.ean13(sp.seq::int) END,
         sp.category, sp.price, sp.cost, sp.cost, 0, sp.unit, sp.unit, sp.min_stock, true, sp.ncm, sp.cfop, sp.csosn, 0,
         sp.lot_days IS NOT NULL,
         CASE WHEN sp.reducao > 0 THEN jsonb_build_object('tax', jsonb_build_object('reducao', sp.reducao)) ELSE '{}'::jsonb END
  FROM seed_products sp ORDER BY sp.seq;

  -- Pool de sorteio ponderado pela popularidade
  SELECT array_agg(p.id) INTO v_pool
  FROM public.products p JOIN seed_products sp ON sp.name = p.name AND p.tenant_id = v_tenant
  CROSS JOIN LATERAL generate_series(1, sp.weight);

  -- Promoções -----------------------------------------------------------------
  INSERT INTO public.promotions (tenant_id, name, description, discount_type, discount_value, scope, category, product_ids,
                                 min_quantity, starts_at, ends_at, active, created_by)
  VALUES
    (v_tenant, 'Quarta do Hortifruti', '10% em frutas, legumes e verduras às quartas', 'percentage', 10, 'category', 'Hortifruti', null,
     null, pg_temp.at(v_today - 30, 0), pg_temp.at(v_today + 30, 0), true, v_user),
    (v_tenant, 'Leve 3 refrigerantes 2L', 'R$ 1,00 de desconto por unidade a partir de 3', 'fixed', 1, 'products', null,
     (SELECT array_agg(id) FROM public.products WHERE tenant_id = v_tenant AND name LIKE 'Refrigerante%'),
     3, pg_temp.at(v_today - 15, 0), pg_temp.at(v_today + 15, 0), true, v_user),
    (v_tenant, 'Semana da Limpeza', '5% em produtos de limpeza', 'percentage', 5, 'category', 'Limpeza', null,
     null, pg_temp.at(v_today - 60, 0), pg_temp.at(v_today - 53, 0), false, v_user);

  -- Vendas (45 dias + hoje) ---------------------------------------------------
  FOR d IN REVERSE v_days..0 LOOP
    v_day := v_today - d;
    v_dow := extract(isodow FROM v_day)::int;           -- 1=seg ... 7=dom
    v_n := CASE v_dow WHEN 6 THEN 34 + floor(random() * 10)::int
                      WHEN 7 THEN 14 + floor(random() * 6)::int
                      WHEN 5 THEN 26 + floor(random() * 8)::int
                      ELSE 18 + floor(random() * 9)::int END;
    v_regs := CASE WHEN v_dow IN (5, 6) THEN ARRAY[v_reg1, v_reg2] ELSE ARRAY[v_reg1] END;
    IF d = 0 THEN
      -- hoje: só o que já "aconteceu" até agora, no Caixa 01, que fica aberto
      v_regs := ARRAY[v_reg1];
      v_n := greatest(0, least(v_n, (v_now_min - 450) / 30));
    END IF;

    FOREACH v_reg IN ARRAY v_regs LOOP
      INSERT INTO public.cash_sessions (tenant_id, register_id, user_id, opened_at, opening_balance, status, notes)
      VALUES (v_tenant, v_reg, v_user, pg_temp.at(v_day, 450 + floor(random() * 20)::int), v_open_bal,
              'open', CASE WHEN d = 0 THEN 'Sessão de hoje (demonstração)' END)
      RETURNING id INTO v_session;

      v_cash := 0;
      FOR v_s IN 1..(v_n / array_length(v_regs, 1)) LOOP
        -- horário: 08:00–20:30, com picos no almoço e fim de tarde
        v_minute := CASE WHEN random() < 0.35 THEN 690 + floor(random() * 120)::int
                         WHEN random() < 0.6 THEN 1050 + floor(random() * 150)::int
                         ELSE 480 + floor(random() * 750)::int END;
        IF d = 0 AND v_minute > v_now_min - 5 THEN v_minute := 480 + floor(random() * greatest(1, v_now_min - 490))::int; END IF;

        v_items := 1 + floor(power(random(), 1.6) * 8)::int;
        v_items_json := '[]'; v_gross := 0; v_disc_total := 0;
        FOR v_k IN 1..v_items LOOP
          -- sorteia ANTES da consulta: random() dentro do WHERE seria recalculado a cada linha
          v_pick := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
          SELECT p.id, p.sale_price, p.unit, p.category, p.name INTO STRICT v_prod
          FROM public.products p WHERE p.id = v_pick;
          CONTINUE WHEN v_items_json @> jsonb_build_array(jsonb_build_object('product_id', v_prod.id));
          v_qty := CASE WHEN v_prod.unit = 'KG' THEN round((0.25 + random() * 1.75)::numeric, 3)
                        WHEN random() < 0.75 THEN 1 ELSE 2 + floor(random() * 4) END;
          v_disc := 0;
          IF v_prod.category = 'Hortifruti' AND v_dow = 3 THEN v_disc := round(v_qty * v_prod.sale_price * 0.10, 2); END IF;
          IF v_prod.name LIKE 'Refrigerante%' AND v_qty >= 3 AND d <= 15 THEN v_disc := v_qty * 1; END IF;
          v_line := round(v_qty * v_prod.sale_price, 2);
          v_items_json := v_items_json || jsonb_build_array(jsonb_build_object(
            'product_id', v_prod.id, 'quantity', v_qty, 'unit_price', v_prod.sale_price,
            'discount', v_disc, 'total', v_line - v_disc));
          v_gross := v_gross + v_line; v_disc_total := v_disc_total + v_disc;
        END LOOP;
        v_net := v_gross - v_disc_total;

        v_customer := CASE WHEN random() < 0.35 THEN v_customers[1 + floor(random() * array_length(v_customers, 1))::int] END;
        v_method := CASE
          WHEN v_customer IS NOT NULL AND random() < 0.14 THEN 'fiado'
          ELSE (ARRAY['dinheiro','dinheiro','dinheiro','pix','pix','pix','pix','cartao_debito','cartao_debito','cartao_credito','cartao_credito'])
               [1 + floor(random() * 11)::int] END;
        v_paid := v_net; v_change := 0; v_inst := 1;
        IF v_method = 'dinheiro' THEN
          v_paid := CASE WHEN random() < 0.3 THEN v_net
                         WHEN v_net < 20 THEN ceil(v_net / 5) * 5
                         WHEN v_net < 100 THEN ceil(v_net / 10) * 10
                         ELSE ceil(v_net / 50) * 50 END;
          v_change := v_paid - v_net;
          v_cash := v_cash + v_net;
        ELSIF v_method = 'cartao_credito' AND v_net > 150 THEN
          v_inst := 1 + floor(random() * 3)::int;
        END IF;

        v_payload := jsonb_build_object(
          'tenant_id', v_tenant, 'user_id', v_user, 'customer_id', v_customer, 'session_id', v_session,
          'gross_total', v_gross, 'discount_total', v_disc_total, 'net_total', v_net,
          'payment_method', v_method, 'items', v_items_json,
          'payments', jsonb_build_array(jsonb_build_object(
            'payment_method_id', (SELECT id FROM public.payment_methods WHERE tenant_id = v_tenant AND code = v_method),
            'payment_method_code', v_method, 'amount', v_paid, 'change_amount', v_change, 'installments', v_inst)));

        v_sale := (public.checkout_sale_transaction(v_payload)->>'sale_id')::uuid;
        v_sales := v_sales + 1;

        -- leva os registros gerados pela venda para a data/hora da venda
        v_ts := pg_temp.at(v_day, v_minute) + make_interval(secs => floor(random() * 59));
        UPDATE public.sales SET datetime = v_ts, created_at = v_ts WHERE id = v_sale;
        UPDATE public.sale_payments SET created_at = v_ts WHERE sale_id = v_sale;
        UPDATE public.stock_movements SET created_at = v_ts WHERE sale_id = v_sale;
        UPDATE public.cash_movements SET created_at = v_ts WHERE sale_id = v_sale;
        UPDATE public.financial_entries SET entry_date = v_day, created_at = v_ts WHERE sale_id = v_sale;
        UPDATE public.customer_points SET created_at = v_ts, expires_at = v_day + 365 WHERE sale_id = v_sale;
        UPDATE public.accounts SET due_date = v_day + 30, created_at = v_ts
          WHERE tenant_id = v_tenant AND notes LIKE '%' || v_sale::text;
      END LOOP;

      IF d > 0 THEN
        -- sangria no fim do dia quando o caixa passa de R$ 600 em dinheiro
        v_withdraw := CASE WHEN v_cash > 600 THEN floor((v_cash - 300) / 100) * 100 ELSE 0 END;
        IF v_withdraw > 0 THEN
          INSERT INTO public.cash_movements (tenant_id, session_id, user_id, movement_type, amount, payment_method, description, created_at)
          VALUES (v_tenant, v_session, v_user, 'withdrawal', v_withdraw, 'dinheiro', 'Sangria para o cofre', pg_temp.at(v_day, 1200));
          -- o gatilho espelha no financeiro com a data de hoje; corrige para o dia certo
          UPDATE public.financial_entries SET entry_date = v_day, created_at = pg_temp.at(v_day, 1200)
           WHERE id = (SELECT id FROM public.financial_entries WHERE tenant_id = v_tenant AND sale_id IS NULL
                         AND description = 'Sangria para o cofre' AND entry_date = CURRENT_DATE AND amount = v_withdraw LIMIT 1);
        END IF;
        v_diff := CASE WHEN random() < 0.8 THEN 0 ELSE (ARRAY[-5, -2.5, -0.5, 1, 2])[1 + floor(random() * 5)::int] END;
        UPDATE public.cash_sessions SET
          status = 'closed', closed_at = pg_temp.at(v_day, 1250 + floor(random() * 30)::int),
          expected_balance = v_open_bal + v_cash - v_withdraw,
          closing_balance = v_open_bal + v_cash - v_withdraw + v_diff,
          difference = v_diff,
          difference_reason = CASE WHEN v_diff < 0 THEN 'Troco dado a mais' WHEN v_diff > 0 THEN 'Cliente deixou o troco' END
        WHERE id = v_session;
      END IF;
    END LOOP;
  END LOOP;

  -- Compras ---------------------------------------------------------------------
  FOR v_m IN 1..3 LOOP
    INSERT INTO public.purchase_orders (tenant_id, supplier_id, order_number, status, expected_date, received_date,
                                        total_cost, freight, discount, notes, created_by, created_at)
    VALUES (v_tenant, v_supplier[v_m], 'PC-' || to_char(v_today, 'YY') || lpad(v_m::text, 4, '0'),
            CASE v_m WHEN 3 THEN 'sent' ELSE 'received' END,
            v_today - 30 + v_m * 14, CASE WHEN v_m < 3 THEN v_today - 30 + v_m * 14 END,
            0, CASE WHEN v_m = 2 THEN 35 ELSE 0 END, 0, 'Pedido de demonstração', v_user, pg_temp.at(least(v_today, v_today - 37 + v_m * 14), 600))
    RETURNING id INTO v_po;
    INSERT INTO public.purchase_order_items (order_id, product_id, quantity_ordered, quantity_received, unit_cost, total)
    SELECT v_po, p.id, q, CASE WHEN v_m < 3 THEN q ELSE 0 END, p.cost_price, q * p.cost_price
    FROM (SELECT id, cost_price, (6 + floor(random() * 4) * 6)::numeric AS q FROM public.products
          WHERE tenant_id = v_tenant AND unit = 'UN' ORDER BY md5(id::text || v_m) LIMIT 6) p;
    IF v_m < 3 THEN
      INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, description, created_at)
      SELECT v_tenant, i.product_id, 'purchase', i.quantity_received,
             'Recebimento ' || 'PC-' || to_char(v_today, 'YY') || lpad(v_m::text, 4, '0'), pg_temp.at(v_today - 30 + v_m * 14, 660)
      FROM public.purchase_order_items i WHERE i.order_id = v_po;
    END IF;
    UPDATE public.purchase_orders SET total_cost = (SELECT sum(total) FROM public.purchase_order_items WHERE order_id = v_po) + freight
    WHERE id = v_po;
  END LOOP;

  -- Estoque: entrada inicial = vendido + estoque final desejado -----------------
  FOR r IN
    SELECT p.id, p.cost_price, p.min_stock, p.unit, sp.lot_days, sp.seq,
           -COALESCE(p.stock_current, 0) AS sold,
           COALESCE((SELECT sum(i.quantity_received) FROM public.purchase_order_items i
                     JOIN public.purchase_orders po ON po.id = i.order_id
                     WHERE po.tenant_id = v_tenant AND i.product_id = p.id), 0) AS received
    FROM public.products p JOIN seed_products sp ON sp.name = p.name WHERE p.tenant_id = v_tenant
  LOOP
    v_qty := CASE WHEN r.seq % 9 = 0 THEN round(r.min_stock * 0.4)        -- alguns abaixo do mínimo
                  WHEN r.seq % 13 = 0 THEN 0                               -- e alguns zerados
                  ELSE round(r.min_stock * (1.2 + random() * 3)) END;
    IF r.unit = 'KG' THEN v_qty := round(v_qty + random()::numeric * 3, 3); END IF;
    -- vendido + final - recebido nas compras (nunca negativo)
    v_qty := greatest(v_qty, r.received - r.sold);
    INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, description, created_at)
    SELECT v_tenant, r.id, 'purchase', r.sold + v_qty - r.received, 'Estoque inicial (implantação)', pg_temp.at(v_today - v_days - 1, 420)
    WHERE r.sold + v_qty - r.received > 0;
    UPDATE public.products SET stock_current = v_qty WHERE id = r.id;
    INSERT INTO public.stock_by_warehouse (tenant_id, warehouse_id, product_id, quantity, reserved)
    VALUES (v_tenant, v_wh, r.id, v_qty, 0);

    IF r.lot_days IS NOT NULL AND v_qty > 0 THEN
      -- dois lotes: um perto de vencer (alerta de validade) e um novo
      INSERT INTO public.product_lots (tenant_id, product_id, lot_number, manufacture_date, expiry_date, quantity, cost_price, status, supplier_info, notes)
      VALUES (v_tenant, r.id, 'L' || to_char(v_today - 20, 'YYMMDD') || '-' || r.seq, v_today - 20,
              v_today + CASE WHEN r.seq % 3 = 0 THEN -2 ELSE least(r.lot_days / 4, 6) END,
              round(v_qty * 0.3, 3), r.cost_price, 'active', 'Lote do fornecedor', 'Dados de demonstração'),
             (v_tenant, r.id, 'L' || to_char(v_today - 2, 'YYMMDD') || '-' || r.seq, v_today - 2, v_today + r.lot_days,
              v_qty - round(v_qty * 0.3, 3), r.cost_price, 'active', 'Lote do fornecedor', 'Dados de demonstração');
    END IF;
  END LOOP;

  -- Contas a pagar e receber ------------------------------------------------------
  FOR v_m IN 0..2 LOOP   -- mês atual e dois anteriores
    v_day := (date_trunc('month', v_today) - make_interval(months => v_m))::date;
    INSERT INTO public.accounts (tenant_id, type, description, amount, due_date, status, category_id, party_name, notes,
                                 paid_at, paid_amount, payment_method, created_by)
    SELECT v_tenant, 'pagar', a.descr || ' ' || to_char(v_day, 'MM/YYYY'), a.amount, v_day + a.dia - 1,
           CASE WHEN v_m > 0 OR v_day + a.dia - 1 < v_today - 3 THEN 'paga'
                WHEN v_day + a.dia - 1 < v_today THEN 'vencida' ELSE 'aberta' END,
           (v_cats->>a.cat)::uuid, a.party, 'Dados de demonstração',
           CASE WHEN v_m > 0 OR v_day + a.dia - 1 < v_today - 3 THEN v_day + a.dia - 1 END,
           CASE WHEN v_m > 0 OR v_day + a.dia - 1 < v_today - 3 THEN a.amount END,
           CASE WHEN v_m > 0 OR v_day + a.dia - 1 < v_today - 3 THEN 'pix' END, v_user
    FROM (VALUES ('Aluguel do imóvel', 3500.00, 5, 'Aluguel', 'Imobiliária Jardim Paulista (fictícia)'),
                 ('Conta de energia', 870.40 + v_m * 33, 12, 'Energia elétrica', 'Distribuidora de energia'),
                 ('Conta de água', 214.90 - v_m * 9, 15, 'Água', 'Companhia de saneamento'),
                 ('Internet e telefone', 189.90, 10, 'Internet e telefone', 'Provedor de internet'),
                 ('Honorários contábeis', 650.00, 10, 'Contabilidade', 'Escritório Contábil Exemplo'),
                 ('Folha de pagamento', 12200.00, 5, 'Salários e encargos', 'Funcionários'),
                 ('DAS - Simples Nacional', 1980.00 + v_m * 120, 20, 'Impostos (DAS)', 'Receita Federal')
         ) AS a(descr, amount, dia, cat, party)
    WHERE v_day + a.dia - 1 <= v_today + 25;
  END LOOP;

  -- boletos de fornecedor das compras recebidas (um já vencido)
  INSERT INTO public.accounts (tenant_id, type, description, amount, due_date, status, category_id, party_name, notes, created_by,
                               paid_at, paid_amount, payment_method)
  SELECT v_tenant, 'pagar', 'Boleto ' || po.order_number, po.total_cost, po.received_date + s.due_days,
         CASE WHEN po.received_date + s.due_days < v_today - 5 THEN 'paga'
              WHEN po.received_date + s.due_days < v_today THEN 'vencida' ELSE 'aberta' END,
         (v_cats->>'Fornecedores')::uuid, s.name, 'Dados de demonstração', v_user,
         CASE WHEN po.received_date + s.due_days < v_today - 5 THEN po.received_date + s.due_days END,
         CASE WHEN po.received_date + s.due_days < v_today - 5 THEN po.total_cost END,
         CASE WHEN po.received_date + s.due_days < v_today - 5 THEN 'boleto' END
  FROM public.purchase_orders po JOIN public.suppliers s ON s.id = po.supplier_id
  WHERE po.tenant_id = v_tenant AND po.status = 'received';

  -- fiado: o que venceu há mais de 5 dias, a maioria já foi paga
  UPDATE public.accounts SET status = 'paga', paid_at = due_date - floor(random() * 10)::int, paid_amount = amount, payment_method = 'pix'
  WHERE tenant_id = v_tenant AND type = 'receber' AND due_date < v_today - 5 AND random() < 0.8;
  UPDATE public.accounts SET status = 'vencida'
  WHERE tenant_id = v_tenant AND type = 'receber' AND status = 'aberta' AND due_date < v_today;

  -- auditoria: alinha a data dos registros com a data das vendas
  UPDATE public.audit_logs al SET created_at = s.datetime
  FROM public.sales s WHERE al.entity_type = 'sales' AND al.entity_id = s.id AND s.tenant_id = v_tenant;

  RETURN format('ok: %s vendas em %s dias', v_sales, v_days + 1);
END $seed$;

SELECT pg_temp.seed(current_setting('pdv.seed_tenant')::uuid, current_setting('pdv.seed_user')::uuid);

COMMIT;
