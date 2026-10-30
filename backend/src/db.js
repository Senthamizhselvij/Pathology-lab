import fs from 'fs';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { catalogUpdates } from './catalogUpdates.js';

export let pool;

/** Run a query and return just the rows. */
export async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run a callback inside a transaction (commit on success, rollback on error). */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
}

const baseConn = () => ({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  charset: 'utf8mb4',
});

/** Create the database if needed, connect, import schema on first run, upgrade old databases. */
export async function initDatabase() {
  const { name } = config.db;

  // 1. Make sure the database exists.
  const root = await mysql.createConnection(baseConn());
  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await root.end();

  // 2. Connection pool. dateStrings => DATE/DATETIME columns arrive as plain
  //    'YYYY-MM-DD' / 'YYYY-MM-DD HH:MM:SS' strings (no timezone surprises).
  pool = mysql.createPool({
    ...baseConn(),
    database: name,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  });

  // 3. First run: import database/schema.sql (tables + test catalog + default users).
  const hasTables = (await q("SHOW TABLES LIKE 'admins'")).length > 0;
  if (!hasTables) {
    console.log('[db] First run - importing database/schema.sql ...');
    let sql = fs.readFileSync(config.schemaFile, 'utf8');
    // The file hard-codes the database name; we are already connected to the right one.
    sql = sql.replace(/^\s*CREATE DATABASE[^;]*;/gim, '').replace(/^\s*USE\s+[^;]*;/gim, '');
    const conn = await mysql.createConnection({
      ...baseConn(),
      database: name,
      multipleStatements: true,
    });
    try {
      await conn.query(sql);
    } finally {
      await conn.end();
    }
  }

  await ensureSchema();
  await ensureDefaultAdminPasswords();
}

/* -------------------------------------------------------------------------- */
/* Schema upgrades for older installations (port of includes/ensure_schema.php) */
/* -------------------------------------------------------------------------- */

async function columnExists(table, column) {
  const rows = await q(
    'SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return Number(rows[0].c) > 0;
}

async function addColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function dropUniqueIndexesOn(table, column) {
  const rows = await q(
    "SELECT DISTINCT INDEX_NAME AS n FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND NON_UNIQUE = 0 AND INDEX_NAME <> 'PRIMARY'",
    [table, column]
  );
  for (const { n } of rows) {
    await pool.query(`ALTER TABLE \`${table}\` DROP INDEX \`${String(n).replace(/`/g, '``')}\``);
  }
}

async function ensureSchema() {
  try {
    await addColumn('patients', 'patient_code', 'VARCHAR(255) NULL AFTER patient_name');
    await pool.query('ALTER TABLE patients MODIFY patient_code VARCHAR(255) NULL');
    await dropUniqueIndexesOn('patients', 'patient_code');

    await addColumn('patients', 'report_date', 'DATE NULL AFTER patient_date');
    await addColumn('patients', 'test_budget', 'DECIMAL(10,2) NULL AFTER total_amount');
    await pool.query('ALTER TABLE patients MODIFY age DECIMAL(4,1) NOT NULL');
    await addColumn('patients', 'referred_by', 'VARCHAR(150) NULL AFTER address');
    await addColumn('patients', 'report_status', "ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE' AFTER submitted");
    await addColumn('patients', 'cancelled_at', 'DATETIME NULL AFTER report_status');
    await addColumn('patients', 'cancelled_by', 'VARCHAR(100) NULL AFTER cancelled_at');
    await addColumn('patients', 'cancel_reason', 'VARCHAR(255) NULL AFTER cancelled_by');

    // Receipt IDs are manually typed and NOT unique (a repeated ID marks an OLD patient).
    await pool.query('ALTER TABLE patients MODIFY receipt_id VARCHAR(100) NULL');
    await dropUniqueIndexesOn('patients', 'receipt_id');

    await pool.query(`CREATE TABLE IF NOT EXISTS test_result_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_test_id INT NOT NULL,
      parameter_id INT NOT NULL,
      old_result VARCHAR(255) NULL,
      new_result VARCHAR(255) NOT NULL,
      reason VARCHAR(500) NULL,
      changed_by VARCHAR(100) NULL,
      changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_trh_patient_test_parameter (patient_test_id, parameter_id),
      CONSTRAINT fk_trh_patient_test FOREIGN KEY (patient_test_id) REFERENCES patient_tests(id) ON DELETE CASCADE,
      CONSTRAINT fk_trh_parameter FOREIGN KEY (parameter_id) REFERENCES test_parameters(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      username VARCHAR(50) NOT NULL,
      action VARCHAR(100) NOT NULL,
      details TEXT NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_created_at (created_at),
      INDEX idx_audit_username (username),
      INDEX idx_audit_action (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await addColumn('admins', 'role', "ENUM('admin','hod','staff') NOT NULL DEFAULT 'staff'");

    await addColumn('patient_tests', 'result_date', 'DATE NULL');
    await addColumn('patient_tests', 'mx_inoculation_date', 'DATE NULL AFTER result_date');
    await addColumn('patient_tests', 'mx_reading_date', 'DATE NULL AFTER mx_inoculation_date');
    await addColumn('patient_tests', 'sputum_grade', 'VARCHAR(100) NULL');
    await addColumn('test_parameters', 'price', 'DECIMAL(10,2) DEFAULT NULL AFTER reference_range');

    for (const sql of catalogUpdates) {
      await pool.query(sql);
    }
  } catch (err) {
    // Do not stop the whole app because of an upgrade problem (e.g. restricted MySQL user).
    console.error('[db] Schema upgrade notice:', err.message);
  }
}

/**
 * The original database.sql shipped a placeholder bcrypt hash for the default
 * "admin" / "5001" accounts (password admin123) that does not actually verify,
 * and the PHP login worked around that with a hard-coded "admin123" bypass.
 * We replace the placeholder with a REAL hash once, so the bypass is not needed
 * and an admin who changes the password really changes it.
 */
const PLACEHOLDER_HASH = '$2y$10$T8Z.0wUuW7dC3iHkJL2SgeW6gUoQf3tU4n0fQ0k2Vz7EaJzQdD4kK';

async function ensureDefaultAdminPasswords() {
  try {
    const rows = await q('SELECT id FROM admins WHERE password = ?', [PLACEHOLDER_HASH]);
    if (rows.length) {
      const hash = bcrypt.hashSync('admin123', 10);
      await pool.query('UPDATE admins SET password = ? WHERE password = ?', [hash, PLACEHOLDER_HASH]);
      console.log('[db] Default admin accounts (admin / 5001) set up with password: admin123');
    }
    const count = Number((await q('SELECT COUNT(*) AS c FROM admins'))[0].c);
    if (count === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await pool.query("INSERT INTO admins (username, password, role) VALUES ('admin', ?, 'admin'), ('5001', ?, 'admin')", [hash, hash]);
      console.log('[db] No users found - created admin / 5001 with password: admin123');
    }
  } catch (err) {
    console.error('[db] Could not prepare default admin accounts:', err.message);
  }
}
