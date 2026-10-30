import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useFlash } from '../context/FlashContext.jsx';
import { useFetch, usePageTitle } from '../hooks/useFetch.js';
import { formatCurrency, formatDate } from '../utils/format.js';
import { ErrorBox, Loading } from '../components/Status.jsx';

export default function PatientTests() {
  usePageTitle('Patient Tests');
  const { id } = useParams();
  const navigate = useNavigate();
  const { setFlash } = useFlash();
  const { data, error, reload } = useFetch(() => api.get(`/patients/${id}/tests`), [id]);
  const [reportDate, setReportDate] = useState('');

  useEffect(() => {
    if (data) setReportDate(data.patient.report_date || '');
  }, [data]);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  const { patient, tests } = data;
  const completed = tests.filter((t) => t.status === 'COMPLETED').length;
  const pending = tests.length - completed;
  const totalAmount = tests.reduce((sum, t) => sum + Number(t.price), 0);
  const allCompleted = tests.length > 0 && pending === 0;
  const isSubmitted = Number(patient.submitted) === 1;
  const isCancelled = patient.report_status === 'CANCELLED';
  const saveTest = tests.find((t) => t.status !== 'COMPLETED') || tests[0];

  const cancelReport = async () => {
    const reason = window.prompt('Enter reason for cancelling this patient report:');
    if (reason === null) return;
    if (!reason.trim()) { setFlash('error', 'Please enter a cancellation reason.'); return; }
    if (!window.confirm('Cancel this patient report? Patient details, tests and results will be retained.')) return;
    try {
      await api.post(`/patients/${id}/cancel-report`, { cancel_reason: reason.trim() });
      setFlash('success', 'Patient report cancelled successfully.');
      navigate('/reports/cancelled');
    } catch (err) { setFlash('error', err.message); reload(); }
  };

  const saveReportDate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/patients/${id}/report-date`, { report_date: reportDate });
      setFlash('success', 'Report date saved successfully.');
      reload();
    } catch (err) {
      setFlash('error', err.message);
    }
  };

  const generateFinal = async () => {
    if (!window.confirm('Generate the final report for this patient?')) return;
    try {
      await api.post(`/patients/${id}/submit`);
      setFlash('success', 'Patient submitted successfully. Final report is ready for printing.');
      navigate(`/patients/${id}/report`);
    } catch (err) {
      if (err.data?.code === 'ALREADY_SUBMITTED') {
        setFlash('info', err.message);
        navigate(`/patients/${id}/report`);
      } else {
        setFlash('error', err.message);
        reload();
      }
    }
  };

  const divider = <div style={{ height: 50, width: 1, background: '#cbd5e1' }} />;

  return (
    <div className="portal-card">
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="portal-card-title">Patient Tests</h2>
          <p className="portal-card-subtitle" style={{ marginBottom: 0 }}>Add tests, enter/edit individual results, and review the amount before generating the final report.</p>
        </div>
        <div className="page-head-actions">
          <Link to="/dashboard" className="btn btn-outline">&larr; Dashboard</Link>
          <Link to="/records" className="btn btn-outline">All Records</Link>{!isCancelled && <button type="button" className="btn btn-danger" onClick={cancelReport}>Cancel Report</button>}
        </div>
      </div>

      <div className="patient-bio-grid">
        <div className="bio-item"><span className="bio-label">Receipt ID</span><span className="bio-value" style={{ color: 'var(--primary-blue)' }}>{patient.receipt_id}</span></div>
        <div className="bio-item"><span className="bio-label">Registration Date</span><span className="bio-value">{formatDate(patient.patient_date)}</span></div>
        <div className="bio-item" style={{ gridColumn: 'span 2' }}>
          <form onSubmit={saveReportDate} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', width: '100%' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="bio-label" htmlFor="report_date" style={{ display: 'block', marginBottom: 6 }}>Report Date</label>
              <input id="report_date" type="date" className="form-control" required value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">Save Report Date</button>
          </form>
        </div>
        <div className="bio-item"><span className="bio-label">Patient Name</span><span className="bio-value">{patient.patient_name}</span></div>
        <div className="bio-item"><span className="bio-label">Patient ID</span><span className="bio-value">{patient.patient_code}</span></div>
        <div className="bio-item"><span className="bio-label">Age / Gender</span><span className="bio-value">{patient.age} Yrs / {patient.gender}</span></div>
        <div className="bio-item"><span className="bio-label">Phone</span><span className="bio-value">{patient.phone}</span></div>
      </div>

      {patient.address && (
        <div style={{ margin: '0 0 20px', padding: '10px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
          <strong>Address:</strong> {patient.address}
        </div>
      )}

      {isCancelled && (
        <div className="no-print" style={{ marginBottom: 20, padding: '14px 16px', border: '1px solid #fecaca', background: '#fff7f7', borderRadius: 8 }}>
          <strong style={{ color: '#991b1b' }}>REPORT CANCELLED</strong>
          <div style={{ fontSize: '.85rem', marginTop: 4 }}>Reason: {patient.cancel_reason || '-'}</div>
        </div>
      )}

      <div className="test-summary-strip">
        <div><div className="summary-strip-title">Tests Added</div><div className="summary-strip-value count">{tests.length}</div></div>
        {divider}
        <div><div className="summary-strip-title">Results Saved</div><div className="summary-strip-value count">{completed}</div></div>
        {divider}
        <div><div className="summary-strip-title">Waiting for Result</div><div className="summary-strip-value count">{pending}</div></div>
        {divider}
        <div><div className="summary-strip-title">Total Amount</div><div className="summary-strip-value" style={{ fontSize: '1.35rem', color: 'var(--success-green)' }}>{formatCurrency(totalAmount)}</div></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '25px 0 12px' }}>
        <h3 style={{ fontSize: '1.15rem', color: '#1e293b', margin: 0 }}>Ordered Laboratory Tests</h3>
        {!isSubmitted && !isCancelled && <Link to={`/patients/${id}/select-test`} className="btn btn-primary btn-sm">+ Add Test</Link>}
      </div>

      <div className="table-responsive">
        <table className="portal-table table-bordered">
          <thead>
            <tr>
              <th style={{ width: '6%' }}>#</th>
              <th>Laboratory Test</th>
              <th style={{ width: '14%', textAlign: 'right' }}>Test Amount</th>
              <th style={{ width: '16%', textAlign: 'center' }}>Result Date</th>
              <th style={{ width: '17%', textAlign: 'center' }}>Status</th>
              <th style={{ width: '18%', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tests.length === 0 ? (
              <tr><td colSpan="6" className="empty-cell">No tests added yet. <Link to={`/patients/${id}/select-test`}>Add the first test</Link>.</td></tr>
            ) : (
              tests.map((t, i) => (
                <tr key={t.patient_test_id}>
                  <td>{i + 1}</td>
                  <td><Link to={`/test-result/${t.patient_test_id}`} className="link-strong">{t.test_name}</Link></td>
                  <td className="text-right" style={{ fontWeight: 700 }}>{formatCurrency(t.price)}</td>
                  <td className="text-center">{t.result_date ? formatDate(t.result_date) : <span className="muted">Not completed</span>}</td>
                  <td className="text-center">
                    {t.status === 'COMPLETED' ? <span className="badge badge-completed">✓ SAVED</span> : <span className="badge badge-pending">WAITING FOR RESULT</span>}
                  </td>
                  <td className="text-center">
                    {!isCancelled ? (
                      <Link to={`/test-result/${t.patient_test_id}`} className="btn btn-sm btn-outline">Edit Result</Link>
                    ) : (
                      <span className="muted">Cancelled</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {tests.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan="2" className="text-right" style={{ fontWeight: 800 }}>TOTAL AMOUNT</td>
                <td className="text-right" style={{ fontWeight: 900, color: 'var(--success-green)' }}>{formatCurrency(totalAmount)}</td>
                <td colSpan="3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="no-print" style={{ marginTop: 25, display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        {!isCancelled && tests.length > 0 && (
          <>
            <Link to={`/test-result/${saveTest.patient_test_id}`} className="btn btn-success">💾 Save</Link>
            <Link to={`/patients/${id}/report`} className="btn btn-primary">📄 Report</Link>
          </>
        )}
        {!isSubmitted && !isCancelled && allCompleted && (
          <button type="button" className="btn btn-success" onClick={generateFinal}>Generate Final Report</button>
        )}
        {(isSubmitted || isCancelled) && <Link to={`/patients/${id}/report`} className="btn btn-primary">View Patient Report</Link>}
      </div>

      {!isSubmitted && !isCancelled && !allCompleted && tests.length > 0 && (
        <div className="no-print" style={{ marginTop: 15, textAlign: 'right', color: '#64748b', fontSize: '.85rem' }}>
          Complete all added tests before generating the final report.
        </div>
      )}
    </div>
  );
}
