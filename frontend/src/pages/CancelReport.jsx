import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useFetch, usePageTitle } from '../hooks/useFetch.js';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format.js';
import { ErrorBox, Loading } from '../components/Status.jsx';

export default function CancelReport() {
  usePageTitle('Cancel Report');
  const [sp, setSp] = useSearchParams();
  const q = { date: sp.get('date') || '', patient_name: sp.get('patient_name') || '', receipt_id: sp.get('receipt_id') || '' };
  const { data, error } = useFetch(() => api.get('/reports/cancelled', q), [sp.toString()]);
  const [f, setF] = useState(q);
  useEffect(() => setF({ date: sp.get('date') || '', patient_name: sp.get('patient_name') || '', receipt_id: sp.get('receipt_id') || '' }), [sp]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="portal-card">
      <div className="no-print page-head" style={{ marginBottom: 20 }}>
        <div><h2 className="portal-card-title">Cancel Report</h2><p className="portal-card-subtitle">Cancelled final patient reports. Patient, tests and results are retained.</p></div>
        <button type="button" className="btn btn-outline" onClick={() => window.print()}>🖨️ Print</button>
      </div>
      <form className="no-print filter-grid" style={{ marginBottom: 22 }}
        onSubmit={(e) => { e.preventDefault(); setSp(Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim()))); }}>
        <div><label className="form-label">Cancelled Date</label><input type="date" className="form-control" value={f.date} onChange={set('date')} /></div>
        <div><label className="form-label">Patient Name</label><input className="form-control" value={f.patient_name} onChange={set('patient_name')} /></div>
        <div><label className="form-label">Receipt ID</label><input className="form-control" value={f.receipt_id} onChange={set('receipt_id')} /></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button className="btn btn-primary" type="submit">Search</button>
          <Link to="/reports/cancelled" className="btn btn-outline">Clear</Link>
        </div>
      </form>
      <div className="table-responsive">
        <table className="portal-table table-bordered">
          <thead><tr><th>Receipt ID</th><th>Registration Date</th><th>Report Date</th><th>Patient Name</th><th>Tests</th><th className="text-right">Amount</th><th>Cancelled At</th><th>Cancelled By</th><th>Reason</th><th className="no-print">Action</th></tr></thead>
          <tbody>
            {data.rows.length === 0 ? <tr><td colSpan="10" className="empty-cell">No cancelled reports found.</td></tr> : data.rows.map((r) => (
              <tr key={r.id}>
                <td><strong style={{ color: '#991b1b' }}>{r.receipt_id}</strong></td>
                <td>{formatDate(r.patient_date)}</td>
                <td>{formatDate(r.report_date)}</td>
                <td><strong>{r.patient_name}</strong></td>
                <td className="text-center">{r.test_count}</td>
                <td className="text-right">{formatCurrency(r.total_amount)}</td>
                <td>{formatDateTime(r.cancelled_at)}</td>
                <td>{r.cancelled_by || '-'}</td>
                <td>{r.cancel_reason || '-'}</td>
                <td className="no-print"><span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>CANCELLED</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
