import { q } from '../db.js';

/**
 * Append a row to the audit log. Auditing must never break the main workflow,
 * so any error is swallowed.
 */
export async function auditLog(req, action, details = '') {
  try {
    const ip = String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '') || null;
    await q(
      'INSERT INTO audit_logs (user_id, username, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user?.id ?? null, req.user?.username ?? 'unknown', action, details, ip]
    );
  } catch (err) {
    console.error('[audit] could not write log:', err.message);
  }
}
