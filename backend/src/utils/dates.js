/**
 * Date helpers. Everything uses the server's LOCAL date (not UTC) so a lab in
 * India (UTC+5:30) does not get "yesterday" in the early morning.
 */
const pad = (n) => String(n).padStart(2, '0');

export function formatYmd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayYmd = () => formatYmd(new Date());

export function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Strict YYYY-MM-DD check that also rejects impossible dates such as 2026-02-31. */
export function isValidYmd(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Monday and Sunday of the current (ISO) week, as YYYY-MM-DD. */
export function currentWeekRange() {
  const now = new Date();
  const daysSinceMonday = (now.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { from: formatYmd(monday), to: formatYmd(sunday) };
}
