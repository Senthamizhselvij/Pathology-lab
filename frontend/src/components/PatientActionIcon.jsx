import { Link } from 'react-router-dom';
import { blank } from '../utils/format.js';

/**
 * The little document button shown in every patient list:
 *  - IDs missing         -> grey, opens "enter Receipt ID / Patient ID"
 *  - final report ready  -> green, opens the report
 *  - otherwise           -> grey, continue to test results
 */
export default function PatientActionIcon({ patient }) {
  const missingIds = blank(patient.receipt_id) || blank(patient.patient_code);
  const isComplete = !missingIds && Number(patient.submitted) === 1 && (patient.report_status || 'ACTIVE') === 'ACTIVE';
  let to;
  let title;
  if (missingIds) {
    to = `/patients/${patient.id}/edit`;
    title = 'Enter Receipt ID / Patient ID';
  } else if (isComplete) {
    to = `/patients/${patient.id}/report`;
    title = 'Completed Patient Report';
  } else {
    to = `/patients/${patient.id}/tests`;
    title = 'Continue to Test Results';
  }
  return (
    <Link to={to} title={title} aria-label={title} className={`doc-icon${isComplete ? ' done' : ''}`}>📄</Link>
  );
}
