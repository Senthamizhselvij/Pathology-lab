/**
 * Reference-range helpers.
 *
 * NOTE: this exact file is also used by the React client
 * (frontend/src/utils/range.js). Keep both copies identical.
 * They are direct ports of referenceRangeForGender() and
 * isResultOutOfReferenceRange() from the original PHP includes/functions.php.
 */

/**
 * Return only the patient's gender-specific reference range when a range
 * contains male/female or men/women values. Shared ranges remain unchanged.
 */
export function referenceRangeForGender(range, gender) {
  range = String(range ?? '').trim();
  if (range === '') return range;

  const g = String(gender ?? '').trim().toLowerCase();
  const wanted = ['female', 'f', 'woman', 'women'].includes(g)
    ? 'female'
    : ['male', 'm', 'man', 'men'].includes(g)
      ? 'male'
      : '';
  if (wanted === '') return range;

  const label = '(Male|Men|Female|Women)';
  const sep = '[;|,\\/\\r\\n]+';
  const re = new RegExp(
    `(?:^|${sep})\\s*${label}\\s*:?\\s*(.*?)(?=${sep}\\s*(?:${label})\\s*:?|$)`,
    'gi'
  );
  for (const match of range.matchAll(re)) {
    const lbl = match[1].toLowerCase();
    const isFemale = lbl === 'female' || lbl === 'women';
    if ((wanted === 'female' && isFemale) || (wanted === 'male' && !isFemale)) {
      return match[2].trim();
    }
  }

  // Fallback for compact formats like "Men 0-15 / Women 0-20".
  let m = range.match(/\b(Male|Men)\s*:?\s*(.*?)\s*\/\s*(Female|Women)\s*:?\s*(.*)$/i);
  if (m) return (wanted === 'male' ? m[2] : m[4]).trim();
  m = range.match(/\b(Female|Women)\s*:?\s*(.*?)\s*\/\s*(Male|Men)\s*:?\s*(.*)$/i);
  if (m) return (wanted === 'female' ? m[2] : m[4]).trim();

  return range;
}

/**
 * Is a result outside its configured reference range?
 * Returns false when the reference format cannot be interpreted safely.
 */
export function isResultOutOfReferenceRange(result, range) {
  result = String(result ?? '').trim();
  range = String(range ?? '').trim();
  if (result === '' || range === '') return false;

  const normalizedRange = range.replace(/,/g, '').replace(/[−–—]/g, '-');
  const normalizedResult = result.replace(/,/g, '');

  // Widal / titre style: result 1:160 against reference < 1:80.
  const rangeTitre = normalizedRange.match(/^\s*(<=|>=|<|>|≤|≥)?\s*1\s*:\s*(\d+)\s*$/u);
  const resultTitre = normalizedResult.match(/^\s*1\s*:\s*(\d+)\s*$/);
  if (rangeTitre && resultTitre) {
    const op = rangeTitre[1] || '';
    const limit = parseInt(rangeTitre[2], 10);
    const value = parseInt(resultTitre[1], 10);
    switch (op) {
      case '<':
      case '<=':
      case '≤':
        return value > limit;
      case '>':
        return value <= limit;
      case '>=':
      case '≥':
        return value < limit;
      default:
        return value !== limit;
    }
  }

  const numberMatch = normalizedResult.match(/[-+]?\d+(?:\.\d+)?/);

  // Numeric intervals such as 3.5 - 5.5 or 4000-11000.
  const interval = normalizedRange.match(
    /^\s*([+-]?\d+(?:\.\d+)?)\s*(?:-|\bto\b)\s*([+-]?\d+(?:\.\d+)?)\s*$/i
  );
  if (interval) {
    if (numberMatch) {
      const value = parseFloat(numberMatch[0]);
      const low = parseFloat(interval[1]);
      const high = parseFloat(interval[2]);
      return value < Math.min(low, high) || value > Math.max(low, high);
    }
    return false;
  }

  // One-sided numeric limits such as <5, <= 10, >40 or >= 1.2.
  const limitMatch = normalizedRange.match(/^\s*(<=|>=|<|>|≤|≥)\s*([+-]?\d+(?:\.\d+)?)\s*$/u);
  if (limitMatch && numberMatch) {
    const value = parseFloat(numberMatch[0]);
    const limit = parseFloat(limitMatch[2]);
    switch (limitMatch[1]) {
      case '<':
        return value >= limit;
      case '<=':
      case '≤':
        return value > limit;
      case '>':
        return value <= limit;
      case '>=':
      case '≥':
        return value < limit;
    }
  }

  // Qualitative results: flag a mismatch only when the reference is a clear
  // single expected value. Multiple alternatives are treated as valid.
  if (/\d/.test(range)) return false;
  if (/[/|,;]|\bor\b/i.test(range)) return false;
  const cleanRange = range.replace(/\s+/g, ' ').trim().toLowerCase();
  const cleanResult = result.replace(/\s+/g, ' ').trim().toLowerCase();
  if (cleanRange !== '' && /^[a-z ]+$/i.test(range) && /^[a-z ]+$/i.test(result)) {
    return cleanRange !== cleanResult;
  }
  return false;
}
