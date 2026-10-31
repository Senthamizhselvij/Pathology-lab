
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load local .env file.
// Render environment variables are supplied by the hosting service.
dotenv.config({
  path: path.join(__dirname, '..', '..', '.env'),
});

const isProduction = process.env.NODE_ENV === 'production';

// Required environment variables for Render production.
const requiredProductionVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_SSL',
  'JWT_SECRET',
];

if (isProduction) {
  const missing = requiredProductionVariables.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing production environment variables: ${missing.join(', ')}`
    );
  }

  if (
    process.env.JWT_SECRET === 'dev-only-secret-change-me' ||
    process.env.JWT_SECRET.length < 32
  ) {
    throw new Error(
      'Production JWT_SECRET must be a new random secret of at least 32 characters.'
    );
  }

  if (process.env.DB_SSL !== 'true') {
    throw new Error(
      'DB_SSL must be true for the TiDB Cloud connection.'
    );
  }
}

export const config = {
  // Node.js application port.
  // Render supplies its own PORT automatically.
  port: Number(process.env.PORT) || 5000,

  // TiDB Cloud / MySQL database configuration.
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'pathology_lab',

    // Enable SSL for TiDB Cloud.
    ssl: process.env.DB_SSL === 'true',
  },

  // JWT authentication.
  jwtSecret:
    process.env.JWT_SECRET || 'dev-only-secret-change-me',

  jwtExpiresIn: '12h',

  cookieMaxAgeMs: 12 * 60 * 60 * 1000,

  // Database schema file.
  schemaFile: path.join(
    __dirname,
    '..',
    '..',
    'database',
    'schema.sql'
  ),

  // React production build folder.
  clientDist: path.join(
    __dirname,
    '..',
    '..',
    'frontend',
    'dist'
  ),

  isProduction,
};
