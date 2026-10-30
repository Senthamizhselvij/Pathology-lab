import { Router } from 'express';
import { q } from '../db.js';
import { asyncHandler, str } from '../utils/http.js';
import { currentWeekRange, isValidYmd, todayYmd } from '../utils/dates.js';

const router = Router();

/** OLD = another patient with the same (normalised) Receipt ID and a lower id exists. */
const PATIENT_TYPE_SQL = `CASE WHEN EXISTS (
    SELECT 1 FROM patients pold
     WHERE p.receipt_id IS NOT NULL AND TRIM(p.receipt_id) <> ''
       AND UPPER(REPLACE(TRIM(pold.receipt_id), ' ', '')) = UPPER(REPLACE(TRIM(p.receipt_id), ' ', ''))
       AND pold.id < p.id
  ) THEN 'OLD' ELSE 'NEW' END`;

async function patientSummaryRows(whereSql, params, orderSql) {
  return q(
    `SELECT p.id, p.receipt_id, p.patient_code, p.patient_date, p.patient_name, p.age, p.gender, p.phone,
            p.submitted, p.report_status,
            ${PATIENT_TYPE_SQL} AS patient_type,
            COUNT(pt.id) AS test_count,
            COALESCE(SUM(t.price), 0.00) AS total_amount,
            COALESCE(SUM(CASE WHEN pt.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_tests,
            COALESCE(SUM(CASE WHEN pt.status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_tests
       FROM patients p
       LEFT JOIN patient_tests pt ON pt.patient_id = p.id
       LEFT JOIN tests t ON t.id = pt.test_id
      WHERE ${whereSql}
      GROUP BY p.id, p.receipt_id, p.patient_code, p.patient_date, p.patient_name, p.age, p.gender, p.phone
      ORDER BY ${orderSql}`,
    params
  );
}

function summarise(rows) {
  let newPatients = 0, oldPatients = 0, totalTests = 0, totalAmount = 0;
  const out = rows.map((r) => ({
    ...r,
    test_count: Number(r.test_count),
    total_amount: Number(r.total_amount),
    completed_tests: Number(r.completed_tests),
    pending_tests: Number(r.pending_tests),
  }));
  for (const r of out) {
    if (r.patient_type === 'NEW') newPatients++;
    else oldPatients++;
    totalTests += r.test_count;
    totalAmount += r.total_amount;
  }
  return { rows: out, totals: { patients: newPatients + oldPatients, newPatients, oldPatients, tests: totalTests, amount: totalAmount } };
}

/** GET /api/reports/daily?date=YYYY-MM-DD */
router.get(
  '/daily',
  asyncHandler(async (req, res) => {
    let date = str(req.query.date);
    if (!isValidYmd(date)) date = todayYmd();
    const rows = await patientSummaryRows("p.report_status = 'ACTIVE' AND p.patient_date = ?", [date], 'p.patient_name ASC, p.id DESC');
    res.json({ date, ...summarise(rows) });
  })
);

/** GET /api/reports/weekly?from=&to=  (defaults to this Monday - Sunday) */
router.get(
  '/weekly',
  asyncHandler(async (req, res) => {
    const def = currentWeekRange();
    let from = str(req.query.from);
    let to = str(req.query.to);
    if (!isValidYmd(from)) from = def.from;
    if (!isValidYmd(to)) to = def.to;
    if (from > to) [from, to] = [to, from];
    const rows = await patientSummaryRows("p.report_status = 'ACTIVE' AND p.patient_date BETWEEN ? AND ?", [from, to], 'p.patient_name ASC, p.id DESC');
    res.json({ from, to, ...summarise(rows) });
  })
);

/** GET /api/reports/summary?from=&to=  (no dates = every active record) */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    let from = str(req.query.from);
    let to = str(req.query.to);
    const hasDateFilter = from !== '' || to !== '';
    let where = "p.report_status = 'ACTIVE'";
    let params = [];
    if (hasDateFilter) {
      if (!isValidYmd(from)) from = '';
      if (!isValidYmd(to)) to = '';
      if (from === '' && to !== '') from = to;
      if (to === '' && from !== '') to = from;
      if (from !== '' && to !== '') {
        if (from > to) [from, to] = [to, from];
        where += ' AND p.patient_date BETWEEN ? AND ?';
        params = [from, to];
      }
    }
    const rows = await patientSummaryRows(where, params, 'p.patient_date DESC, p.patient_name ASC, p.id DESC');
    res.json({ from, to, ...summarise(rows) });
  })
);

/** GET /api/reports/cancelled?date=&patient_name=&receipt_id= */
router.get(
  '/cancelled',
  asyncHandler(async (req, res) => {
    let date = str(req.query.date);
    const name = str(req.query.patient_name);
    const receipt = str(req.query.receipt_id);
    const where = ["p.report_status='CANCELLED'"];
    const params = [];
    if (date !== '') {
      if (isValidYmd(date)) {
        where.push('DATE(p.cancelled_at)=?');
        params.push(date);
      } else date = '';
    }
    if (name !== '') { where.push('p.patient_name LIKE ?'); params.push(`%${name}%`); }
    if (receipt !== '') { where.push('p.receipt_id LIKE ?'); params.push(`%${receipt}%`); }

    const rows = await q(
      `SELECT p.id, p.receipt_id, p.patient_date, p.report_date, p.patient_name, p.age, p.gender, p.phone,
              p.test_count, p.total_amount, p.cancelled_at, p.cancelled_by, p.cancel_reason
         FROM patients p WHERE ${where.join(' AND ')}
        ORDER BY p.cancelled_at DESC, p.id DESC`,
      params
    );
    res.json({ rows });
  })
);

export default router;
