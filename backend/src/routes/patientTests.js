import { Router } from 'express';
import { q, withTransaction } from '../db.js';
import { asyncHandler, HttpError, str, toId } from '../utils/http.js';
import { auditLog } from '../utils/audit.js';
import { isValidYmd, todayYmd, nowTime } from '../utils/dates.js';
import { referenceRangeForGender } from '../utils/range.js';
import { CBC_ORDER_SQL, dedupeParameters, testFlags, calculateAndUpdatePatientTotals } from '../utils/helpers.js';

const router = Router();
const CBC_DIFFERENTIAL = ['Neutrophils (Poly)', 'Lymphocytes', 'Eosinophils', 'Monocytes', 'Basophils'];
const ORDER_SQL = `SELECT pt.id AS patient_test_id, pt.patient_id, pt.test_id, pt.status, pt.result_date,
        pt.mx_inoculation_date, pt.mx_reading_date, pt.sputum_grade,
        p.receipt_id, p.patient_name, p.patient_code, p.age, p.gender, p.patient_date, p.report_date,
        p.phone, p.address, p.submitted, p.report_status, t.test_name
   FROM patient_tests pt
   JOIN patients p ON pt.patient_id = p.id
   JOIN tests t ON pt.test_id = t.id
  WHERE pt.id = ?`;

/** GET /api/patient-tests/:id - everything the result-entry form needs. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    if (!id) throw new HttpError(400, 'Invalid test order reference.');
    const [order] = await q(ORDER_SQL, [id]);
    if (!order) throw new HttpError(404, 'Test record not found.');

    const raw = await q(
      `SELECT tp.id, tp.description, tp.unit, tp.reference_range,
              tr.result, tr.unit AS saved_unit, tr.reference_range AS saved_range
         FROM test_parameters tp
         JOIN tests t ON t.id = tp.test_id
         LEFT JOIN test_results tr ON tr.parameter_id = tp.id AND tr.patient_test_id = ?
        WHERE tp.test_id = ?
        ORDER BY ${CBC_ORDER_SQL}, tp.id ASC`,
      [id, order.test_id]
    );

    const flags = testFlags(order.test_name);
    const hideUnit = flags.is_urine || flags.is_hiv || flags.is_malaria || flags.is_mx || flags.is_sputum;
    const hideReference = flags.is_urine || flags.is_mx || flags.is_sputum;

    const unique = dedupeParameters(raw);
    let showUnit = false;
    const parameters = unique.map((p) => {
      const baseUnit = String(p.unit ?? '').trim();
      if (!hideUnit && baseUnit !== '' && baseUnit !== '-') showUnit = true;

      const rangeSource = (p.saved_range ?? '') !== '' ? p.saved_range : p.reference_range ?? '';
      const range = referenceRangeForGender(rangeSource, order.gender);
      const isDifferential = flags.is_cbc && CBC_DIFFERENTIAL.includes(String(p.description).trim());
      const unit = isDifferential ? '%' : (p.saved_unit ?? '') !== '' ? p.saved_unit : p.unit ?? '';
      return { id: p.id, description: p.description, result: p.result ?? '', unit, range };
    });

    res.json({ order, flags, layout: { hideUnit, hideReference, showUnit }, parameters, today: todayYmd() });
  })
);

/** PUT /api/patient-tests/:id/result - save (or update) the entered results. */
router.put(
  '/:id/result',
  asyncHandler(async (req, res) => {
    const patientTestId = toId(req.params.id);
    if (!patientTestId) throw new HttpError(400, 'Invalid test order reference.');
    const b = req.body || {};
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const results = obj(b.results);
    const changeResults = obj(b.change_results);
    const changeReasons = obj(b.change_reasons);
    const changeDates = obj(b.change_dates);
    const units = obj(b.units);
    const ranges = obj(b.ranges);
    const mxInoc = str(b.mx_inoculation_date);
    const mxRead = str(b.mx_reading_date);
    const sputumGrade = str(b.sputum_grade);

    const [order] = await q(
      `SELECT pt.*, p.id AS patient_id, p.patient_date, p.submitted, p.report_status, t.test_name
         FROM patient_tests pt JOIN patients p ON pt.patient_id = p.id JOIN tests t ON pt.test_id = t.id
        WHERE pt.id = ?`,
      [patientTestId]
    );
    if (!order) throw new HttpError(404, 'Test record not found.');
    if (order.report_status === 'CANCELLED') throw new HttpError(409, 'This report is cancelled.');

    const patientId = order.patient_id;
    const flags = testFlags(order.test_name);
    let resultDate = todayYmd();

    if (flags.is_mx) {
      if (!isValidYmd(mxInoc) || !isValidYmd(mxRead)) {
        throw new HttpError(400, 'Please enter both Date of inoculation and Date of Reading.');
      }
      if (mxRead < mxInoc) throw new HttpError(400, 'Date of Reading cannot be before Date of inoculation.');
      resultDate = mxRead; // MX has no separate report-date field; reading date is its result date
    }

    const username = req.user.username;
    let message = '';
    let entered = 0;

    await withTransaction(async (conn) => {
      const run = async (sql, params) => (await conn.query(sql, params))[0];

      const expected = dedupeParameters(
        await run('SELECT id, description, unit, reference_range FROM test_parameters WHERE test_id=? ORDER BY id ASC', [order.test_id])
      );

      // Keep the current result editable, but preserve every change in history.
      const currentRows = {};
      for (const cr of await run('SELECT parameter_id, result, unit, reference_range FROM test_results WHERE patient_test_id=?', [patientTestId])) {
        currentRows[cr.parameter_id] = cr;
      }
      await run('DELETE FROM test_results WHERE patient_test_id=?', [patientTestId]);

      const insertHistory = (paramId, oldVal, newVal, reason, entryDate) =>
        run(
          'INSERT INTO test_result_history (patient_test_id,parameter_id,old_result,new_result,reason,changed_by,changed_at) VALUES (?,?,?,?,?,?,?)',
          [patientTestId, paramId, oldVal !== '' ? oldVal : null, newVal, reason, username, `${entryDate} ${nowTime()}`]
        );

      for (const param of expected) {
        const pid = param.id;
        const val = str(results[pid]);
        const old = currentRows[pid] ? str(currentRows[pid].result) : '';
        let currentVal = old;

        // A parameter may hold at most 3 saved values: initial result + 2 later changes.
        let historyCount = Number((await run('SELECT COUNT(*) AS c FROM test_result_history WHERE patient_test_id=? AND parameter_id=?', [patientTestId, pid]))[0].c);
        // Older records with a current result but no history row count as the first entry.
        if (historyCount === 0 && old !== '') historyCount = 1;

        const extra = str(changeResults[pid]);
        const reason = str(changeReasons[pid]);
        let entryDate = str(changeDates[pid]);
        if (!isValidYmd(entryDate)) entryDate = todayYmd();

        // The top box stays editable; if it changes an existing value, the change row supplies reason + date.
        if (val !== '' && val !== old) {
          if (historyCount >= 3) throw new HttpError(400, `Maximum 3 result entries are allowed for ${param.description}.`);
          if (old !== '' && reason === '') throw new HttpError(400, `Please enter the reason for changing the existing result for ${param.description}.`);
          await insertHistory(pid, old, val, old === '' ? 'Initial result' : reason, entryDate);
          historyCount++;
          currentVal = val;
        } else if (val !== '') {
          currentVal = val;
        }

        // One visible "change" row is reused for the next change.
        if (extra !== '' && extra !== currentVal) {
          if (historyCount >= 3) throw new HttpError(400, `Maximum 3 result entries are allowed for ${param.description}.`);
          if (currentVal !== '' && reason === '') throw new HttpError(400, `Please enter the reason for changing the existing result for ${param.description}.`);
          await insertHistory(pid, currentVal, extra, reason !== '' ? reason : 'Initial result entry', entryDate);
          historyCount++;
          currentVal = extra;
        }

        if (currentVal === '') continue;
        const unit = str(units[pid]) !== '' ? str(units[pid]) : param.unit;
        const range = str(ranges[pid]) !== '' ? str(ranges[pid]) : param.reference_range;
        await run('INSERT INTO test_results (patient_test_id,parameter_id,result,unit,reference_range) VALUES (?,?,?,?,?)', [patientTestId, pid, currentVal, unit, range]);
        entered++;
      }

      if (entered > 0) {
        const completedAt = `${resultDate} 00:00:00`;
        if (flags.is_mx) {
          await run("UPDATE patient_tests SET status='COMPLETED',result_date=?,completed_at=?,mx_inoculation_date=?,mx_reading_date=? WHERE id=?", [resultDate, completedAt, mxInoc, mxRead, patientTestId]);
        } else if (flags.is_sputum) {
          await run("UPDATE patient_tests SET status='COMPLETED',result_date=?,completed_at=?,sputum_grade=? WHERE id=?", [resultDate, completedAt, sputumGrade || null, patientTestId]);
        } else {
          await run("UPDATE patient_tests SET status='COMPLETED',result_date=?,completed_at=? WHERE id=?", [resultDate, completedAt, patientTestId]);
        }
        message = 'Result saved successfully. You can edit it again later.';
      } else {
        if (flags.is_mx) {
          await run("UPDATE patient_tests SET status='PENDING',result_date=NULL,completed_at=NULL,mx_inoculation_date=?,mx_reading_date=? WHERE id=?", [mxInoc || null, mxRead || null, patientTestId]);
        } else if (flags.is_sputum) {
          await run("UPDATE patient_tests SET status='PENDING',result_date=NULL,completed_at=NULL,sputum_grade=? WHERE id=?", [sputumGrade || null, patientTestId]);
        } else {
          await run("UPDATE patient_tests SET status='PENDING',result_date=NULL,completed_at=NULL WHERE id=?", [patientTestId]);
        }
        message = 'Test saved without a result. Enter the result later.';
      }
    });

    await calculateAndUpdatePatientTotals(patientId);
    await auditLog(req, 'SAVE TEST RESULT', `Patient ID ${patientId}, Patient Test ID ${patientTestId}, Entered parameters: ${entered}`);
    res.json({ ok: true, message, patient_id: patientId, entered });
  })
);

/** DELETE /api/patient-tests/:id - remove a test that has no saved result yet. */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    if (!id) throw new HttpError(400, 'Invalid test.');
    const [row] = await q(
      `SELECT pt.patient_id, pt.status, p.submitted FROM patient_tests pt JOIN patients p ON p.id = pt.patient_id WHERE pt.id = ?`,
      [id]
    );
    if (!row) throw new HttpError(404, 'Test record not found.');
    if (Number(row.submitted) === 1) throw new HttpError(409, 'Finalized patient tests cannot be cancelled.');
    if (row.status === 'COMPLETED') throw new HttpError(409, 'A test with a saved result cannot be removed.');

    await auditLog(req, 'DELETE/CANCEL TEST', `Patient ID ${row.patient_id}, Patient Test ID ${id}`);
    await q('DELETE FROM patient_tests WHERE id = ?', [id]);
    await calculateAndUpdatePatientTotals(row.patient_id);
    res.json({ ok: true, patient_id: row.patient_id });
  })
);

export default router;
