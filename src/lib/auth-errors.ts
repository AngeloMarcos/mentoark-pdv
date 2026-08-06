/**
 * Tradução centralizada das mensagens de erro de autenticação para PT-BR.
 */
export function translateAuthError(message?: string | null): string {
  const m = (message ?? "").toLowerCase();

  if (!m) return "Ocorreu um erro inesperado. Tente novamente.";

  if (m.includes("invalid login") || m.includes("invalid_credentials"))
    return "Email ou senha incorretos. Verifique e tente novamente.";
  if (m.includes("email not confirmed") || m.includes("email_not_confirmed"))
    return "Email ainda não confirmado. Verifique sua caixa de entrada (e o spam).";
  if (m.includes("user already registered") || m.includes("already registered"))
    return "Este email já possui uma conta. Faça login ou recupere a senha.";
  if (m.includes("password should be") || m.includes("password_too_short"))
    return "A senha precisa ter no mínimo 6 caracteres.";
  if (m.includes("pwned") || m.includes("compromised"))
    return "Esta senha apareceu em vazamentos públicos. Escolha outra senha.";
  if (m.includes("invalid email") || m.includes("email_address_invalid"))
    return "Email inválido. Use o formato seu@email.com.";
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("over_email_send_rate_limit"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (m.includes("token has expired") || m.includes("otp_expired") || m.includes("expired"))
    return "O link expirou. Solicite um novo link.";
  if (m.includes("same password") || m.includes("should be different"))
    return "A nova senha precisa ser diferente da anterior.";
  if (m.includes("signups not allowed") || m.includes("signup_disabled"))
    return "Cadastro de novas contas está desativado no momento.";
  if (m.includes("user not found"))
    return "Não encontramos uma conta com este email.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Verifique sua internet e tente novamente.";

  return message ?? "Ocorreu um erro inesperado. Tente novamente.";
}
