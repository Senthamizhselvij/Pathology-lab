import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useFlash } from '../context/FlashContext.jsx';
import { useFetch, usePageTitle } from '../hooks/useFetch.js';
import { todayYmd } from '../utils/format.js';
import { ErrorBox, Loading } from '../components/Status.jsx';

export default function EditPatient() {
  usePageTitle('Update Patient IDs');
  const { id } = useParams();
  const navigate = useNavigate();
  const { setFlash } = useFlash();
  const { data, error } = useFetch(() => api.get(`/patients/${id}`), [id]);
  const [f, setF] = useState({ receipt_id: '', patient_code: '', patient_date: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setF({ receipt_id: data.patient.receipt_id ?? '', patient_code: data.patient.patient_code ?? '', patient_date: data.patient.patient_date });
  }, [data]);

  if (error) return <ErrorBox error={error} backTo="/records" backLabel="Back to Records" />;
  if (!data) return <Loading />;
  const patient = data.patient;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/patients/${id}`, f);
      setFlash('success', 'Patient ID, Receipt ID and registration date updated successfully.');
      navigate(`/patients/${id}/select-test`);
    } catch (err) {
      setFlash('error', err.message);
      setBusy(false);
    }
  };

  return (
    <div className="portal-card">
      <h2 className="portal-card-title">Patient Details</h2>
      <p className="portal-card-subtitle">Enter or update the Receipt ID and Patient ID when available. You can add tests even if either ID is still blank.</p>
      <div style={{ marginBottom: 20, padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <strong>Patient:</strong> {patient.patient_name} &nbsp; | &nbsp; <strong>Internal record number:</strong> {patient.id}
      </div>
      <form onSubmit={onSubmit}>
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="receipt_id" className="form-label">Receipt ID (optional)</label>
            <input id="receipt_id" className="form-control" maxLength={100} pattern="[A-Za-z0-9]*" title="Letters and numbers only" placeholder="Enter when available" value={f.receipt_id} onChange={set('receipt_id')} />
          </div>
          <div className="form-group">
            <label htmlFor="patient_code" className="form-label">Patient ID (optional)</label>
            <input id="patient_code" className="form-control" maxLength={255} placeholder="Enter when available" value={f.patient_code} onChange={set('patient_code')} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="patient_date" className="form-label required">Registration Date</label>
          <input id="patient_date" type="date" className="form-control" max={todayYmd()} value={f.patient_date} onChange={set('patient_date')} required />
        </div>
        <div className="form-actions">
          <Link to={`/patients/${id}/select-test`} className="btn btn-outline">Continue to Tests Without IDs</Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>Save Details &amp; Continue to Tests</button>
        </div>
      </form>
    </div>
  );
}
