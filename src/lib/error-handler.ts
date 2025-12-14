/**
 * Centralized error handler for database operations.
 * Maps technical database errors to user-friendly messages
 * while logging detailed error information for debugging.
 */

export function getUserFriendlyError(error: Error): string {
  const msg = error.message.toLowerCase();

  // Duplicate/unique constraint violations
  if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
    return 'Este registro já existe no sistema';
  }

  // Foreign key constraint violations
  if (msg.includes('foreign key') || msg.includes('violates foreign key') || msg.includes('fk_')) {
    return 'Operação não permitida devido a dependências com outros registros';
  }

  // Check constraint violations
  if (msg.includes('check constraint') || msg.includes('constraint')) {
    return 'Dados inválidos. Verifique os valores informados';
  }

  // Not-null violations
  if (msg.includes('not-null') || msg.includes('null value') || msg.includes('required')) {
    return 'Campos obrigatórios não foram preenchidos';
  }

  // Permission/authorization errors
  if (msg.includes('permission') || msg.includes('denied') || msg.includes('unauthorized') || msg.includes('rls')) {
    return 'Você não tem permissão para realizar esta operação';
  }

  // Authentication errors
  if (msg.includes('not authenticated') || msg.includes('authentication') || msg.includes('jwt')) {
    return 'Sessão expirada. Faça login novamente';
  }

  // Network/connection errors
  if (msg.includes('network') || msg.includes('connection') || msg.includes('timeout')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente';
  }

  // Rate limiting
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Muitas requisições. Aguarde um momento e tente novamente';
  }

  // Validation errors (custom)
  if (msg.includes('nome é obrigatório') || msg.includes('invalid input')) {
    return error.message; // Return custom validation messages as-is
  }

  // Log the full error for debugging (don't expose to user)
  console.error('[Database Error]', error);

  // Generic fallback message
  return 'Erro ao processar operação. Tente novamente';
}

/**
 * Sanitizes search input to prevent SQL wildcard manipulation.
 * Escapes SQL wildcards (%, _) and limits length.
 */
export function sanitizeSearchTerm(searchTerm: string, maxLength = 100): string {
  if (!searchTerm) return '';
  
  // Trim and limit length
  let sanitized = searchTerm.trim().slice(0, maxLength);
  
  // Escape SQL wildcard characters
  sanitized = sanitized.replace(/[%_]/g, '\\$&');
  
  return sanitized;
}