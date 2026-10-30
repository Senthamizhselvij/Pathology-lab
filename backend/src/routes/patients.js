import { Router } from 'express';
import { q } from '../db.js';
import { asyncHandler, HttpError, str, toId } from '../utils/http.js';
import { auditLog } from '../utils/audit.js';
import { isValidYmd, todayYmd } from '../utils/dates.js';
import { getPatientById } from '../utils/helpers.js';

const router = Router();

/** Builds the WHERE fragments shared by the dashboard and the records list. */
function searchConditions(query) {
  const conditions = [];
  const params = [];
  const add = (column, value) => {
    const v = str(value);
    if (v !== '') {
      conditions.push(`${column} LIKE ?`);
      params.push(`%${v}%`);
    }
  };
  add('receipt_id', query.receipt_id);
  add('patient_code', query.patient_id);
  add('patient_name', query.patient_name);
  add('phone', query.phone);
  return { conditions, params, hasSearch: conditions.length > 0 };
}

/** GET /api/patients/dashboard - 25 most recent patients (or matches) + summary counts. */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const { conditions, params, hasSearch } = searchConditions(req.query);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const patients = await q(
      `SELECT id, receipt_id, patient_date, patient_name, patient_code, age, gender, phone, address
         FROM patients ${where} ORDER BY id DESC LIMIT 25`,
      params
    );
    const [[p], [done], [pending]] = await Promise.all([
      q('SELECT COUNT(*) AS c FROM patients'),
      q("SELECT COUNT(*) AS c FROM patient_tests WHERE status='COMPLETED'"),
      q("SELECT COUNT(*) AS c FROM patient_tests WHERE status='PENDING'"),
    ]);
    res.json({
      patients,
      hasSearch,
      counts: { patients: Number(p.c), tests: Number(done.c), pending: Number(pending.c) },
    });
  })
);

/** GET /api/patients - all ACTIVE (non-cancelled) patient records, optional search. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { conditions, params, hasSearch } = searchConditions(req.query);
    const where = ['report_status = \'ACTIVE\'', ...conditions].join(' AND ');
    const patients = await q(`SELECT * FROM patients WHERE ${where} ORDER BY id DESC`, params);
    res.json({ patients, hasSearch });
  })
);

/** POST /api/patients - register a new patient. */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const receipt_id = str(b.receipt_id).toUpperCase() || null;
    const patient_date = str(b.patient_date) || todayYmd();
    const patient_name = str(b.patient_name);
    const patient_code = str(b.patient_code) || null;
    const age = str(b.age);
    let gender = str(b.gender) || 'Male';
    const phone = str(b.phone);
    const address = str(b.address);
    const errors = [];

    if (patient_code !== null && [...patient_code].length > 255) {
      errors.push('Patient ID can contain any characters up to 255 characters.');
    }
    // Receipt ID is optional; validate the format only when supplied.
    if (receipt_id !== null && (receipt_id.length > 100 || !/^[A-Z0-9]+$/.test(receipt_id))) {
      errors.push('Receipt ID can contain letters and numbers only.');
    }
    if (patient_name === '') errors.push('Please enter the patient name.');
    if (age === '' || !/^\d+(?:\.\d{1,1})?$/.test(age) || Number(age) < 1 || Number(age) > 120) {
      errors.push('Please enter a valid age between 1 and 120.');
    }
    if (!['Male', 'Female', 'Other'].includes(gender)) gender = 'Male';

    const cleanPhone = phone.replace(/[\s\-()+]/g, '');
    if (phone === '' || !/^[0-9]{10,15}$/.test(cleanPhone)) {
      errors.push('Please enter a valid phone number (10 to 15 digits).');
    }

    if (!isValidYmd(patient_date)) errors.push('Please select a valid registration date.');
    else if (patient_date > todayYmd()) errors.push('Registration date cannot be in the future.');

    if (errors.length) throw new HttpError(400, errors.join(' '));

    // Duplicate Receipt IDs / Patient IDs / names / phones are all allowed:
    // every submission creates a new patients.id.
    const result = await q(
      `INSERT INTO patients (receipt_id, patient_date, patient_name, patient_code, age, gender, phone, address, test_count, total_amount, submitted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0.00, 0)`,
      [receipt_id, patient_date, patient_name, patient_code, Number(age), gender, cleanPhone, address]
    );
    const id = result.insertId;
    await auditLog(req, 'CREATE PATIENT', `Patient DB ID ${id}, Patient ID ${patient_code ?? ''}, Receipt ID ${receipt_id ?? ''}`);
    res.status(201).json({ id });
  })
);

/** Loads :id into req.patient or answers 404. */
async function loadPatient(req, _res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) throw new HttpError(400, 'Invalid patient record.');
    const patient = await getPatientById(id);
    if (!patient) throw new HttpError(404, 'Patient record not found.');
    req.patient = patient;
    next();
  } catch (err) {
    next(err);
  }
}

router.get('/:id', loadPatient, (req, res) => res.json({ patient: req.patient }));

/** PUT /api/patients/:id - update Receipt ID, Patient ID and registration date. */
router.put(
  '/:id',
  loadPatient,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const receipt_id = str(b.receipt_id).toUpperCase();
    const patient_code = str(b.patient_code);
    const patient_date = str(b.patient_date);
    const errors = [];

    if (receipt_id !== '' && (receipt_id.length > 100 || !/^[A-Z0-9]+$/.test(receipt_id))) {
      errors.push('Receipt ID can contain letters and numbers only (maximum 100 characters).');
    }
    if ([...patient_code].length > 255) errors.push('Patient ID can contain up to 255 characters.');
    if (!isValidYmd(patient_date)) errors.push('Please select a valid registration date.');
    else if (patient_date > todayYmd()) errors.push('Registration date cannot be in the future.');
    if (errors.length) throw new HttpError(400, errors.join(' '));

    const id = req.patient.id;
    await q('UPDATE patients SET receipt_id = ?, patient_code = ?, patient_date = ? WHERE id = ?', [
      receipt_id === '' ? null : receipt_id,
      patient_code === '' ? null : patient_code,
      patient_date,
      id,
    ]);
    await auditLog(req, 'UPDATE PATIENT IDENTIFIERS', `Patient DB ID ${id}, Receipt ID ${receipt_id}, Patient ID ${patient_code}, Registration Date ${patient_date}`);
    res.json({ ok: true });
  })
);

/** PUT /api/patients/:id/report-date */
router.put(
  '/:id/report-date',
  loadPatient,
  asyncHandler(async (req, res) => {
    const date = str(req.body?.report_date);
    if (!isValidYmd(date)) throw new HttpError(400, 'Please choose a valid report date.');
    await q('UPDATE patients SET report_date = ? WHERE id = ?', [date, req.patient.id]);
    res.json({ ok: true });
  })
);

/** PUT /api/patients/:id/referred-by  (empty string removes it) */
router.put(
  '/:id/referred-by',
  loadPatient,
  asyncHandler(async (req, res) => {
    let value = str(req.body?.referred_by);
    if ([...value].length > 150) value = [...value].slice(0, 150).join('');
    await q('UPDATE patients SET referred_by = ? WHERE id = ?', [value !== '' ? value : null, req.patient.id]);
    res.json({ ok: true, removed: value === '' });
  })
);

/** POST /api/patients/:id/submit - finalise the report. */
router.post(
  '/:id/submit',
  loadPatient,
  asyncHandler(async (req, res) => {
    const patient = req.patient;
    if (Number(patient.submitted) === 1) {
      throw new HttpError(409, 'Patient has already been submitted.', { code: 'ALREADY_SUBMITTED' });
    }
    if (patient.report_status === 'CANCELLED') {
      throw new HttpError(409, 'This report has been cancelled.');
    }

    const tests = await q(
      `SELECT pt.id, pt.status, t.price FROM patient_tests pt JOIN tests t ON pt.test_id = t.id WHERE pt.patient_id = ?`,
      [patient.id]
    );
    if (!tests.length) throw new HttpError(400, 'Cannot submit patient: At least one test must be added.');

    let pending = 0;
    let completed = 0;
    let total = 0;
    for (const t of tests) {
      if (t.status !== 'COMPLETED') pending++;
      else {
        completed++;
        total += Number(t.price);
      }
    }
    if (pending > 0) throw new HttpError(400, 'Please complete all selected tests before submitting.');

    // A report date chosen by the user is kept; otherwise today's date is used.
    await q(
      'UPDATE patients SET submitted = 1, report_date = COALESCE(report_date, ?), test_count = ?, total_amount = ? WHERE id = ?',
      [todayYmd(), completed, total, patient.id]
    );
    await auditLog(req, 'SUBMIT PATIENT REPORT', `Patient ID ${patient.id}`);
    res.json({ ok: true });
  })
);

/** POST /api/patients/:id/cancel-report - cancel a patient report (reason required; results may still be pending). */
router.post(
  '/:id/cancel-report',
  loadPatient,
  asyncHandler(async (req, res) => {
    let reason = str(req.body?.cancel_reason);
    if (reason === '') throw new HttpError(400, 'Please enter the reason for cancelling the report.');
    if (reason.length > 255) reason = reason.slice(0, 255);

    const cancelledBy = `${req.user.username} (${req.user.role})`;
    const result = await q(
      `UPDATE patients SET report_status='CANCELLED', cancelled_at=NOW(), cancelled_by=?, cancel_reason=?
        WHERE id=? AND report_status='ACTIVE'`,
      [cancelledBy, reason, req.patient.id]
    );
    if (result.affectedRows === 0) {
      throw new HttpError(409, 'Report could not be cancelled. It may already be cancelled.');
    }
    await auditLog(req, 'CANCEL REPORT', `Patient ID ${req.patient.id}, Cancelled by: ${cancelledBy}, Reason: ${reason}`);
    res.json({ ok: true });
  })
);

/** GET /api/patients/:id/tests - tests ordered for this patient. */
router.get(
  '/:id/tests',
  loadPatient,
  asyncHandler(async (req, res) => {
    const tests = await q(
      `SELECT pt.id AS patient_test_id, pt.test_id, pt.status, pt.completed_at, pt.result_date,
              t.test_name, t.price
         FROM patient_tests pt JOIN tests t ON pt.test_id = t.id
        WHERE pt.patient_id = ? ORDER BY pt.id ASC`,
      [req.patient.id]
    );
    res.json({ patient: req.patient, tests });
  })
);

/** PUT /api/patients/:id/test-budget - set a one-time, immutable test budget before adding tests. */
router.put('/:id/test-budget', loadPatient, asyncHandler(async (req, res) => {
  const patient = req.patient;
  if (Number(patient.submitted) === 1 || patient.report_status === 'CANCELLED') throw new HttpError(409, 'The test budget cannot be set after report submission or cancellation.');
  if (patient.test_budget != null) throw new HttpError(409, 'The test budget is already locked and cannot be changed.');
  const amount = Number(req.body?.test_budget);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) throw new HttpError(400, 'Enter a valid test budget greater than ₹0.');
  const [existing] = await q('SELECT COUNT(*) AS c FROM patient_tests WHERE patient_id = ?', [patient.id]);
  if (Number(existing.c) > 0) throw new HttpError(409, 'Set the test budget before adding any tests.');
  await q('UPDATE patients SET test_budget = ? WHERE id = ? AND test_budget IS NULL', [amount, patient.id]);
  await auditLog(req, 'LOCK TEST BUDGET', `Patient ID ${patient.id}, Budget: ${amount}`);
  res.json({ ok: true, test_budget: amount });
}));

/** GET /api/patients/:id/available-tests?search= - catalog + what is already added. */
router.get(
  '/:id/available-tests',
  loadPatient,
  asyncHandler(async (req, res) => {
    const search = str(req.query.search);
    const hidden = "('Blood Sugar (Fasting / PP)','HIV / HCV / HBsAg / VDRL','Blood Sugar','Malaria','Thyroid')";
    const tests = search
      ? await q(`SELECT * FROM tests WHERE test_name NOT IN ${hidden} AND test_name LIKE ? ORDER BY test_name ASC`, [`%${search}%`])
      : await q(`SELECT * FROM tests WHERE test_name NOT IN ${hidden} ORDER BY id ASC`);
    const assignedRows = await q(`SELECT pt.id, pt.test_id, pt.status, t.price FROM patient_tests pt JOIN tests t ON t.id = pt.test_id WHERE pt.patient_id = ?`, [req.patient.id]);
    const assigned = {};
    let usedAmount = 0;
    for (const r of assignedRows) {
      assigned[r.test_id] = { patient_test_id: r.id, status: r.status };
      usedAmount += Number(r.price || 0);
    }
    const budget = req.patient.test_budget == null ? null : Number(req.patient.test_budget);
    const remainingBudget = budget == null ? null : Math.max(0, Number((budget - usedAmount).toFixed(2)));
    res.json({ patient: req.patient, tests, assigned, usedAmount, remainingBudget });
  })
);

/** POST /api/patients/:id/tests {test_id} - add a test (result can be entered later). */
router.post(
  '/:id/tests',
  loadPatient,
  asyncHandler(async (req, res) => {
    const testId = toId(req.body?.test_id);
    if (!testId) throw new HttpError(400, 'Invalid patient or test.');
    if (Number(req.patient.submitted) === 1 || req.patient.report_status === 'CANCELLED') {
      throw new HttpError(409, 'Tests cannot be added after the final report is generated.');
    }

    const [test] = await q('SELECT * FROM tests WHERE id = ?', [testId]);
    if (!test) throw new HttpError(404, 'Test not found.');

    const [existing] = await q('SELECT id FROM patient_tests WHERE patient_id = ? AND test_id = ?', [req.patient.id, testId]);
    if (existing) return res.json({ id: existing.id, alreadyAdded: true });

    if (req.patient.test_budget == null) throw new HttpError(409, 'Enter and lock the test budget before adding tests.');
    const [spent] = await q('SELECT COALESCE(SUM(t.price),0) AS amount FROM patient_tests pt JOIN tests t ON t.id = pt.test_id WHERE pt.patient_id = ?', [req.patient.id]);
    const remaining = Number(req.patient.test_budget) - Number(spent.amount || 0);
    if (Number(test.price) > remaining + 0.0001) {
      throw new HttpError(400, `This test costs ₹${Number(test.price).toFixed(2)} but only ₹${Math.max(0, remaining).toFixed(2)} remains in the locked budget.`);
    }

    const result = await q("INSERT INTO patient_tests (patient_id, test_id, status) VALUES (?, ?, 'PENDING')", [req.patient.id, testId]);
    await auditLog(req, 'ADD TEST', `Patient ID ${req.patient.id}, Test: ${test.test_name}`);
    res.status(201).json({ id: result.insertId });
  })
);

export default router;
