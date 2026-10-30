import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useFlash } from '../context/FlashContext.jsx';
import { useFetch, usePageTitle } from '../hooks/useFetch.js';
import { formatDate } from '../utils/format.js';
import { REPORT_CSS } from '../utils/reportStyles.js';
import { ErrorBox, Loading } from '../components/Status.jsx';

/* ---------- print layout settings (saved in this browser, like the original) ---------- */
const LAYOUT_KEY = 'pathologyPatientPrintLayoutV1';
const LAYOUT_DEFAULTS = { paper: 'A4', orientation: 'portrait', scale: 90, margins: 'small', font: 'normal', spacing: 'compact' };

function loadLayout() {
  try {
    return { ...LAYOUT_DEFAULTS, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}') };
  } catch {
    return { ...LAYOUT_DEFAULTS };
  }
}

function layoutCss(s) {
  const margin = { small: '8mm 6mm 12mm 6mm', normal: '10mm 10mm 14mm 10mm', large: '12mm 15mm 16mm 15mm' }[s.margins] || '8mm 6mm 12mm 6mm';
  const font = { small: '7.5pt', normal: '9pt', large: '10.5pt' }[s.font] || '9pt';
  const gap = { compact: '6px', normal: '12px', wide: '20px' }[s.spacing] || '6px';
  return `@media print{@page{size:${s.paper} ${s.orientation};margin:${margin}}.pathology-report{font-size:${font}!important}.pathology-report .test-block{margin-bottom:${gap}!important}.pathology-report table td,.pathology-report table th{font-size:${font}!important}}`;
}

function PrintLayoutEditor({ open, onClose, onSaved }) {
  const [s, setS] = useState(loadLayout());
  useEffect(() => {
    if (open) setS(loadLayout());
  }, [open]);
  if (!open) return null;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });

  const save = () => {
    const clean = { ...s, scale: Math.max(50, Math.min(100, Number(s.scale) || 90)) };
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(clean));
    onSaved(clean);
    onClose();
    window.alert('Print layout settings saved for future patient reports in this browser. Use the browser print dialog for overall print scale.');
  };
  const reset = () => {
    localStorage.removeItem(LAYOUT_KEY);
    setS({ ...LAYOUT_DEFAULTS });
    onSaved({ ...LAYOUT_DEFAULTS });
  };

  return (
    <div className="modal-backdrop no-print">
      <div className="modal-box" style={{ width: 'min(720px,100%)' }}>
        <h2 style={{ margin: '0 0 6px' }}>Edit Print Layout</h2>
        <p style={{ margin: '0 0 18px', color: '#475569' }}>These settings are saved in this browser and reused for future patient reports.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
          <label>Paper size
            <select className="form-control" value={s.paper} onChange={set('paper')}><option value="A4">A4</option><option value="A5">A5</option><option value="Letter">Letter</option></select>
          </label>
          <label>Orientation
            <select className="form-control" value={s.orientation} onChange={set('orientation')}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select>
          </label>
          <label>Print scale (%)
            <input className="form-control" type="number" min="50" max="100" step="5" value={s.scale} onChange={set('scale')} />
          </label>
          <label>Margins
            <select className="form-control" value={s.margins} onChange={set('margins')}><option value="small">Small</option><option value="normal">Normal</option><option value="large">Large</option></select>
          </label>
          <label>Font size
            <select className="form-control" value={s.font} onChange={set('font')}><option value="small">Small</option><option value="normal">Normal</option><option value="large">Large</option></select>
          </label>
          <label>Test spacing
            <select className="form-control" value={s.spacing} onChange={set('spacing')}><option value="compact">Compact</option><option value="normal">Normal</option><option value="wide">Wide</option></select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 22 }}>
          <button type="button" className="btn btn-outline" onClick={reset}>Reset defaults</button>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save}>Save for all reports</button>
        </div>
      </div>
    </div>
  );
}

function CancelReportModal({ open, onClose, patientId }) {
  const navigate = useNavigate();
  const { setFlash } = useFlash();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to cancel this final report?')) return;
    setBusy(true);
    try {
      await api.post(`/patients/${patientId}/cancel-report`, { cancel_reason: reason });
      setFlash('success', 'Patient report has been cancelled successfully.');
      navigate('/reports/cancelled');
    } catch (err) {
      setFlash('error', err.message);
      setBusy(false);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop no-print">
      <div className="modal-box">
        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#991b1b', marginBottom: 6 }}>Cancel Final Report</div>
        <div style={{ fontSize: '.88rem', color: '#64748b', marginBottom: 16 }}>
          The report will be cancelled and you will be taken directly to the Cancel Report list. The cancellation reason is required.
        </div>
        <form onSubmit={submit}>
          <label htmlFor="cancel_reason" className="form-label required">Reason for Cancellation</label>
          <textarea id="cancel_reason" className="form-control" rows="4" maxLength={255} required autoFocus
            placeholder="Enter why this report is being cancelled..." value={reason} onChange={(e) => setReason(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 15 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Back</button>
            <button type="submit" className="btn btn-danger" disabled={busy}>Cancel Report</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- result tables ---------- */
const boldIf = (p) => (p.result_out_of_range ? '800' : '400');
const DIFFERENTIAL = ['Neutrophils (Poly)', 'Lymphocytes', 'Eosinophils', 'Monocytes', 'Basophils'];
const urineHeading = (desc) => {
  const d = String(desc).trim().toLowerCase();
  if (['quantity', 'color', 'appearance'].includes(d)) return 'GROSS EXAMINATION';
  if (['reaction (ph)', 'proteins', 'glucose'].includes(d)) return 'CHEMICAL EXAMINATION';
  if (['rbc', 'pus cells', 'epithelial cells', 'casts', 'crystals'].includes(d)) return 'MICROSCOPIC EXAMINATION (PER HPF)';
  if (d === 'bile salts') return 'OTHERS';
  return null;
};

function TestBlock({ test }) {
  const tableStyle = { border: '2px solid #1f2937', marginBottom: 20 };
  const valueCell = (p) => <td style={{ fontWeight: boldIf(p), color: '#111827' }}>{p.result}</td>;

  return (
    <div className="test-block">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderBottom: 0, fontWeight: 800 }}>
        <span>{test.is_cbc ? 'COMPLETE BLOOD COUNT (CBC)' : test.test_name.toUpperCase()}</span>
      </div>

      {test.is_mx ? (
        <>
          <div style={{ border: '1px solid #cbd5e1', borderBottom: 0, padding: '12px 16px', background: '#fff', fontSize: '.92rem' }}>
            <div><strong>Date of inoculation:</strong> {test.mx_inoculation_date ? formatDate(test.mx_inoculation_date) : ''}</div>
            <div style={{ marginTop: 6 }}><strong>Date of Reading:</strong> {test.mx_reading_date ? formatDate(test.mx_reading_date) : ''}</div>
          </div>
          <table className="portal-table pathology-result-table" style={tableStyle}>
            <thead><tr><th style={{ width: '55%' }}>TEST DESCRIPTION</th><th style={{ width: '45%' }}>RESULT</th></tr></thead>
            <tbody>{test.parameters.map((p) => <tr key={p.parameter_id}><td>{p.description}</td>{valueCell(p)}</tr>)}</tbody>
          </table>
        </>
      ) : test.is_sputum ? (
        <>
          <table className="portal-table pathology-result-table" style={{ ...tableStyle, marginBottom: 8 }}>
            <thead><tr><th style={{ width: '45%' }}>TEST DESCRIPTION</th><th style={{ width: '30%' }}>RESULT</th><th style={{ width: '25%' }}>GRADE</th></tr></thead>
            <tbody>
              {test.parameters.map((p) => (
                <tr key={p.parameter_id}><td>{p.description}</td>{valueCell(p)}<td style={{ fontWeight: 700 }}>{test.sputum_grade || ''}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '.82rem', color: '#475569', margin: '0 0 20px 4px' }}><strong>NOTE:</strong> Result is dependent on the quality of specimen submitted.</div>
        </>
      ) : (
        <table className="portal-table pathology-result-table" style={tableStyle}>
          <thead>
            <tr>
              <th style={{ width: test.hide_reference ? '70%' : test.show_unit ? '38%' : '40%' }}>TEST DESCRIPTION</th>
              <th style={{ width: test.hide_reference ? '30%' : '18%' }}>RESULT</th>
              {test.show_unit && <th style={{ width: '12%' }}>UNIT</th>}
              {!test.hide_reference && <th style={{ width: test.show_unit ? '38%' : '42%' }}>REFERENCE RANGE</th>}
            </tr>
          </thead>
          <tbody>
            {test.parameters.map((p, i) => {
              const heading = test.is_urine ? urineHeading(p.description) : null;
              const prev = i > 0 && test.is_urine ? urineHeading(test.parameters[i - 1].description) : null;
              const showHeading = heading && prev !== heading;
              const showDlc = test.is_cbc && p.description.trim().toLowerCase() === 'neutrophils (poly)';
              const unit = test.is_cbc && DIFFERENTIAL.includes(p.description.trim()) ? '%' : p.unit;
              return (
                <Fragment key={p.parameter_id}>
                  {showHeading && <tr><td colSpan="2" className="sub-heading-row">{heading}</td></tr>}
                  {showDlc && <tr><td colSpan={test.show_unit ? 4 : 3} className="sub-heading-row">DIFFERENTIAL LEUCOCYTE COUNT</td></tr>}
                  <tr>
                    <td>{p.description}</td>
                    {valueCell(p)}
                    {test.show_unit && <td>{unit}</td>}
                    {!test.hide_reference && <td>{p.reference_range}</td>}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------- the page ---------- */
export default function Report() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setFlash } = useFlash();
  const { data, error, reload } = useFetch(() => api.get(`/patients/${id}/report`), [id]);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [layout, setLayout] = useState(loadLayout());
  const [referredBy, setReferredBy] = useState('');
  usePageTitle(data ? `Patient Report - ${data.patient.receipt_id ?? ''}` : 'Patient Report');

  useEffect(() => {
    if (data) setReferredBy(data.patient.referred_by || '');
  }, [data]);

  // A cancelled report is only available from the Cancel Report list.
  useEffect(() => {
    if (error?.data?.code === 'CANCELLED') {
      setFlash('info', error.message);
      navigate('/reports/cancelled', { replace: true });
    }
  }, [error, navigate, setFlash]);

  if (error) return error.data?.code === 'CANCELLED' ? <Loading /> : <ErrorBox error={error} backTo="/records" backLabel="Back to Records" />;
  if (!data) return <Loading />;

  const { patient, ordered_count: orderedCount, tests_without_results: pendingTests, groups } = data;
  const isFinal = Number(patient.submitted) === 1 && (patient.report_status || 'ACTIVE') === 'ACTIVE';

  const saveReferred = async (remove) => {
    if (remove && !window.confirm('Remove Referred By for this patient?')) return;
    try {
      await api.put(`/patients/${id}/referred-by`, { referred_by: remove ? '' : referredBy });
      setFlash('success', remove ? 'Referred By removed successfully.' : 'Referred By updated successfully.');
      reload();
    } catch (err) {
      setFlash('error', err.message);
    }
  };

  return (
    <>
      <style>{REPORT_CSS}</style>
      <style>{layoutCss(layout)}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <Link to={`/patients/${id}/tests`} className="btn btn-outline">&larr; Patient Tests</Link>{' '}
          <Link to="/records" className="btn btn-outline">All Records</Link>
        </div>
        {isFinal && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline btn-lg" onClick={() => setLayoutOpen(true)}>✏️ EDIT PRINT LAYOUT</button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => window.print()}>🖨️ PRINT REPORT</button>
            <button type="button" className="btn btn-danger btn-lg" onClick={() => setCancelOpen(true)}>✖ CANCEL REPORT</button>
          </div>
        )}
      </div>

      <PrintLayoutEditor open={layoutOpen} onClose={() => setLayoutOpen(false)} onSaved={setLayout} />
      {isFinal && <CancelReportModal open={cancelOpen} onClose={() => setCancelOpen(false)} patientId={id} />}

      <div className="portal-card pathology-report" style={{ position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,.06)', padding: '28px 30px 34px', background: '#fff' }}>
        <table className="print-layout">
          <thead>
            <tr>
              <td>
                {/* Letterhead + title live in THEAD so the browser repeats them on every printed page */}
                <div className="report-letterhead">
                  <div className="report-society">SERVANTS OF THE PEOPLE SOCIETY (DELHI BRANCH)</div>
                  <div className="report-founded">Founded by Punjab Kesari Lala Lajpat Rai in year 1921</div>
                  <div className="report-hindi">लोक सेवक मंडल</div>
                  <div className="report-clinic">Major Gen. B. N. Bhandari Charitable Medical Clinic</div>
                  <div className="report-address">Lajpat Bhawan, Lajpat Nagar IV, New Delhi 110024</div>
                  <div className="report-phone">Tel No.: +91 11-43678155</div>
                  <img src="/images/lalajinew21.png" alt="Lala Lajpat Rai" className="report-lalaji" />
                </div>
                <div className="report-title-box">PATHOLOGY TEST REPORT</div>
              </td>
            </tr>
          </thead>
          <tfoot><tr><td><div className="print-footer-spacer"></div></td></tr></tfoot>
          <tbody>
            <tr>
              <td>
                <div className="report-patient-box patient-bio-grid">
                  <div className="report-patient-line">
                    <span><strong>Name:</strong> {patient.patient_name}</span>
                    <span><strong>Receipt ID:</strong> {patient.receipt_id}</span>
                    <span><strong>Age:</strong> {patient.age} Yrs</span>
                    <span><strong>Gender:</strong> {patient.gender}</span>
                    <span className="report-address-inline"><strong>Address:</strong> {patient.address ?? ''}</span>
                    <span className="report-date-inline"><strong>Report Date:</strong> {patient.report_date ? formatDate(patient.report_date) : 'Not set'}</span>
                  </div>
                  <div className="report-patient-line report-patient-line-second">
                    <span className="report-ref-field">
                      <strong>Referred By:</strong>
                      <span className="no-print report-ref-editor">
                        <form onSubmit={(e) => { e.preventDefault(); saveReferred(false); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: 0 }}>
                          <input className="form-control" maxLength={150} placeholder="Enter referring doctor/name" value={referredBy} onChange={(e) => setReferredBy(e.target.value)}
                            style={{ width: 260, minHeight: 34, padding: '6px 9px', display: 'inline-block' }} />
                          <button type="submit" className="btn btn-sm btn-primary">Save</button>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => saveReferred(true)}>Remove</button>
                        </form>
                      </span>
                      <span className="print-only">{patient.referred_by ?? ''}</span>
                    </span>
                  </div>
                </div>

                {orderedCount === 0 && (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', border: '1px solid #e2e8f0' }}>No laboratory tests have been added.</div>
                )}

                {pendingTests.length > 0 && (
                  <div style={{ marginTop: 22 }}>
                    <div style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>TESTS ORDERED</div>
                    <div style={{ border: '1px solid #cbd5e1', padding: 16, background: '#f8fafc' }}>
                      {pendingTests.map((t) => (
                        <div key={t.patient_test_id} style={{ fontWeight: 700, padding: '8px 4px', borderBottom: '1px dashed #cbd5e1' }}>{t.test_name.toUpperCase()}</div>
                      ))}
                    </div>
                    <div style={{ fontSize: '.82rem', color: '#64748b', marginTop: 8 }}>Results are pending. The detailed test descriptions will appear automatically after results are entered.</div>
                  </div>
                )}

                {groups.map((g) => (
                  <div className="category-wrap" style={{ marginTop: 24 }} key={g.category}>
                    <div className="category-title" style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{g.category}</div>
                    {g.tests.map((t) => <TestBlock key={t.patient_test_id} test={t} />)}
                  </div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Exactly two signatures, aligned left/right on the same baseline. */}
        <div className="report-signatures">
          <div className="report-signature-block">
            <img className="technician-signature-image" src="/images/amitrawat-digital-signature.png" alt="Lab Technician signature" />
            <div className="signature-label">Lab Technician</div>
          </div>
          <div className="report-signature-block">
            <img className="technician-signature-image" src="/images/pathologist-signature.png" alt="Pathologist signature" />
            <div className="signature-label">Pathologist</div>
          </div>
        </div>
      </div>
    </>
  );
}
