/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX for US numbers).
 * Returns null if input is falsy or not a string.
 * Returns the original string if it cannot be normalized.
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+') && cleaned.length >= 11) return cleaned;
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  // Cannot normalize to valid E.164 — return null to prevent sending to invalid numbers
  return null;
}

module.exports = { normalizePhone };
