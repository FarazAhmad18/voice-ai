/**
 * Input sanitization utilities to prevent XSS and injection attacks.
 */

/**
 * Strip all HTML tags from a string.
 * @param {string} str
 * @returns {string}
 */
function stripHtml(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * Sanitize user-input text: strip HTML tags, control characters, and enforce max length.
 * @param {string} str - Input string
 * @param {number} maxLength - Maximum allowed length (default 500)
 * @returns {string}
 */
function sanitizeText(str, maxLength = 500) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Dangerous prompt injection patterns to strip from user-controlled knowledge data.
 * Matches the patterns used in promptRenderer.js escapeForPrompt.
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /ignore\s+(all\s+)?above\s+instructions?/gi,
  /you\s+are\s+now\b/gi,
  /forget\s+(all\s+)?(your\s+)?instructions?/gi,
  /forget\s+(everything|all)/gi,
  /disregard\s+(all\s+)?(previous|above|your)/gi,
  /\bIMPORTANT\s*:/gi,
  /\bSYSTEM\s*:/gi,
  /\bINSTRUCTION\s*:/gi,
  /\bASSISTANT\s*:/gi,
  /\bnew\s+instructions?\s*:/gi,
  /\boverride\s*:/gi,
  /\bdo\s+not\s+follow/gi,
  /\bact\s+as\s+(if\s+)?you\s+are/gi,
  /\bpretend\s+(you\s+are|to\s+be)/gi,
  /\brole\s*play\s+as/gi,
  /```[\s\S]*?```/g,
];

/**
 * Strip known prompt injection patterns from text.
 * Used for knowledge base entries to prevent stored injection attacks.
 * @param {string} str - Input string
 * @param {number} maxLength - Maximum allowed length (default 1000)
 * @returns {string}
 */
function sanitizeForPrompt(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') return str;

  let sanitized = str;

  // Strip HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Strip control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Strip dangerous injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Collapse multiple spaces
  sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();

  // Enforce length limit
  return sanitized.slice(0, maxLength);
}

module.exports = { stripHtml, sanitizeText, sanitizeForPrompt };
