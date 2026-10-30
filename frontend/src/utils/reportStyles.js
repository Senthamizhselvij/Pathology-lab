/**
 * Screen + print CSS for the patient report page, copied unchanged from the original report.php.
 * It is injected by <Report /> only while that page is open, so its @page rules
 * never leak into other pages.
 */
export const REPORT_CSS = `/* Multi-page patient report printing:
   - lets a long report flow naturally onto page 2, 3, etc.
   - prevents individual test tables/sections from being split where possible
   - keeps each printed sheet clean and sequential for stapling
*/

.report-letterhead{position:relative;text-align:center;border-bottom:2px solid #111;padding:0 145px 16px 0;min-height:185px;color:#111;}
.report-society{font-family:Georgia,'Times New Roman',serif;font-size:1.75rem;font-weight:900;letter-spacing:.2px;border-bottom:1px solid #111;display:inline-block;padding-bottom:3px;}
.report-founded{font-family:Georgia,'Times New Roman',serif;font-size:.82rem;font-style:italic;font-weight:700;margin-top:5px;}
.report-hindi{font-family:'Noto Sans Devanagari','Mangal',sans-serif;font-size:1.55rem;font-weight:800;margin-top:7px;}
.report-clinic{font-family:Georgia,'Times New Roman',serif;font-size:1.15rem;font-weight:800;margin-top:4px;}
.report-subtitle,.report-address,.report-phone{font-family:Georgia,'Times New Roman',serif;font-size:.82rem;line-height:1.25;margin-top:3px;text-align:center;}
.report-lalaji{position:absolute;right:8px;top:0;width:118px;height:135px;object-fit:contain;filter:grayscale(100%);}
.report-title-box{width:max-content;max-width:100%;margin:14px auto 16px;border:2px solid #111;padding:7px 38px;font-family:Georgia,'Times New Roman',serif;font-size:1.45rem;font-weight:900;letter-spacing:.3px;}
.report-patient-box{border:1px solid #222;margin-bottom:18px;padding:0;font-size:.79rem;line-height:1.5;color:#111;overflow:hidden;}
/* Patient details are intentionally two separate rows. */
.patient-bio-grid{display:block !important;width:100%;}
.report-patient-line{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:center;column-gap:14px;row-gap:8px;white-space:normal;width:100%;min-width:0;box-sizing:border-box;padding:10px 12px;}
.report-patient-line>span{display:flex;align-items:flex-start;gap:4px;min-width:0;width:100%;white-space:normal;overflow:visible;overflow-wrap:anywhere;box-sizing:border-box;font-size:.78rem;}
.report-patient-line>span strong{flex:0 0 auto;}
.report-patient-line>span:not(.report-address-inline){text-overflow:unset;}
.report-patient-line .report-address-inline{overflow:visible;text-overflow:unset;}
.report-patient-line .report-date-inline{min-width:0;overflow:visible;white-space:normal;}
.report-patient-line-second{grid-template-columns:none !important;overflow:visible !important;}
.report-address-inline{min-width:0;overflow:hidden;text-overflow:ellipsis;}
.report-patient-line-second{display:flex !important;align-items:center;justify-content:flex-start;width:100%;margin:0;padding:10px 12px;border-top:1px solid #d1d5db;box-sizing:border-box;background:#fafafa;}
.report-ref-field{display:flex !important;align-items:center;gap:12px;flex:1 1 auto;width:100%;min-width:0;overflow:visible !important;box-sizing:border-box;}
.report-ref-field > strong{flex:0 0 auto;min-width:95px;}
.report-ref-field form{display:flex !important;align-items:center;gap:8px;flex-wrap:nowrap;flex:1 1 auto;min-width:0;}
.report-ref-editor{vertical-align:middle;display:inline-flex !important;align-items:center;gap:8px;flex:1 1 auto;min-width:0;}
.report-ref-editor input{flex:0 1 420px;min-width:220px;max-width:420px;}
.print-only{display:none;}
.print-layout{width:100%;border-collapse:collapse;border:0;}
.print-layout>thead>tr>td,.print-layout>tbody>tr>td,.print-layout>tfoot>tr>td{padding:0;border:0;}
.print-footer-spacer{display:none;}
.report-signatures{display:flex;justify-content:space-between;align-items:flex-end;width:100%;margin-top:48px;padding:0 45px;box-sizing:border-box;}
.report-signature-block{width:250px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:.86rem;color:#111;}
.technician-signature-image{display:block;width:145px;height:62px;object-fit:contain;margin:0 auto 2px;}
.signature-line{border-top:1px solid #111;margin:2px 0 6px;}

@media (max-width: 900px) {
    .report-patient-line{grid-template-columns:repeat(2,minmax(0,1fr));}
}
@media (max-width: 520px) {
    .report-patient-line{grid-template-columns:minmax(0,1fr);}
}

@media print {
    /* Top margin is small: the letterhead lives in <thead> and repeats on every page.
       Bottom margin holds "Page x of y"; the digital signature sits just above it. */
    @page { size: A4 portrait; margin: 8mm 6mm 12mm 6mm; }
    @page {
        @bottom-right {
            content: "Page " counter(page) " of " counter(pages);
            font-family: Arial, sans-serif;
            font-size: 8pt;
            color: #111;
        }
    }

    html, body { width:100%; margin:0 !important; padding:0 !important; background:#fff !important; }

    .pathology-report {
        width:100% !important; max-width:none !important; margin:0 !important;
        padding:0 !important; box-shadow:none !important; border:0 !important;
    }

    /* ---- outer layout table: header repeats, footer spacer reserves signature room ---- */
    .pathology-report table.print-layout { width:100% !important; border-collapse:collapse !important; border:0 !important; break-inside:auto !important; page-break-inside:auto !important; }
    .print-layout > thead { display:table-header-group !important; }
    .print-layout > tfoot { display:table-footer-group !important; }
    .print-layout > tbody, .print-layout > tbody > tr, .print-layout > tbody > tr > td { break-inside:auto !important; page-break-inside:auto !important; }
    .print-layout > thead > tr > td, .print-layout > tbody > tr > td, .print-layout > tfoot > tr > td { padding:0 !important; border:0 !important; }
    .print-layout > thead > tr > td { padding-bottom:2.5mm !important; background:#fff; }
    .print-footer-spacer { display:block !important; height:24mm; }

    /* ---- compact letterhead (same on every page) ---- */
    .print-layout .report-letterhead { min-height:29mm !important; height:auto !important; padding:0 25mm 1.5mm 0 !important; border-bottom:1px solid #111 !important; box-sizing:border-box !important; }
    .print-layout .report-society { font-size:12pt !important; }
    .print-layout .report-founded { font-size:6.5pt !important; margin-top:1mm !important; }
    .print-layout .report-hindi { font-size:11pt !important; margin-top:1mm !important; }
    .print-layout .report-clinic { font-size:8pt !important; margin-top:.5mm !important; }
    .print-layout .report-subtitle, .print-layout .report-address, .print-layout .report-phone { font-size:6.5pt !important; line-height:1.1 !important; margin-top:.3mm !important; }
    .print-layout .report-lalaji { width:22mm !important; height:25mm !important; right:1mm !important; top:0 !important; }
    .print-layout .report-title-box { width:max-content !important; max-width:100% !important; margin:2mm auto 0 !important; padding:.6mm 8mm !important; border-width:1px !important; font-size:9pt !important; }

    /* ---- patient details: normal flow => page 1 only ---- */
    .pathology-report .report-patient-box { display:block !important; margin:0 0 4mm !important; break-inside:avoid !important; page-break-inside:avoid !important; }

    /* ---- tests ---- */
    .pathology-report .category-wrap { margin-top:3mm !important; }
    .pathology-report .category-title { break-after:avoid !important; page-break-after:avoid !important; margin-bottom:2mm !important; }
    .pathology-report .test-block { display:block !important; margin:0 0 5px !important; break-inside:avoid !important; page-break-inside:avoid !important; }
    .pathology-report .test-block table,
    .pathology-report .test-block tbody,
    .pathology-report .test-block tr,
    .pathology-report .test-block th,
    .pathology-report .test-block td { break-inside:avoid !important; page-break-inside:avoid !important; }
    .pathology-report .test-block > div:first-child { break-after:avoid !important; page-break-after:avoid !important; padding-top:4px !important; padding-bottom:4px !important; }
    .pathology-report .test-block table { margin-top:0 !important; margin-bottom:5px !important; width:100% !important; border-collapse:collapse !important; }
    .pathology-report .test-block thead { display:table-header-group; }
    .pathology-report .test-block td, .pathology-report .test-block th { padding:3px 6px !important; line-height:1.15 !important; }

    /* ---- digital signature only, fixed at the bottom of EVERY page ---- */
    .pathology-report .report-signatures {
        position:fixed !important; left:0 !important; right:0 !important; bottom:0 !important;
        height:20mm !important; width:auto !important; margin:0 !important; padding:0 8mm !important; gap:0 !important;
        display:flex !important; justify-content:space-between !important; align-items:flex-end !important;
        background:#fff !important; z-index:9999 !important; box-sizing:border-box !important;
        break-inside:avoid !important; page-break-inside:avoid !important;
    }
    /* Keep both signatures on one straight baseline, with each digital signature directly above its label. */
    .pathology-report .report-signature-block {
        width:45% !important; max-width:45% !important; height:18mm !important;
        display:flex !important; flex-direction:column !important; justify-content:flex-end !important;
        align-items:center !important; text-align:center !important; line-height:4mm !important;
    }
    .pathology-report .technician-signature-image {
        display:block !important; flex:0 0 11mm !important; width:38mm !important; height:11mm !important;
        object-fit:contain !important; object-position:center bottom !important; margin:0 auto 1mm !important;
    }
    .pathology-report .signature-label { display:block !important; flex:0 0 4mm !important; width:100% !important; margin:0 !important; padding:0 !important; line-height:4mm !important; text-align:center !important; }

    .no-print, .no-print * { display:none !important; }
    .print-only { display:inline !important; }

    .report-patient-line { display:grid !important; grid-template-columns:repeat(3,minmax(0,1fr)) !important; column-gap:10px !important; row-gap:6px !important; white-space:normal !important; overflow:visible !important; }
    .report-patient-line > span { display:flex !important; white-space:normal !important; overflow:visible !important; overflow-wrap:anywhere !important; font-size:9pt !important; }
    .report-patient-line .report-date-inline { display:flex !important; visibility:visible !important; overflow:visible !important; white-space:normal !important; }
    .report-patient-line-second .no-print { display:none !important; }
    .report-patient-line-second .print-only { display:inline !important; }
    .report-patient-box { font-size:.72rem; padding:0; }
    .report-patient-line { grid-template-columns:1.15fr 1.3fr .72fr .82fr 1.1fr .85fr; column-gap:5px; font-size:.64rem; padding:6px 8px; }
    .report-patient-line-second { display:flex !important; padding:6px 8px; border-top:1px solid #999; }
    .report-patient-line>span{gap:3px;}
    .report-ref-field { flex:1; }
}
`;
