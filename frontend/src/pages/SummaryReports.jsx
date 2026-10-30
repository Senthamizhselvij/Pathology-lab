import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useFetch, usePageTitle } from '../hooks/useFetch.js';
import { formatCurrency, formatDate } from '../utils/format.js';
import { ErrorBox, Loading } from '../components/Status.jsx';
import PatientActionIcon from '../components/PatientActionIcon.jsx';
import { useSearchParams } from 'react-router-dom';

const PRINT_CSS = `
@page { size:A4 portrait; margin:6mm; }
.print-report-header { display:block !important; text-align:center; font-size:20pt; font-weight:800; line-height:1.2; margin:0 0 7mm; padding:0 0 3mm; border-bottom:1px solid #111; color:#111 !important; }
.stat-grid { grid-template-columns:repeat(3,minmax(0,1fr)) !important; gap:5mm !important; margin-bottom:5mm !important; }
.stat-grid .stat-card { padding:3mm !important; border-radius:0 !important; background:#fff !important; border:1.5px solid #111 !important; color:#111 !important; }
.stat-grid .stat-card div, .stat-grid .stat-card strong { color:#111 !important; }
.stat-grid .stat-card strong { font-size:12pt !important; }
.portal-table th, .portal-table td { padding:2.2mm 2mm !important; font-size:9pt !important; color:#111 !important; border:1px solid #111 !important; }
.portal-table th { background:#222 !important; color:#fff !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.portal-table { table-layout:auto; }
`;

function Shell({ title, printHeader, filters, data, daily }) {
  const t = data.totals;
  return (
    <div className="portal-card">
      <style media="print">{PRINT_CSS}</style>
      <div className="print-report-header" style={{ display: 'none' }}>
        {daily && <div style={{ fontSize: '12pt', fontWeight: 600, marginTop: 4 }}>Date: {formatDate(daily)}</div>}
        <div style={daily ? { fontSize: '18pt', fontWeight: 800, marginTop: 4 } : undefined}>{printHeader}</div>
      </div>
      <div className="no-print page-head" style={{ marginBottom: 20 }}>
        <h2 className="portal-card-title">{title}</h2>
        <button type="button" className="btn btn-outline" onClick={() => window.print()}>🖨️ Print</button>
      </div>
      {filters}
      <div className="stat-grid small">
        <div className="stat-card"><div className="stat-label">Total Patients</div><strong>{t.patients}</strong></div>
        <div className="stat-card"><div className="stat-label">Total Tests</div><strong>{t.tests}</strong></div>
        <div className="stat-card"><div className="stat-label">Total Amount</div><strong className="money">{formatCurrency(t.amount)}</strong></div>
      </div>
    </div>
  );
}

function DateRangeForm({ from, to, onSubmit }) {
  const [f, setF] = useState({ from, to });
  useEffect(() => setF({ from, to }), [from, to]);
  return (
    <form className="no-print filter-row" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <div><label className="form-label">From Date</label><input type="date" className="form-control" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
      <div><label className="form-label">To Date</label><input type="date" className="form-control" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
      <button className="btn btn-primary" type="submit">Search</button>
    </form>
  );
}

function SimpleTable({ rows, empty }) {
  return (
    <div className="table-responsive">
      <table className="portal-table table-bordered">
        <thead><tr><th>Date</th><th>Patient Name</th><th className="text-right">Total Amount</th><th className="no-print">Action</th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan="4" className="empty-cell">{empty}</td></tr> : rows.map((r) => (
            <tr key={r.id}>
              <td>{formatDate(r.patient_date)}</td>
              <td><strong>{r.patient_name}</strong></td>
              <td className="text-right"><strong>{formatCurrency(r.total_amount)}</strong></td>
              <td className="no-print"><PatientActionIcon patient={r} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RangePage({ endpoint, title, printHeader, empty }) {
  usePageTitle(title);
  const [sp, setSp] = useSearchParams();
  const { data, error } = useFetch(() => api.get(endpoint, { from: sp.get('from'), to: sp.get('to') }), [sp.toString()]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <Shell title={title} printHeader={printHeader} data={data}
        filters={<DateRangeForm from={data.from} to={data.to} onSubmit={(f) => setSp(Object.fromEntries(Object.entries(f).filter(([, v]) => v)))} />} />
      <div className="portal-card" style={{ marginTop: -10 }}><SimpleTable rows={data.rows} empty={empty} /></div>
    </>
  );
}

export const WeeklyReport = () => <RangePage endpoint="/reports/weekly" title="Weekly Report" printHeader="WEEKLY REPORT" empty="No active patient records found for this date range." />;
export const SummaryReport = () => <RangePage endpoint="/reports/summary" title="Summary Report" printHeader="SUMMARY REPORT" empty="No matching active patient records found." />;

export function DailyReport() {
  usePageTitle('Daily Report');
  const [sp, setSp] = useSearchParams();
  const { data, error } = useFetch(() => api.get('/reports/daily', { date: sp.get('date') }), [sp.toString()]);
  const [date, setDate] = useState('');
  useEffect(() => {
  if (data) setDate(data.date);
}, [data]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <Shell title="Daily Report" printHeader="DAILY REPORT SUMMARY" daily={data.date} data={data}
        filters={
          <form className="no-print filter-row" onSubmit={(e) => { e.preventDefault(); setSp(date ? { date } : {}); }}>
            <div><label className="form-label">Date</label><input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <button className="btn btn-primary" type="submit">Search</button>
          </form>
        } />
      <div className="portal-card" style={{ marginTop: -10 }}>
        <div className="table-responsive">
          <table className="portal-table table-bordered">
            <thead><tr><th>Registration Date</th><th>Patient Name</th><th className="text-center">Result Status</th><th className="text-right">Total Amount</th><th className="no-print">Action</th></tr></thead>
            <tbody>
              {data.rows.length === 0 ? <tr><td colSpan="5" className="empty-cell">No patient records found for this date.</td></tr> : data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.patient_date)}</td>
                  <td><strong>{r.patient_name}</strong></td>
                  <td className="text-center" style={{ fontSize: '.82rem' }}>
                    {r.pending_tests > 0 && <span className="badge badge-pending">{r.pending_tests} PENDING</span>}{' '}
                    {r.completed_tests > 0 && <span className="badge badge-completed">{r.completed_tests} TEST</span>}
                    {r.test_count === 0 && <span className="muted">NO TEST</span>}
                  </td>
                  <td className="text-right"><strong>{formatCurrency(r.total_amount)}</strong></td>
                  <td className="no-print"><PatientActionIcon patient={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
