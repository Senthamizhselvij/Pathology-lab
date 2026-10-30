import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { q } from '../db.js';
import { HttpError, asyncHandler } from '../utils/http.js';

export const COOKIE_NAME = 'pathlab_token';

export function signToken(user) {
  return jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction && process.env.COOKIE_SECURE === 'true',
    maxAge: config.cookieMaxAgeMs,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

/**
 * Requires a valid login cookie. The user is re-read from MySQL on every request,
 * so deleting a user or changing their role takes effect immediately.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new HttpError(401, 'Please log in.');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }
  const rows = await q('SELECT id, username, role FROM admins WHERE id = ?', [payload.id]);
  if (!rows.length) throw new HttpError(401, 'This account no longer exists.');
  req.user = { id: rows[0].id, username: rows[0].username, role: rows[0].role || 'staff' };
  next();
});

/** Admin and HOD accounts may manage users and view the activity log. */
export function requireAdminRole(req, _res, next) {
  if (!['admin', 'hod'].includes(req.user?.role)) {
    return next(new HttpError(403, 'Admin access is required for this action.'));
  }
  next();
}
