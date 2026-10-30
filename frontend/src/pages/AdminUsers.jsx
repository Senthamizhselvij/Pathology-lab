import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFlash } from '../context/FlashContext.jsx';
import { useFetch, usePageTitle } from '../hooks/useFetch.js';
import { ErrorBox, Loading } from '../components/Status.jsx';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
function generatePassword() {
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => CHARS[n % CHARS.length]).join('');
}

export default function AdminUsers() {
  usePageTitle('User Management - Admin');
  const { user: me } = useAuth();
  const { setFlash } = useFlash();
  const { data, error, reload } = useFetch(() => api.get('/admin/users'), []);
  const [nu, setNu] = useState({ username: '', role: 'staff', password: '' });
  const [edit, setEdit] = useState(null);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  const run = async (fn, okMsg) => {
    try {
      await fn();
      setFlash('success', okMsg);
      reload();
      return true;
    } catch (err) {
      setFlash('error', err.message);
      return false;
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (await run(() => api.post('/admin/users', nu), `User ${nu.username} created successfully. Save the password you entered/generated.`)) {
      setNu({ username: '', role: 'staff', password: '' });
    }
  };
  const saveEdit = async (e) => {
    e.preventDefault();
    if (await run(() => api.put(`/admin/users/${edit.id}`, edit), 'User updated successfully.')) setEdit(null);
  };
  const del = (u) => {
    if (window.confirm('Delete this user? This cannot be undone. The deletion will remain in Activity Log.')) {
      run(() => api.del(`/admin/users/${u.id}`), 'User deleted. The deletion remains recorded in Activity Log.');
    }
  };

  return (
    <div className="portal-card">
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="portal-card-title">User Management</h2>
          <p className="portal-card-subtitle">Create staff, HOD, or admin login accounts. HOD and admin can manage users and view the activity log. Every create, edit and delete action is recorded.</p>
        </div>
        <Link to="/admin/audit" className="btn btn-outline">🧾 View Activity Log</Link>
      </div>

      <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 20, marginBottom: 25, background: '#f8fafc' }}>
        <h3 style={{ marginTop: 0 }}>Create New User</h3>
        <form onSubmit={create}>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Username</label>
              <input className="form-control" minLength={3} maxLength={50} pattern="[A-Za-z0-9._-]+" required placeholder="e.g. staff01" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label required">Role</label>
              <select className="form-control" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
                <option value="staff">Staff</option><option value="hod">HOD</option><option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label required">Password</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-control" minLength={8} required placeholder="Minimum 8 characters" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
                <button type="button" className="btn btn-outline" onClick={() => setNu({ ...nu, password: generatePassword() })}>Generate</button>
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>+ Create User</button>
            </div>
          </div>
        </form>
      </div>

      <h3>Existing Users</h3>
      <div className="table-responsive">
        <table className="portal-table">
          <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td><strong>{u.username}</strong></td>
                <td><span className="badge" style={{ background: ['admin', 'hod'].includes(u.role) ? '#dcfce7' : '#e0f2fe', color: '#0f172a' }}>{u.role.toUpperCase()}</span></td>
                <td>{u.created_at}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setEdit({ id: u.id, username: u.username, role: u.role, new_password: '' })}>Edit</button>{' '}
                  {u.id !== me.id && <button type="button" className="btn btn-sm btn-outline" style={{ color: '#b91c1c' }} onClick={() => del(u)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ width: 'min(520px,100%)' }}>
            <h3>Edit User</h3>
            <form onSubmit={saveEdit}>
              <div className="form-group"><label className="form-label">Username</label>
                <input className="form-control" required maxLength={50} pattern="[A-Za-z0-9._-]+" value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Role</label>
                <select className="form-control" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                  <option value="staff">Staff</option><option value="hod">HOD</option><option value="admin">Admin</option>
                </select></div>
              <div className="form-group"><label className="form-label">New Password (leave blank to keep current)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-control" minLength={8} value={edit.new_password} onChange={(e) => setEdit({ ...edit, new_password: e.target.value })} />
                  <button type="button" className="btn btn-outline" onClick={() => setEdit({ ...edit, new_password: generatePassword() })}>Generate</button>
                </div></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setEdit(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
