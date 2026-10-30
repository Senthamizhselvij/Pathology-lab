import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { asyncHandler, HttpError, str, toId } from '../utils/http.js';
import { auditLog } from '../utils/audit.js';

const router = Router();
const ROLES = ['admin', 'hod', 'staff'];
const USERNAME_RE = /^[A-Za-z0-9._-]{3,50}$/;
const normRole = (r) => (ROLES.includes(r) ? r : 'staff');

/** GET /api/admin/users */
router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await q(
      "SELECT id, username, CASE WHEN role IS NULL OR role = '' THEN 'staff' ELSE role END AS role, created_at FROM admins ORDER BY id ASC"
    );
    res.json({ users });
  })
);

/** POST /api/admin/users */
router.post(
  '/users',
  asyncHandler(async (req, res) => {
    const username = str(req.body?.username);
    const password = String(req.body?.password ?? '');
    const role = normRole(req.body?.role);

    if (!USERNAME_RE.test(username)) {
      throw new HttpError(400, 'Username must be 3-50 characters and use only letters, numbers, dot, underscore or hyphen.');
    }
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');

    const exists = await q('SELECT id FROM admins WHERE username = ? LIMIT 1', [username]);
    if (exists.length) throw new HttpError(409, 'Username already exists.');

    const result = await q('INSERT INTO admins (username, password, role) VALUES (?, ?, ?)', [username, bcrypt.hashSync(password, 10), role]);
    await auditLog(req, 'CREATE USER', `Created username ${username} with role ${role.toUpperCase()} (ID ${result.insertId})`);
    res.status(201).json({ id: result.insertId });
  })
);

/** PUT /api/admin/users/:id */
router.put(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const username = str(req.body?.username);
    const role = normRole(req.body?.role);
    const newPassword = String(req.body?.new_password ?? '');

    if (!id) throw new HttpError(400, 'Invalid user.');
    if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Invalid username.');

    const [old] = await q('SELECT id, username, role FROM admins WHERE id = ?', [id]);
    if (!old) throw new HttpError(404, 'User not found.');

    if (id === req.user.id && !['admin', 'hod'].includes(role)) {
      throw new HttpError(400, 'You cannot remove your own administrative access.');
    }
    const clash = await q('SELECT id FROM admins WHERE username = ? AND id <> ? LIMIT 1', [username, id]);
    if (clash.length) throw new HttpError(409, 'Another user already has that username.');

    if (newPassword !== '') {
      if (newPassword.length < 8) throw new HttpError(400, 'New password must be at least 8 characters.');
      await q('UPDATE admins SET username = ?, role = ?, password = ? WHERE id = ?', [username, role, bcrypt.hashSync(newPassword, 10), id]);
    } else {
      await q('UPDATE admins SET username = ?, role = ? WHERE id = ?', [username, role, id]);
    }
    await auditLog(req, 'EDIT USER', `User ID ${id}: ${old.username} -> ${username}, role ${old.role} -> ${role}${newPassword !== '' ? ', password changed' : ''}`);
    res.json({ ok: true });
  })
);

/** DELETE /api/admin/users/:id */
router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    if (!id) throw new HttpError(400, 'Invalid user.');
    if (id === req.user.id) throw new HttpError(400, 'You cannot delete your own account while logged in.');

    const [user] = await q('SELECT id, username, role FROM admins WHERE id = ?', [id]);
    if (!user) throw new HttpError(404, 'User not found.');

    await q('DELETE FROM admins WHERE id = ?', [id]);
    await auditLog(req, 'DELETE USER', `Deleted username ${user.username} (ID ${id}, role ${user.role})`);
    res.json({ ok: true });
  })
);

/** GET /api/admin/audit?search= - last 500 log entries. */
router.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const search = str(req.query.search);
    const logs = search
      ? await q(
          'SELECT id, user_id, username, action, details, created_at FROM audit_logs WHERE username LIKE ? OR action LIKE ? OR details LIKE ? ORDER BY id DESC LIMIT 500',
          [`%${search}%`, `%${search}%`, `%${search}%`]
        )
      : await q('SELECT id, user_id, username, action, details, created_at FROM audit_logs ORDER BY id DESC LIMIT 500');
    res.json({ logs });
  })
);

export default router;
