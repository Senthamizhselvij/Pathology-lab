-- ========================================================================
-- PATHOLOGY LABORATORY MANAGEMENT SYSTEM
-- Unified Master Database Schema & Complete Initial Data
-- Database Name: pathology_lab
-- Version: 2.0 (Consolidated Master Release)
-- ========================================================================
--
-- DEFAULT USER CREDENTIALS:
--   Role: Admin
--   Username / Employee ID: admin  OR  5001
--   Password: admin123
--
-- HOW TO IMPORT:
--   Option A (phpMyAdmin):
--     1. Open http://localhost/phpmyadmin/
--     2. Click "Import" tab
--     3. Choose this file (database.sql) and click "Go"
--
--   Option B (MySQL Command Line):
--     mysql -u root -p < database.sql
--
-- ========================================================================

CREATE DATABASE IF NOT EXISTS `pathology_lab` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pathology_lab`;

-- ------------------------------------------------------------------------
-- 1. Table structure for table `admins`
-- Supports role-based access: admin, hod, staff
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admins` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('admin','hod','staff') NOT NULL DEFAULT 'staff',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial default administrator accounts (Password: admin123)
INSERT INTO `admins` (`id`, `username`, `password`, `role`) VALUES
(1, 'admin', '$2y$10$T8Z.0wUuW7dC3iHkJL2SgeW6gUoQf3tU4n0fQ0k2Vz7EaJzQdD4kK', 'admin'),
(2, '5001', '$2y$10$T8Z.0wUuW7dC3iHkJL2SgeW6gUoQf3tU4n0fQ0k2Vz7EaJzQdD4kK', 'admin')
ON DUPLICATE KEY UPDATE `password` = VALUES(`password`), `role` = VALUES(`role`);

-- ------------------------------------------------------------------------
-- 2. Table structure for table `patients`
-- Receipt ID and Patient ID are non-unique to support repeat patient tracking
-- and backdated registrations.
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `patients` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `receipt_id` VARCHAR(100) NULL,
    `patient_date` DATE NOT NULL,
    `report_date` DATE NULL,
    `patient_name` VARCHAR(100) NOT NULL,
    `patient_code` VARCHAR(255) NULL,
    `age` DECIMAL(4,1) NOT NULL,
    `gender` ENUM('Male', 'Female', 'Other') NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `address` TEXT NULL,
    `referred_by` VARCHAR(150) NULL,
    `test_count` INT DEFAULT 0,
    `total_amount` DECIMAL(10,2) DEFAULT 0.00,
    `test_budget` DECIMAL(10,2) NULL,
    `submitted` TINYINT(1) DEFAULT 0,
    `report_status` ENUM('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `cancelled_at` DATETIME NULL,
    `cancelled_by` VARCHAR(100) NULL,
    `cancel_reason` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_patient_receipt_id` (`receipt_id`),
    INDEX `idx_patient_code` (`patient_code`(100)),
    INDEX `idx_patient_date` (`patient_date`),
    INDEX `idx_patient_status` (`report_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 3. Table structure for table `tests`
-- Full laboratory test catalog
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tests` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `test_name` VARCHAR(100) NOT NULL UNIQUE,
    `price` DECIMAL(10,2) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 4. Table structure for table `test_parameters`
-- Individual parameters belonging to tests (with unit, range, and optional split price)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `test_parameters` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `test_id` INT NOT NULL,
    `description` VARCHAR(150) NOT NULL,
    `unit` VARCHAR(50) DEFAULT '-',
    `reference_range` VARCHAR(100) DEFAULT '-',
    `price` DECIMAL(10,2) DEFAULT NULL,
    INDEX `idx_tp_test_id` (`test_id`),
    CONSTRAINT `fk_params_test` FOREIGN KEY (`test_id`) REFERENCES `tests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 5. Table structure for table `patient_tests`
-- Tests assigned to registered patients
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `patient_tests` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `patient_id` INT NOT NULL,
    `test_id` INT NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED') DEFAULT 'PENDING',
    `completed_at` DATETIME NULL,
    `result_date` DATE NULL,
    `mx_inoculation_date` DATE NULL,
    `mx_reading_date` DATE NULL,
    `sputum_grade` VARCHAR(100) NULL,
    INDEX `idx_pt_patient_id` (`patient_id`),
    INDEX `idx_pt_test_id` (`test_id`),
    CONSTRAINT `fk_pt_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_pt_test` FOREIGN KEY (`test_id`) REFERENCES `tests` (`id`) ON DELETE CASCADE,
    CONSTRAINT `unique_patient_test` UNIQUE (`patient_id`, `test_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 6. Table structure for table `test_results`
-- Values recorded for each test parameter
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `test_results` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `patient_test_id` INT NOT NULL,
    `parameter_id` INT NOT NULL,
    `result` VARCHAR(255) NOT NULL,
    `unit` VARCHAR(50) DEFAULT '-',
    `reference_range` VARCHAR(100) DEFAULT '-',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_tr_patient_test_id` (`patient_test_id`),
    INDEX `idx_tr_parameter_id` (`parameter_id`),
    CONSTRAINT `fk_tr_patient_test` FOREIGN KEY (`patient_test_id`) REFERENCES `patient_tests` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tr_parameter` FOREIGN KEY (`parameter_id`) REFERENCES `test_parameters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 7. Table structure for table `test_result_history`
-- Audit trail of edits made to test results
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `test_result_history` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `patient_test_id` INT NOT NULL,
    `parameter_id` INT NOT NULL,
    `old_result` VARCHAR(255) NULL,
    `new_result` VARCHAR(255) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `changed_by` VARCHAR(100) NULL,
    `changed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_trh_patient_test_parameter` (`patient_test_id`, `parameter_id`),
    CONSTRAINT `fk_trh_patient_test` FOREIGN KEY (`patient_test_id`) REFERENCES `patient_tests` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_trh_parameter` FOREIGN KEY (`parameter_id`) REFERENCES `test_parameters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------
-- 8. Table structure for table `audit_logs`
-- Append-only system activity log
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `username` VARCHAR(50) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `details` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_created_at` (`created_at`),
    INDEX `idx_audit_username` (`username`),
    INDEX `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================================
-- TEST CATALOG SEED DATA
-- Complete laboratory tests and current prices
-- ========================================================================
INSERT INTO `tests` (`test_name`, `price`) VALUES
('CBC', 150.00),
('BT / CT', 50.00),
('ESR (Westergren)', 100.00),
('HB', 50.00),
('Platelet Count', 50.00),
('P/S for MP', 50.00),
('Urine Pregnancy Test', 50.00),
('Urine (Routine / Microscopic)', 50.00),
('Widal Test', 100.00),
('RA Factor', 100.00),
('VDRL', 150.00),
('Blood Group & Rh Factor', 100.00),
('Sputum for AFB', 50.00),
('CRP', 100.00),
('Thyroid Profile', 400.00),
('TSH', 250.00),
('HbA1C', 300.00),
('MX Test', 100.00),
('Typhidot', 150.00),
('Vitamin B12', 500.00),
('Vitamin D3', 500.00),
('Malaria Antigen', 100.00),
('Kidney Function Test', 250.00),
('Blood Urea', 100.00),
('Creatinine', 100.00),
('S. Calcium', 100.00),
('Uric Acid', 100.00),
('Liver Function Test', 250.00),
('S. Bilirubin (Total / Direct / Indirect)', 100.00),
('S.G.O.T', 100.00),
('S.G.P.T', 100.00),
('Total Protein / Albumin', 100.00),
('Lipid Profile', 350.00),
('Cholesterol / HDL', 100.00),
('Triglyceride', 100.00),
('L.D.L', 100.00),
('Total Protein', 150.00),
('Viral Marker', 500.00),
('HIV', 150.00),
('HCV', 150.00),
('HBsAg', 150.00),
('Blood Sugar Fasting', 50.00),
('Blood Sugar PP', 50.00),
('Blood Sugar (Fasting / PP)', 100.00),
('HIV / HCV / HBsAg / VDRL', 600.00)
ON DUPLICATE KEY UPDATE `price` = VALUES(`price`);

-- ========================================================================
-- TEST PARAMETERS SEED DATA
-- Defined with standard clinical reference ranges, units, and split prices
-- ========================================================================

-- 1. Complete Blood Count (CBC)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Hemoglobin', 'g/dl', 'Male 13 - 17; Female 11.6 - 14.5' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'Total Leucocyte Count', 'cumm', '4000-11000' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'Neutrophils (Poly)', '%', '40 - 75' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'Lymphocytes', '%', '20 - 45' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'Eosinophils', '%', '1 - 6' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'Monocytes', '%', '2 - 8' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'Basophils', '%', '0 - 1' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'Total RBC Count', 'million/cu.mm', '3.5-5.5' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'PCV', '%', '34 - 50' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'MCV', 'fl', '75 - 95' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'MCH', 'pg', '25 - 32' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'MCHC', '%', '32 - 36' FROM tests WHERE test_name='CBC'
UNION ALL SELECT id, 'Platelet Count', 'lakhs/cumm', '1.5-4.5' FROM tests WHERE test_name='CBC';

-- 2. Bleeding Time / Clotting Time (BT / CT) - Flat ₹50 per part or total
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`, `price`)
SELECT id, 'Bleeding Time', 'min', '2 - 7', 50.00 FROM tests WHERE test_name='BT / CT'
UNION ALL SELECT id, 'Clotting Time', 'min', '4 - 8', 50.00 FROM tests WHERE test_name='BT / CT';

-- 3. ESR (Westergren)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'ESR (Westergren)', 'mm/hr', 'Men 0 - 15; Women 0 - 20' FROM tests WHERE test_name='ESR (Westergren)';

-- 4. Hemoglobin (HB)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Hemoglobin', 'g/dl', 'Male 13 - 17; Female 11.6 - 14.5' FROM tests WHERE test_name='HB';

-- 5. Platelet Count
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Platelet Count', 'lakhs/cumm', '1.5 - 4.5' FROM tests WHERE test_name='Platelet Count';

-- 6. P/S for MP (Malaria Parasite)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Malaria Parasite', '-', 'Negative / Positive' FROM tests WHERE test_name='P/S for MP';

-- 7. Urine Pregnancy Test
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Pregnancy Test (Urine)', '-', 'Negative / Positive' FROM tests WHERE test_name='Urine Pregnancy Test';

-- 8. Urine (Routine / Microscopic)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Quantity', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'Color', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'Appearance', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'Reaction (pH)', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'Proteins', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'Glucose', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'Pus Cells', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'Epithelial Cells', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'RBC', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'Casts', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'Crystals', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'Bile Salts', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)'
UNION ALL SELECT id, 'Bile Pigments', '', '' FROM tests WHERE test_name='Urine (Routine / Microscopic)';

-- 9. Widal Test
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Typhi O', '', '< 1:80' FROM tests WHERE test_name='Widal Test'
UNION ALL SELECT id, 'Typhi H', '', '< 1:80' FROM tests WHERE test_name='Widal Test'
UNION ALL SELECT id, 'Typhi AH', '', '< 1:80' FROM tests WHERE test_name='Widal Test'
UNION ALL SELECT id, 'Typhi BH', '', '< 1:80' FROM tests WHERE test_name='Widal Test';

-- 10. RA Factor
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'RA Factor', '-', 'Negative / Positive' FROM tests WHERE test_name='RA Factor';

-- 11. VDRL
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'VDRL', '-', 'Non-reactive / Reactive' FROM tests WHERE test_name='VDRL';

-- 12. Blood Group & Rh Factor
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Blood Group', '-', 'ABO Group' FROM tests WHERE test_name='Blood Group & Rh Factor'
UNION ALL SELECT id, 'Rh Factor', '-', 'Positive / Negative' FROM tests WHERE test_name='Blood Group & Rh Factor';

-- 13. Sputum for AFB
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'SPUTUM EXAMINATION, AFB', '', '' FROM tests WHERE test_name='Sputum for AFB';

-- 14. C-Reactive Protein (CRP)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'C-Reactive Protein (CRP)', '-', 'Negative / Positive' FROM tests WHERE test_name='CRP';

-- 15. Thyroid Profile
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'T3', 'ng/mL', '0.52 - 1.85' FROM tests WHERE test_name='Thyroid Profile'
UNION ALL SELECT id, 'T4', 'µg/dL', '4.8 - 11.6' FROM tests WHERE test_name='Thyroid Profile'
UNION ALL SELECT id, 'TSH', 'µIU/mL', '0.39 - 5.5' FROM tests WHERE test_name='Thyroid Profile';

-- 16. TSH (Individual)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'TSH', 'µIU/mL', '0.39 - 5.5' FROM tests WHERE test_name='TSH';

-- 17. HbA1C
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'HbA1C', '%', 'Normal < 5.7%; Prediabetes 5.7 - 6.4%; Diabetes 6.5% or higher' FROM tests WHERE test_name='HbA1C';

-- 18. MX Test (Mantoux)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Tuberculin Test (0.1 ml = 10 TU)', '', '' FROM tests WHERE test_name='MX Test';

-- 19. Typhidot
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'IgM', '', 'Negative / Positive' FROM tests WHERE test_name='Typhidot'
UNION ALL SELECT id, 'IgG', '', 'Negative / Positive' FROM tests WHERE test_name='Typhidot';

-- 20. Vitamin B12
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Vitamin B12', 'pg/mL', '200 - 950' FROM tests WHERE test_name='Vitamin B12';

-- 21. Vitamin D3
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Vitamin D3', 'ng/mL', 'Deficiency < 20; Insufficiency 20 - 30; Sufficiency 30 - 100; Toxicity > 100' FROM tests WHERE test_name='Vitamin D3';

-- 22. Malaria Antigen
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Plasmodium vivax Antigen', '', 'Negative / Positive' FROM tests WHERE test_name='Malaria Antigen'
UNION ALL SELECT id, 'Plasmodium falciparum Antigen', '', 'Negative / Positive' FROM tests WHERE test_name='Malaria Antigen';

-- 23. Kidney Function Test (KFT)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Urea', 'mg/dL', '6 - 40' FROM tests WHERE test_name='Kidney Function Test'
UNION ALL SELECT id, 'Creatinine', 'mg/dL', '0.7 - 1.3' FROM tests WHERE test_name='Kidney Function Test'
UNION ALL SELECT id, 'Uric Acid', 'mg/dL', '3.5 - 7.2' FROM tests WHERE test_name='Kidney Function Test'
UNION ALL SELECT id, 'S. Calcium', 'mg/dL', '8.5 - 10.2' FROM tests WHERE test_name='Kidney Function Test';

-- 24. Blood Urea
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Blood Urea', 'mg/dL', '6 - 40' FROM tests WHERE test_name='Blood Urea';

-- 25. Creatinine
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Creatinine', 'mg/dL', '0.7 - 1.3' FROM tests WHERE test_name='Creatinine';

-- 26. S. Calcium
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'S. Calcium', 'mg/dL', '8.5 - 10.2' FROM tests WHERE test_name='S. Calcium';

-- 27. Uric Acid
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Uric Acid', 'mg/dL', '3.5 - 7.2' FROM tests WHERE test_name='Uric Acid';

-- 28. Liver Function Test (LFT)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Serum Bilirubin (Total)', 'mg/dL', '0.2 - 1.2' FROM tests WHERE test_name='Liver Function Test'
UNION ALL SELECT id, 'Serum Bilirubin (Direct)', 'mg/dL', '0.1 - 0.3' FROM tests WHERE test_name='Liver Function Test'
UNION ALL SELECT id, 'Serum Bilirubin (Indirect)', 'mg/dL', '0.2 - 1' FROM tests WHERE test_name='Liver Function Test'
UNION ALL SELECT id, 'Alkaline Phosphatase (ALP)', 'IU/L', 'Men 40 - 129; Women 35 - 104' FROM tests WHERE test_name='Liver Function Test'
UNION ALL SELECT id, 'SGOT (AST)', 'IU/L', '< 37' FROM tests WHERE test_name='Liver Function Test'
UNION ALL SELECT id, 'SGPT (ALT)', 'IU/L', '< 40' FROM tests WHERE test_name='Liver Function Test'
UNION ALL SELECT id, 'Serum Total Protein', 'g/dL', '6.4 - 8.3' FROM tests WHERE test_name='Liver Function Test'
UNION ALL SELECT id, 'Serum Albumin', 'g/dL', '3.5 - 5.2' FROM tests WHERE test_name='Liver Function Test'
UNION ALL SELECT id, 'Globulin', 'g/dL', '1.8 - 3.6' FROM tests WHERE test_name='Liver Function Test';

-- 29. S. Bilirubin (Total / Direct / Indirect)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Total Bilirubin', 'mg/dL', '0.2 - 1.2' FROM tests WHERE test_name='S. Bilirubin (Total / Direct / Indirect)'
UNION ALL SELECT id, 'Direct Bilirubin', 'mg/dL', '0.1 - 0.3' FROM tests WHERE test_name='S. Bilirubin (Total / Direct / Indirect)'
UNION ALL SELECT id, 'Indirect Bilirubin', 'mg/dL', '0.2 - 1' FROM tests WHERE test_name='S. Bilirubin (Total / Direct / Indirect)';

-- 30. S.G.O.T
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'S.G.O.T', 'IU/L', '< 37' FROM tests WHERE test_name='S.G.O.T';

-- 31. S.G.P.T
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'S.G.P.T', 'IU/L', '< 40' FROM tests WHERE test_name='S.G.P.T';

-- 32. Total Protein / Albumin
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Total Protein', 'g/dL', '6.4 - 8.3' FROM tests WHERE test_name='Total Protein / Albumin'
UNION ALL SELECT id, 'Albumin', 'g/dL', '3.5 - 5.2' FROM tests WHERE test_name='Total Protein / Albumin';

-- 33. Total Protein (Individual)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Total Protein', 'g/dL', '6.4 - 8.3' FROM tests WHERE test_name='Total Protein';

-- 34. Lipid Profile
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Total Cholesterol', 'mg/dL', '< 200' FROM tests WHERE test_name='Lipid Profile'
UNION ALL SELECT id, 'S. Triglyceride', 'mg/dL', '< 150' FROM tests WHERE test_name='Lipid Profile'
UNION ALL SELECT id, 'HDL', 'mg/dL', '40 - 60' FROM tests WHERE test_name='Lipid Profile'
UNION ALL SELECT id, 'LDL', 'mg/dL', '< 100' FROM tests WHERE test_name='Lipid Profile'
UNION ALL SELECT id, 'VLDL', 'mg/dL', '5 - 40' FROM tests WHERE test_name='Lipid Profile';

-- 35. Cholesterol / HDL
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Cholesterol', 'mg/dL', '< 200' FROM tests WHERE test_name='Cholesterol / HDL'
UNION ALL SELECT id, 'HDL', 'mg/dL', '40 - 60' FROM tests WHERE test_name='Cholesterol / HDL';

-- 36. Triglyceride
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'Triglyceride', 'mg/dL', '< 150' FROM tests WHERE test_name='Triglyceride';

-- 37. L.D.L
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'LDL', 'mg/dL', '< 100' FROM tests WHERE test_name='L.D.L';

-- 38. Viral Marker
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'HIV-1', '', '' FROM tests WHERE test_name='Viral Marker'
UNION ALL SELECT id, 'HIV-2', '', '' FROM tests WHERE test_name='Viral Marker'
UNION ALL SELECT id, 'VDRL', '', 'Non-reactive' FROM tests WHERE test_name='Viral Marker'
UNION ALL SELECT id, 'HCV', '', 'Non-reactive' FROM tests WHERE test_name='Viral Marker'
UNION ALL SELECT id, 'HBsAg', '', 'Non-reactive' FROM tests WHERE test_name='Viral Marker';

-- 39. HIV (Single Test)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'HIV 1', '', 'Negative / Positive' FROM tests WHERE test_name='HIV'
UNION ALL SELECT id, 'HIV 2', '', 'Negative / Positive' FROM tests WHERE test_name='HIV';

-- 40. HCV (Single Test)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'HCV', '-', 'Non-reactive' FROM tests WHERE test_name='HCV';

-- 41. HBsAg (Single Test)
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'HBsAg', '-', 'Non-reactive' FROM tests WHERE test_name='HBsAg';

-- 42. Blood Sugar Fasting
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`, `price`)
SELECT id, 'Glucose Fasting', 'mg/dL', '< 100', 50.00 FROM tests WHERE test_name='Blood Sugar Fasting';

-- 43. Blood Sugar PP
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`, `price`)
SELECT id, 'Glucose P.P', 'mg/dL', '< 140', 50.00 FROM tests WHERE test_name='Blood Sugar PP';

-- 44. Blood Sugar (Fasting / PP) - Legacy Combined
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`, `price`)
SELECT id, 'Glucose Fasting', 'mg/dL', '< 100', 50.00 FROM tests WHERE test_name='Blood Sugar (Fasting / PP)'
UNION ALL SELECT id, 'Glucose P.P', 'mg/dL', '< 140', 50.00 FROM tests WHERE test_name='Blood Sugar (Fasting / PP)';

-- 45. HIV / HCV / HBsAg / VDRL - Legacy Combined
INSERT INTO `test_parameters` (`test_id`, `description`, `unit`, `reference_range`)
SELECT id, 'HIV', '-', 'Negative' FROM tests WHERE test_name='HIV / HCV / HBsAg / VDRL'
UNION ALL SELECT id, 'HCV', '-', 'Non-reactive' FROM tests WHERE test_name='HIV / HCV / HBsAg / VDRL'
UNION ALL SELECT id, 'HBsAg', '-', 'Non-reactive' FROM tests WHERE test_name='HIV / HCV / HBsAg / VDRL'
UNION ALL SELECT id, 'VDRL', '-', 'Non-reactive' FROM tests WHERE test_name='HIV / HCV / HBsAg / VDRL';

-- ========================================================================
-- END OF DATABASE SCHEMA & SEED DATA
-- ========================================================================
