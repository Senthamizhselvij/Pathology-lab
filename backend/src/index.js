
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { initDatabase } from './db.js';

import { requireAuth, requireAdminRole } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import patientReportRoutes from './routes/patientReport.js';
import patientTestRoutes from './routes/patientTests.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';

const app = express();

app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Public authentication routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/patients', requireAuth, patientRoutes);
app.use('/api/patients', requireAuth, patientReportRoutes);
app.use('/api/patient-tests', requireAuth, patientTestRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/admin', requireAuth, requireAdminRole, adminRoutes);

// API 404 handler
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Serve the built React frontend
const indexPath = path.join(config.clientDist, 'index.html');

if (fs.existsSync(indexPath)) {
  app.use(express.static(config.clientDist));

  app.get('*', (_req, res, next) => {
    res.sendFile(indexPath, (err) => {
      if (err) next(err);
    });
  });
} else {
  console.warn(
    `[!] React build not found at ${indexPath}. Run npm run build in the client folder.`
  );
}

// Central error handler
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  const status = err.status || 500;

  if (status >= 500) {
    console.error(err);
  }

  return res.status(status).json({
    error:
      status >= 500
        ? 'Something went wrong on the server. Please try again.'
        : err.message,
    ...(err.extra || {}),
  });
});

async function start() {
  try {
    await initDatabase();
  } catch (err) {
    console.error('\n[!] Could not connect to MySQL:', err.message);
    console.error(
      `    Host: ${config.db.host}:${config.db.port}, ` +
      `user: "${config.db.user}", database: "${config.db.name}".`
    );
    console.error('    Check that MySQL is running in XAMPP.');
    console.error('    Verify the database settings in backend/.env.');
    console.error('    XAMPP may use port 3307 instead of 3306.\n');

    process.exit(1);
  }

  if (
    !config.isProduction &&
    config.jwtSecret === 'dev-only-secret-change-me'
  ) {
    console.warn(
      '[!] Using the default JWT_SECRET. Set a secure value in backend/.env.'
    );
  }

  app.listen(config.port, () => {
    console.log(
      `\nPathology Lab is running: http://localhost:${config.port}`
    );
    console.log('Check database connection and login credentials in your setup.\n');
  });
}

start();
