import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  port: Number(process.env.PORT) || 5000,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'pathology_lab',
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: '12h',
  cookieMaxAgeMs: 12 * 60 * 60 * 1000,
  schemaFile: path.join(__dirname, '..', '..', 'database', 'schema.sql'),
  clientDist: path.join(__dirname, '..', '..', 'client', 'dist'),
  isProduction: process.env.NODE_ENV === 'production',
};
