import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useFetch, usePageTitle } from '../hooks/useFetch.js';
import { formatDate } from '../utils/format.js';
import { ErrorBox, Loading } from '../components/Status.jsx';
import PatientSearchForm, { readSearch } from '../components/PatientSearchForm.jsx';

export default function Dashboard() {
  usePageTitle('Dashboard');
  const [sp, setSp] = useSearchParams();
  const values = useMemo(() => readSearch(sp), [sp]);
  const { data, loading, error } = useFetch(() => api.get('/patients/dashboard', values), [sp.toString()]);

  const onSearch = (form) => {
    const next = {};
    Object.entries(form).forEach(([k, v]) => v.trim() && (next[k] = v.trim()));
    setSp(next);
  };

  if (error) return <ErrorBox error={error} />;
  if (loading && !data) return <Loading />;
  const { patients, counts, hasSearch } = data;

  return (
    <div className="portal-card">
      <div className="page-head">
        <div>
          <h2 className="portal-card-title">Pathology Dashboard</h2>
          <p className="portal-card-subtitle" style={{ marginBottom: 0 }}>Search patients, open their tests, and enter results whenever they are received.</p>
        </div>
        <Link to="/patients/new" className="btn btn-primary">+ Add New Patient</Link>
      </div>

      <PatientSearchForm values={values} onSearch={onSearch} clearTo="/dashboard" hasSearch={hasSearch} />

      <div className="stat-grid">
        <div className="stat-card"><div className="summary-strip-title">Total Patients</div><strong>{counts.patients}</strong></div>
        <div className="stat-card"><div className="summary-strip-title">Saved Results</div><strong>{counts.tests}</strong></div>
        <div className="stat-card"><div className="summary-strip-title">Tests Waiting for Result</div><strong>{counts.pending}</strong></div>
      </div>

      <h3 className="section-title">{hasSearch ? 'Search Results' : 'Recent Patients'}</h3>
      <div className="table-responsive">
        <table className="portal-table table-bordered">
          <thead>
            <tr><th>Receipt ID</th><th>Date</th><th>Patient Name</th><th>Patient ID</th><th>Age</th><th>Gender</th><th>Phone</th><th>Address</th><th className="no-print">Action</th></tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr><td colSpan="9" className="empty-cell">No patients found.</td></tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id}>
                  <td><strong style={{ color: 'var(--primary-blue)' }}>{p.receipt_id}</strong></td>
                  <td>{formatDate(p.patient_date)}</td>
                  <td><strong>{p.patient_name}</strong></td>
                  <td><strong>{p.patient_code}</strong></td>
                  <td>{p.age}</td>
                  <td>{p.gender}</td>
                  <td>{p.phone}</td>
                  <td>{p.address || '-'}</td>
                  <td className="no-print"><Link to={`/patients/${p.id}/tests`} className="btn btn-sm btn-primary">Report</Link></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
