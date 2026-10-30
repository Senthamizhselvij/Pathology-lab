import { Router } from 'express';
import { q } from '../db.js';
import { asyncHandler, HttpError, toId } from '../utils/http.js';
import { referenceRangeForGender, isResultOutOfReferenceRange } from '../utils/range.js';
import { CBC_ORDER_SQL, dedupeParameters, getPatientById, getTestCategory, testFlags } from '../utils/helpers.js';

const router = Router();

/**
 * GET /api/patients/:id/report
 * Everything needed to print the final patient report. Only the LATEST saved
 * result is returned (change history stays in the database but is not printed).
 */
router.get(
  '/:id/report',
  asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    if (!id) throw new HttpError(400, 'Invalid patient report request.');
    const patient = await getPatientById(id);
    if (!patient) throw new HttpError(404, 'Patient record not found.');
    if (patient.report_status === 'CANCELLED') {
      throw new HttpError(409, 'This report is cancelled and is available only in Cancel Report.', { code: 'CANCELLED' });
    }

    const ordered = await q(
      `SELECT pt.id AS patient_test_id, pt.status, pt.completed_at, pt.result_date,
              pt.mx_inoculation_date, pt.mx_reading_date, pt.sputum_grade, t.id AS test_id, t.test_name
         FROM patient_tests pt JOIN tests t ON pt.test_id = t.id
        WHERE pt.patient_id = ? ORDER BY pt.id ASC`,
      [id]
    );

    const withoutResults = [];
    const groups = new Map();

    for (const test of ordered) {
      const raw = await q(
        `SELECT tp.id AS parameter_id, tp.description,
                COALESCE(NULLIF(tr.unit,''), tp.unit) AS unit,
                COALESCE(NULLIF(tr.reference_range,''), tp.reference_range) AS reference_range,
                tr.result
           FROM test_parameters tp
           JOIN tests t ON t.id = tp.test_id
           INNER JOIN test_results tr ON tr.parameter_id = tp.id AND tr.patient_test_id = ?
          WHERE tp.test_id = ? AND TRIM(COALESCE(tr.result,'')) <> ''
          ORDER BY ${CBC_ORDER_SQL}, tp.id ASC`,
        [test.patient_test_id, test.test_id]
      );

      const parameters = dedupeParameters(
        raw.map((r) => {
          const reference_range = referenceRangeForGender(r.reference_range ?? '', patient.gender ?? '');
          return { ...r, reference_range, result_out_of_range: isResultOutOfReferenceRange(r.result ?? '', reference_range) };
        })
      );

      if (!parameters.length) {
        withoutResults.push({ patient_test_id: test.patient_test_id, test_name: test.test_name });
        continue;
      }

      const flags = testFlags(test.test_name);
      const hideUnit = flags.is_urine || flags.is_hiv || flags.is_malaria;
      const hideReference = flags.is_urine;
      const showUnit = !hideUnit && parameters.some((p) => {
        const u = String(p.unit ?? '').trim();
        return u !== '' && u !== '-';
      });

      const category = getTestCategory(test.test_name);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push({
        ...test,
        ...flags,
        category,
        hide_unit: hideUnit,
        hide_reference: hideReference,
        show_unit: showUnit,
        parameters,
      });
    }

    res.json({
      patient,
      ordered_count: ordered.length,
      tests_without_results: withoutResults,
      groups: [...groups.entries()].map(([category, tests]) => ({ category, tests })),
    });
  })
);

export default router;
