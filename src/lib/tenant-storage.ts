// Chaves de localStorage para a empresa (tenant) selecionada.
// Em módulo próprio (em vez de dentro de TenantContext.tsx) para o
// AuthContext poder limpar essas chaves no signOut sem criar import
// circular entre os dois contexts.
export const TENANT_STORAGE_KEY = "pdv_current_tenant_id";
export const TENANT_CACHE_KEY = "pdv_current_tenant_cache";
