/** Display format for consumer phones in merchant agenda view (US 10-digit). */
export function formatAgendaPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  const digits = cleaned.length === 11 && cleaned.startsWith("1") ? cleaned.slice(1) : cleaned;
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
