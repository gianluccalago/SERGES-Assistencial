// Helpers de ações rápidas de contato (§6.5): WhatsApp e e-mail.

/** Normaliza um telefone BR para dígitos com DDI 55 (formato wa.me). */
export function normalizaTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '');
  if (digits.length === 0) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export function whatsappLink(tel: string): string {
  return `https://wa.me/${normalizaTelefone(tel)}`;
}

export function mailtoLink(email: string): string {
  return `mailto:${email}`;
}

/** Compositor do Outlook web (ambiente SERGES) como alternativa ao mailto. */
export function outlookWebLink(email: string): string {
  return `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(email)}`;
}
