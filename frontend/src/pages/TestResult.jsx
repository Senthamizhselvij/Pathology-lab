import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useFlash } from '../context/FlashContext.jsx';
import { useFetch, usePageTitle } from '../hooks/useFetch.js';
import { formatDate } from '../utils/format.js';
import { isResultOutOfReferenceRange } from '../utils/range.js';
import { ErrorBox, Loading } from '../components/Status.jsx';

const urineHeading = (desc) => {
  const d = String(desc).trim().toLowerCase();
  if (['quantity', 'color', 'appearance'].includes(d)) return 'GROSS EXAMINATION';
  if (['reaction (ph)', 'proteins', 'glucose'].includes(d)) return 'CHEMICAL EXAMINATION';
  if (['rbc', 'pus cells', 'epithelial cells', 'casts', 'crystals'].includes(d)) return 'MICROSCOPIC EXAMINATION (PER HPF)';
  if (d === 'bile salts') return 'OTHERS';
  return null;
};

export default function TestResult() {
  const { ptId } = useParams();
  const navigate = useNavigate();
  const { setFlash } = useFlash();
  const { data, error } = useFetch(() => api.get(`/patient-tests/${ptId}`), [ptId]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  usePageTitle(data ? `${data.order.test_name} - Result` : 'Result');

  // Fill the form once the data arrives.
  useEffect(() => {
    if (!data) return;
    const results = {}, units = {}, ranges = {}, changeResults = {}, changeReasons = {}, changeDates = {};
    data.parameters.forEach((p) => {
      results[p.id] = p.result;
      units[p.id] = p.unit;
      ranges[p.id] = p.range;
      changeResults[p.id] = '';
      changeReasons[p.id] = '';
      changeDates[p.id] = data.today;
    });
    setForm({
      results, units, ranges, changeResults, changeReasons, changeDates,
      mx_inoculation_date: data.order.mx_inoculation_date || '',
      mx_reading_date: data.order.mx_reading_date || '',
      sputum_grade: data.order.sputum_grade || '',
    });
  }, [data]);

  if (error) return <ErrorBox error={error} />;
  if (!data || !form) return <Loading />;

  const { order, flags, layout, parameters, today } = data;
  const { hideReference, showUnit } = layout;
  const { is_mx: isMx, is_sputum: isSputum, is_urine: isUrine, is_cbc: isCbc } = flags;
  const colSpan = hideReference ? 2 : showUnit ? 4 : 3;
  const isCancelled = order.report_status === 'CANCELLED';

  const setMap = (field, id) => (e) => setForm({ ...form, [field]: { ...form[field], [id]: e.target.value } });
  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  // The range that applies to a row: the editable Reference Range box when shown, otherwise the catalog range.
  const rangeFor = (p) => (hideReference ? p.range : form.ranges[p.id]);
  const rangeClass = (value, range) =>
    `form-control range-aware-result ${isResultOutOfReferenceRange(value, range) ? 'result-out-of-range' : 'result-normal'}`;

  const title = isCbc ? 'COMPLETE BLOOD COUNT (CBC)' : isUrine ? 'URINE ROUTINE & MICROSCOPY' : isSputum ? 'SPUTUM EXAMINATION, AFB' : `${order.test_name.toUpperCase()} RESULT`;

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        results: form.results,
        change_results: form.changeResults,
        change_reasons: form.changeReasons,
        change_dates: form.changeDates,
        mx_inoculation_date: form.mx_inoculation_date,
        mx_reading_date: form.mx_reading_date,
        sputum_grade: form.sputum_grade,
      };
      if (showUnit) body.units = form.units;
      if (!hideReference) body.ranges = form.ranges;
      const res = await api.put(`/patient-tests/${ptId}/result`, body);
      setFlash('success', res.message);
      navigate(`/patients/${order.patient_id}/tests`);
    } catch (err) {
      setFlash('error', err.message);
      setBusy(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const onRemove = async () => {
    if (!window.confirm('Remove this test from the patient? This test has no saved result yet.')) return;
    try {
      await api.del(`/patient-tests/${ptId}`);
      setFlash('success', 'Test cancelled and removed. It will not appear in the patient report.');
      navigate(`/patients/${order.patient_id}/tests`);
    } catch (err) {
      setFlash('error', err.message);
    }
  };

  const subHeading = (text) => (
    <tr><td colSpan={colSpan} className="sub-heading-row" style={{ padding: '9px 10px 5px' }}>{text}</td></tr>
  );

  return (
    <div className="portal-card">
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="portal-card-title">{title}</h2>
          <p className="portal-card-subtitle" style={{ marginBottom: 0 }}>Enter the result whenever it is received. Saved results can be edited later.</p>
        </div>
        <Link to={`/patients/${order.patient_id}/tests`} className="btn btn-outline">&larr; Back to Patient Tests</Link>
      </div>

      <div className="patient-bio-grid">
        <div className="bio-item"><span className="bio-label">Receipt ID</span><span className="bio-value" style={{ color: 'var(--primary-blue)' }}>{order.receipt_id}</span></div>
        <div className="bio-item"><span className="bio-label">Patient ID</span><span className="bio-value">{order.patient_code}</span></div>
        <div className="bio-item"><span className="bio-label">Patient Name</span><span className="bio-value">{order.patient_name}</span></div>
        <div className="bio-item"><span className="bio-label">Age / Gender</span><span className="bio-value">{order.age} Yrs / {order.gender}</span></div>
      </div>

      {isCancelled && <div className="error-box">This patient's report has been cancelled, so results can no longer be changed.</div>}

      <form onSubmit={onSubmit}>
        <div style={{ margin: '22px 0 18px', padding: '16px 18px', background: '#f8fafc', border: '1px solid #dbe3ec', borderRadius: 8 }}>
          {isMx ? (
            <>
              <div style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 14 }}>TUBERCULIN TEST (0.1 ml = 10 TU)</div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label required" htmlFor="mx_inoculation_date">Date of inoculation</label>
                  <input id="mx_inoculation_date" type="date" className="form-control" value={form.mx_inoculation_date} max={today} onChange={setField('mx_inoculation_date')} required />
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="mx_reading_date">Date of Reading</label>
                  <input id="mx_reading_date" type="date" className="form-control" value={form.mx_reading_date} max={today} onChange={setField('mx_reading_date')} required />
                </div>
              </div>
              <div style={{ fontSize: '.82rem', color: '#64748b', marginTop: 6 }}>Enter both dates here. The reading date cannot be before the inoculation date.</div>
            </>
          ) : (
            <div className="form-group" style={{ maxWidth: 420 }}>
              <label className="form-label">Registration Date</label>
              <input className="form-control" value={formatDate(order.patient_date)} readOnly style={{ background: '#f1f5f9' }} />
            </div>
          )}
        </div>

        <div className="table-responsive">
          <table className="portal-table table-bordered">
            <thead>
              <tr>
                <th style={{ width: hideReference ? '68%' : '38%' }}>Test Description</th>
                <th style={{ width: hideReference ? '32%' : '18%' }}>Result Value</th>
                {isSputum ? <th style={{ width: '25%' }}>Grade</th> : showUnit && <th style={{ width: '12%' }}>Unit</th>}
                {!hideReference && <th style={{ width: showUnit ? '32%' : '42%' }}>Reference Range</th>}
              </tr>
            </thead>
            <tbody>
              {parameters.length === 0 && (
                <tr><td colSpan={colSpan} style={{ textAlign: 'center', padding: 25 }}>No parameter description configured for this test.</td></tr>
              )}
              {parameters.map((p, i) => {
                const heading = isUrine ? urineHeading(p.description) : null;
                const prevHeading = i > 0 && isUrine ? urineHeading(parameters[i - 1].description) : null;
                const showUrineHeading = heading && (i === 0 || prevHeading !== heading);
                const showCbcHeading = isCbc && p.description.trim().toLowerCase() === 'neutrophils (poly)';
                const range = rangeFor(p);
                return (
                  <FragmentRow key={p.id}>
                    {showUrineHeading && subHeading(heading)}
                    {showCbcHeading && subHeading('DIFFERENTIAL LEUCOCYTE COUNT')}
                    <tr>
                      <td className="cell-top"><strong>{p.description}</strong></td>
                      <td className="cell-top">
                        <input className={rangeClass(form.results[p.id], range)} placeholder="Enter result" value={form.results[p.id]} onChange={setMap('results', p.id)} />
                        <div style={{ marginTop: 8, border: '1px solid #dbe3ec', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,1fr) minmax(150px,1.4fr) 120px', background: '#f8fafc', fontSize: '.72rem', fontWeight: 800, color: '#475569' }}>
                            <div style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0' }}>RESULT</div>
                            <div style={{ padding: '6px 8px', borderRight: '1px solid #e2e8f0' }}>REASON</div>
                            <div style={{ padding: '6px 8px' }}>DATE</div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,1fr) minmax(150px,1.4fr) 120px', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ padding: '6px 7px', borderRight: '1px solid #e2e8f0' }}>
                              <input className={rangeClass(form.changeResults[p.id], range)} placeholder="Result" value={form.changeResults[p.id]} onChange={setMap('changeResults', p.id)} />
                            </div>
                            <div style={{ padding: '6px 7px', borderRight: '1px solid #e2e8f0' }}>
                              <input className="form-control" placeholder="Reason" value={form.changeReasons[p.id]} onChange={setMap('changeReasons', p.id)} />
                            </div>
                            <div style={{ padding: '6px 7px' }}>
                              <input type="date" className="form-control" value={form.changeDates[p.id]} onChange={setMap('changeDates', p.id)} />
                            </div>
                          </div>
                        </div>
                        <small style={{ display: 'block', marginTop: 6, color: '#64748b' }}>The result can be entered/changed up to 3 times. Earlier values remain stored in the database.</small>
                      </td>
                      {isSputum ? (
                        <td><input className="form-control" placeholder="Enter grade" value={form.sputum_grade} onChange={setField('sputum_grade')} /></td>
                      ) : (
                        !isMx && (
                          <>
                            {showUnit && <td className="cell-top"><input className="form-control" value={form.units[p.id]} onChange={setMap('units', p.id)} /></td>}
                            {!hideReference && <td className="cell-top"><input className="form-control" value={form.ranges[p.id]} onChange={setMap('ranges', p.id)} /></td>}
                          </>
                        )
                      )}
                    </tr>
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="form-actions">
          <Link to={`/patients/${order.patient_id}/tests`} className="btn btn-secondary">Back</Link>
          {!isCancelled && <button type="submit" className="btn btn-success btn-lg" disabled={busy}>{busy ? 'Processing...' : '💾 Save'}</button>}
          {order.status !== 'COMPLETED' && !isCancelled && (
            <button type="button" className="btn btn-danger btn-lg" onClick={onRemove}>🗑 Remove</button>
          )}
        </div>
      </form>
    </div>
  );
}

/** A keyed fragment so a heading row and its data row stay together inside <tbody>. */
function FragmentRow({ children }) {
  return <>{children}</>;
}
