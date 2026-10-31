
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

/** Run a callback inside a transaction. */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const result = await fn(conn);

    await conn.commit();
    return result;

  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // Ignore rollback errors.
    }

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

  // TiDB Cloud SSL
  ssl: config.db.ssl
    ? { minVersion: 'TLSv1.2' }
    : undefined,
});

/**
 * Initialize database.
 *
 * Local development:
 * - Can create the database.
 * - Can import schema.sql.
 * - Can prepare default admin accounts.
 *
 * Production (Render):
 * - Uses an already-created cloud database.
 * - Does not create an empty database.
 * - Does not automatically create default admin accounts.
 */

export async function initDatabase() {
  const { name } = config.db;

  // 1. Connect directly to the existing database.
  pool = mysql.createPool({
    ...baseConn(),
    database: name,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  });

  // 2. Verify that the existing database is available.
  const [databaseCheck] = await pool.query(
    'SELECT DATABASE() AS database_name'
  );

  console.log(
    '[db] Connected to database:',
    databaseCheck[0].database_name
  );

  // 3. Confirm that the existing tables are present.
  const hasAdminTable =
    (await q("SHOW TABLES LIKE 'admins'")).length > 0;

  if (!hasAdminTable) {
    throw new Error(
      `Database "${name}" is missing the admins table.`
    );
  }

  // 4. Run the safe schema check.
  await ensureSchema();

  // 5. Do not change existing admin passwords or create default users.
  console.log('[db] Existing admin accounts preserved.');
  console.log('[db] Existing patient records preserved.');

  console.log('[db] Database initialization completed successfully.');
}

/* -------------------------------------------------------------------------- */
/* Schema upgrades for older installations                                   */
/* -------------------------------------------------------------------------- */

async function columnExists(table, column) {
  const rows = await q(
    `SELECT COUNT(*) AS c
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = ?
     AND COLUMN_NAME = ?`,
    [table, column]
  );

  return Number(rows[0].c) > 0;
}

async function addColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await pool.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
    );
  }
}

async function dropUniqueIndexesOn(table, column) {
  const rows = await q(
    `SELECT DISTINCT INDEX_NAME AS n
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = ?
     AND COLUMN_NAME = ?
     AND NON_UNIQUE = 0
     AND INDEX_NAME <> 'PRIMARY'`,
    [table, column]
  );

  for (const { n } of rows) {
    await pool.query(
      `ALTER TABLE \`${table}\` DROP INDEX \`${String(n).replace(/`/g, '``')}\``
    );
  }
}


async function ensureSchema() {
  try {
    // Existing patient and test tables have already been checked.
    // Keep all existing patient records and test results unchanged.

    // Create audit_logs only if it does not already exist.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('[db] Safe schema check completed.');
    console.log('[db] Existing patient records and results preserved.');

  } catch (err) {
    console.error('[db] Schema check failed:', err.message);

    if (config.isProduction) {
      throw new Error(
        `Database schema check failed: ${err.message}`
      );
    }

    throw err;
  }
}


/* -------------------------------------------------------------------------- */
/* Default admin password preparation - local development only               */
/* -------------------------------------------------------------------------- */

const PLACEHOLDER_HASH =
  '$2y$10$T8Z.0wUuW7dC3iHkJL2SgeW6gUoQf3tU4n0fQ0k2Vz7EaJzQdD4kK';


async function ensureDefaultAdminPasswords() {
  // Automatic password changes and default account creation disabled.
  // Preserve existing administrator accounts and passwords.
  console.log('[db] Existing admin accounts preserved.');
}

