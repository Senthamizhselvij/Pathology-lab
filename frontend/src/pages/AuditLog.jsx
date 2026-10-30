import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useFetch, usePageTitle } from '../hooks/useFetch.js';
import { ErrorBox, Loading } from '../components/Status.jsx';

export default function AuditLog() {
  usePageTitle('Activity Log - Admin');
  const [sp, setSp] = useSearchParams();
  const search = sp.get('search') || '';
  const [text, setText] = useState(search);
  useEffect(() => setText(search), [search]);
  const { data, error } = useFetch(() => api.get('/admin/audit', { search }), [search]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  return (
    <div className="portal-card">
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div><h2 className="portal-card-title">Activity Log</h2><p className="portal-card-subtitle">Shows which login performed important actions. Logs are not deleted by the application.</p></div>
        <Link to="/admin/users" className="btn btn-outline">← User Management</Link>
      </div>
      <form style={{ display: 'flex', gap: 10, marginBottom: 20 }} onSubmit={(e) => { e.preventDefault(); setSp(text.trim() ? { search: text.trim() } : {}); }}>
        <input className="form-control" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search username, action or details" />
        <button className="btn btn-primary">Search</button>
      </form>
      <div className="table-responsive">
        <table className="portal-table">
          <thead><tr><th>Date/Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {data.logs.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: 30 }}>No activity recorded yet.</td></tr>}
            {data.logs.map((l) => (
              <tr key={l.id}><td>{l.created_at}</td><td><strong>{l.username}</strong></td><td>{l.action}</td><td>{l.details || ''}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
