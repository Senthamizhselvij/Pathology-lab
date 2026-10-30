import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/** The four-field search used on the Dashboard and Patient Records pages. */
export default function PatientSearchForm({ values, onSearch, clearTo, hasSearch }) {
  const [form, setForm] = useState(values);
  useEffect(() => setForm(values), [values]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form
      className="no-print"
      style={{ marginBottom: 22 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(form);
      }}
    >
      <div className="filter-grid">
        <div><label className="form-label">Receipt ID</label><input className="form-control" value={form.receipt_id} onChange={set('receipt_id')} placeholder="Receipt ID" /></div>
        <div><label className="form-label">Patient ID</label><input className="form-control" value={form.patient_id} onChange={set('patient_id')} placeholder="Patient ID" /></div>
        <div><label className="form-label">Patient Name</label><input className="form-control" value={form.patient_name} onChange={set('patient_name')} placeholder="Patient Name" /></div>
        <div><label className="form-label">Phone Number</label><input className="form-control" value={form.phone} onChange={set('phone')} placeholder="Phone Number" /></div>
      </div>
      <div className="filter-actions">
        <button type="submit" className="btn btn-primary">Search</button>
        {hasSearch && <Link to={clearTo} className="btn btn-outline">Clear</Link>}
      </div>
    </form>
  );
}

export const SEARCH_KEYS = ['receipt_id', 'patient_id', 'patient_name', 'phone'];

/** Read the four search fields from a URLSearchParams. */
export function readSearch(sp) {
  return Object.fromEntries(SEARCH_KEYS.map((k) => [k, sp.get(k) || '']));
}
