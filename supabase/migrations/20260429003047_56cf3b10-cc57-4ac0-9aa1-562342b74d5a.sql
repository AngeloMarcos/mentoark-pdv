-- Sprint 6: RBAC + Employees expansion

-- 1) Expand app_role enum with new role values
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'financial';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'stock';