import mysql from 'mysql2/promise';
import { config } from './src/config.js';

async function testConnection() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
      charset: 'utf8mb4',
      ssl: config.db.ssl
        ? { minVersion: 'TLSv1.2' }
        : undefined,
    });

    const [result] = await connection.query(
      'SELECT DATABASE() AS database_name'
    );

    console.log('Database connected:', result[0].database_name);

    const [tables] = await connection.query('SHOW TABLES');

    console.log('Tables found:', tables.length);
    console.table(tables);

  } catch (error) {
    console.error('Connection failed:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

testConnection();