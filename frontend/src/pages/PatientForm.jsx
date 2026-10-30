import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useFlash } from '../context/FlashContext.jsx';
import { usePageTitle } from '../hooks/useFetch.js';
import { todayYmd } from '../utils/format.js';

export default function PatientForm() {
  usePageTitle('New Patient Registration');
  const navigate = useNavigate();
  const { setFlash } = useFlash();
  const today = todayYmd();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    receipt_id: '', patient_date: today, patient_name: '', patient_code: '',
    age: '', gender: 'Male', phone: '', address: '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    // Same checks as the old client-side script (the server checks again).
    if (!f.patient_name.trim()) return setFlash('error', 'Please enter the patient full name.');
    const age = Number(f.age);
    if (!Number.isFinite(age) || age < 1 || age > 120) return setFlash('error', 'Please enter a valid age between 1 and 120.');
    if (!/^[0-9]{10,15}$/.test(f.phone.trim().replace(/[\s\-()+]/g, ''))) {
      return setFlash('error', 'Please enter a valid phone number (10 to 15 digits).');
    }
    setBusy(true);
    try {
      const { id } = await api.post('/patients', f);
      setFlash('success', 'Patient saved successfully. Add the required tests now; results can be entered later.');
      navigate(`/patients/${id}/tests`);
    } catch (err) {
      setFlash('error', err.message);
      setBusy(false);
    }
  };

  return (
    <div className="portal-card">
      <h2 className="portal-card-title">New Patient Registration</h2>
      <p className="portal-card-subtitle">Enter the patient details. Tests can be added now and results can be entered later.</p>

      <form onSubmit={onSubmit}>
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="receipt_id" className="form-label">Receipt ID</label>
            <input id="receipt_id" className="form-control" placeholder="Enter Receipt ID" pattern="[A-Za-z0-9]*" title="Letters and numbers only" autoComplete="off" value={f.receipt_id} onChange={set('receipt_id')} />
          </div>
          <div className="form-group">
            <label htmlFor="patient_date" className="form-label required">Registration Date</label>
            <input id="patient_date" type="date" className="form-control" value={f.patient_date} max={today} onChange={set('patient_date')} required />
          </div>
        </div>

        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="patient_name" className="form-label required">Patient Name</label>
            <input id="patient_name" className="form-control" placeholder="Full name" value={f.patient_name} onChange={set('patient_name')} required />
          </div>
          <div className="form-group">
            <label htmlFor="patient_code" className="form-label">Patient ID</label>
            <input id="patient_code" className="form-control" placeholder="Enter any Patient ID" maxLength={255} title="Enter any patient ID (up to 255 characters)" autoComplete="off" value={f.patient_code} onChange={set('patient_code')} />
          </div>
        </div>

        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="age" className="form-label required">Age</label>
            <input id="age" type="number" className="form-control" placeholder="Years (e.g. 4.5)" min="1" max="120" step="0.1" value={f.age} onChange={set('age')} required />
          </div>
          <div className="form-group">
            <label className="form-label required">Gender</label>
            <div className="radio-group">
              {['Male', 'Female', 'Other'].map((g) => (
                <label key={g} className="radio-label">
                  <input type="radio" name="gender" value={g} checked={f.gender === g} onChange={set('gender')} required /> {g}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="phone" className="form-label required">Phone Number</label>
            <input id="phone" type="tel" className="form-control" placeholder="Mobile number" value={f.phone} onChange={set('phone')} required />
          </div>
          <div className="form-group">
            <label htmlFor="address" className="form-label">Address</label>
            <input id="address" className="form-control" placeholder="Patient address" value={f.address} onChange={set('address')} />
          </div>
        </div>

        <div style={{ marginTop: 30, display: 'flex', justifyContent: 'flex-end', gap: 15 }}>
          <Link to="/dashboard" className="btn btn-outline">Back</Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Processing...' : <>Save Patient &amp; Add Tests &rarr;</>}
          </button>
        </div>
      </form>
    </div>
  );
}
