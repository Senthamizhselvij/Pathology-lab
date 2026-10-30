import { q } from '../db.js';

/** Test categories used to group the printed patient report. */
export function getTestCategory(testName) {
  const name = String(testName ?? '').trim().toLowerCase();

  const serology = ['widal', 'ra factor', 'vdrl', 'blood group', 'sputum for afb', 'crp', 'pregnancy', 'malaria', 'typhidot', 'viral marker', 'hiv / hcv', 'p/s for mp'];
  if (serology.some((n) => name.includes(n))) return 'SEROLOGY & IMMUNOLOGY';

  const biochemistry = ['thyroid', 'tsh', 'blood sugar', 'hba1c', 'vitamin', 'kidney', 'urea', 'creatinine', 'calcium', 'uric acid', 'liver', 'bilirubin', 's.g.o.t', 's.g.p.t', 'protein', 'albumin', 'lipid', 'cholesterol', 'triglyceride', 'l.d.l'];
  if (biochemistry.some((n) => name.includes(n))) return 'BIOCHEMISTRY';

  return 'HEMATOLOGY';
}

export async function getPatientById(id, conn) {
  const run = conn ? async (s, p) => (await conn.query(s, p))[0] : q;
  const rows = await run('SELECT * FROM patients WHERE id = ?', [id]);
  return rows[0] || null;
}

/**
 * Recalculate the completed-test count and billing total stored on the patient row.
 * (Billing totals are for internal reports only - patient reports never show amounts.)
 */
export async function calculateAndUpdatePatientTotals(patientId, conn) {
  const run = conn ? async (s, p) => (await conn.query(s, p))[0] : q;
  const rows = await run(
    `SELECT
        pt.id AS patient_test_id,
        t.test_name,
        t.price AS test_price,
        COALESCE(SUM(CASE WHEN TRIM(COALESCE(tr.result, '')) <> '' THEN COALESCE(tp.price, 0) ELSE 0 END), 0) AS parameter_total,
        COUNT(tp.id) AS parameter_count
     FROM patient_tests pt
     JOIN tests t ON pt.test_id = t.id
     LEFT JOIN test_parameters tp ON tp.test_id = t.id
     LEFT JOIN test_results tr ON tr.patient_test_id = pt.id AND tr.parameter_id = tp.id
     WHERE pt.patient_id = ? AND pt.status = 'COMPLETED'
     GROUP BY pt.id, t.test_name, t.price`,
    [patientId]
  );

  let total = 0;
  for (const row of rows) {
    const parameterTotal = Number(row.parameter_total);
    const parameterCount = Number(row.parameter_count);
    if (String(row.test_name).trim().toLowerCase() === 'bt / ct') {
      total += Number(row.test_price); // BT / CT is one test with a flat charge
    } else if (parameterCount > 0 && parameterTotal > 0) {
      total += parameterTotal; // parameter-level prices when configured
    } else {
      total += Number(row.test_price);
    }
  }

  await run('UPDATE patients SET test_count = ?, total_amount = ? WHERE id = ?', [rows.length, total, patientId]);
  return { count: rows.length, total };
}

/** Drop duplicate parameter rows (same description, case-insensitive) and blank descriptions. */
export function dedupeParameters(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = String(row.description ?? '').trim().toLowerCase();
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** SQL fragment: keeps CBC parameters in the standard report order. */
export const CBC_ORDER_SQL = `CASE WHEN t.test_name='CBC' THEN CASE tp.description
  WHEN 'Hemoglobin' THEN 1 WHEN 'Total Leucocyte Count' THEN 2 WHEN 'Neutrophils (Poly)' THEN 3
  WHEN 'Lymphocytes' THEN 4 WHEN 'Eosinophils' THEN 5 WHEN 'Monocytes' THEN 6 WHEN 'Basophils' THEN 7
  WHEN 'Total RBC Count' THEN 8 WHEN 'PCV' THEN 9 WHEN 'MCV' THEN 10 WHEN 'MCH' THEN 11
  WHEN 'MCHC' THEN 12 WHEN 'Platelet Count' THEN 13 ELSE 99 END ELSE 0 END`;

/** Flags describing which special layout a test needs. */
export function testFlags(testName) {
  const n = String(testName ?? '').trim().toLowerCase();
  return {
    is_mx: n === 'mx test',
    is_sputum: n === 'sputum for afb',
    is_urine: n === 'urine (routine / microscopic)',
    is_cbc: n === 'cbc',
    is_hiv: n === 'hiv',
    is_malaria: n === 'malaria antigen',
  };
}
