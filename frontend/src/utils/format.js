/** 'YYYY-MM-DD' (or 'YYYY-MM-DD HH:MM:SS') -> 'DD-MM-YYYY'. Plain string work: no timezone shifts. */
export function formatDate(value) {
  if (!value) return '-';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(value);
}

/** 'YYYY-MM-DD HH:MM:SS' -> 'DD-MM-YYYY HH:MM' */
export function formatDateTime(value) {
  if (!value) return '-';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}` : String(value);
}

export function formatCurrency(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Today's date as YYYY-MM-DD in the browser's local timezone. */
export function todayYmd() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const blank = (v) => v === null || v === undefined || String(v).trim() === '';
