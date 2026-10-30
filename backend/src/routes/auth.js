import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { asyncHandler, HttpError, str } from '../utils/http.js';
import { auditLog } from '../utils/audit.js';
import { requireAuth, signToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';

const router = Router();

// Very small in-memory brute-force guard: 10 failed logins / 15 minutes per IP + username.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;

function failKey(req, username) {
  return `${req.ip}|${username.toLowerCase()}`;
}
function isLocked(key) {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return rec.count >= MAX_FAILS;
}
function recordFail(key) {
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else rec.count += 1;
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const username = str(req.body?.username);
    const password = String(req.body?.password ?? '');
    if (!username || !password) {
      throw new HttpError(400, 'Please enter both Username/Employee ID and Password.');
    }

    const key = failKey(req, username);
    if (isLocked(key)) {
      throw new HttpError(429, 'Too many failed attempts. Please wait 15 minutes and try again.');
    }

    const rows = await q('SELECT id, username, password, role FROM admins WHERE username = ?', [username]);
    const admin = rows[0];
    let ok = false;
    if (admin) {
      try {
        ok = bcrypt.compareSync(password, admin.password);
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      recordFail(key);
      throw new HttpError(401, 'Invalid username or password');
    }

    attempts.delete(key);
    const user = { id: admin.id, username: admin.username, role: admin.role || 'staff' };
    setAuthCookie(res, signToken(user));
    req.user = user;
    await auditLog(req, 'LOGIN', 'Successful login');
    res.json({ user });
  })
);

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
