import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useFetch, usePageTitle } from '../hooks/useFetch.js';
import { blank, formatDate } from '../utils/format.js';
import { ErrorBox, Loading } from '../components/Status.jsx';
import PatientActionIcon from '../components/PatientActionIcon.jsx';
import PatientSearchForm, { readSearch } from '../components/PatientSearchForm.jsx';

export default function Records() {
  usePageTitle('Patient Records');
  const [sp, setSp] = useSearchParams();
  const values = useMemo(() => readSearch(sp), [sp]);
  const { data, loading, error } = useFetch(() => api.get('/patients', values), [sp.toString()]);

  const onSearch = (form) => {
    const next = {};
    Object.entries(form).forEach(([k, v]) => v.trim() && (next[k] = v.trim()));
    setSp(next);
  };

  if (error) return <ErrorBox error={error} />;
  if (loading && !data) return <Loading />;
  const { patients, hasSearch } = data;

  return (
    <div className="portal-card">
      <div className="page-head">
        <div>
          <h2 className="portal-card-title">Patient Records</h2>
          <p className="portal-card-subtitle" style={{ marginBottom: 0 }}>Receipt ID, date, patient details and test access.</p>
        </div>
        <Link to="/patients/new" className="btn btn-primary">+ Add New Patient</Link>
      </div>

      <PatientSearchForm values={values} onSearch={onSearch} clearTo="/records" hasSearch={hasSearch} />

      <div className="table-responsive">
        <table className="portal-table table-bordered">
          <thead>
            <tr><th>Receipt ID</th><th>Date</th><th>Patient Name</th><th>Patient ID</th><th>Age</th><th>Gender</th><th>Phone</th><th>Address</th><th>Action</th></tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr><td colSpan="9" className="empty-cell">No matching patient records found.</td></tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id}>
                  <td><strong style={{ color: 'var(--primary-blue)' }}>{blank(p.receipt_id) ? '-' : p.receipt_id}</strong></td>
                  <td>{formatDate(p.patient_date)}</td>
                  <td><strong>{p.patient_name}</strong></td>
                  <td><strong>{blank(p.patient_code) ? '-' : p.patient_code}</strong></td>
                  <td>{p.age}</td>
                  <td>{p.gender}</td>
                  <td>{p.phone}</td>
                  <td>{p.address || '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><PatientActionIcon patient={p} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
