# Pathology Laboratory Management System — React + Node.js + Express + MySQL

Same application as the PHP version, rebuilt as:

| Part | Technology |
|---|---|
| Frontend | React 18, React Router, Vite, the original CSS |
| Backend API | Node.js + Express |
| Database | **MySQL** (same schema as before — `database/schema.sql`) |

> You asked about MySQL instead of MongoDB: the original app already used MySQL, so nothing changes. Your existing database works as-is.

## Quick start

Requirements: **Node.js 18+** and a running **MySQL** (XAMPP's MySQL is fine).

```bash
npm run install:all          # installs root, server and client packages
cp backend/.env.example backend/.env     # (Windows: copy) then edit DB_PASSWORD / DB_PORT / JWT_SECRET
npm run build                # builds the React app
npm start                    # open http://localhost:5000
```

Development (auto-reload): `npm run dev` → React on http://localhost:5173, API on :5000.

On first start the server creates the `pathology_lab` database, imports `database/schema.sql`, and upgrades older databases automatically.
Windows users can double-click `START_APP.bat` instead.

**Login:** `admin` / `admin123` (or `5001` / `admin123`). Change it in *User Management*.

## Using your existing XAMPP database
Point `backend/.env` at it (`DB_PORT=3307` if XAMPP uses 3307). Back it up first (`BACKUP_DATABASE.bat`). Patients, tests and results are untouched.

## Folder layout
```
database/schema.sql      tables + test catalog (unchanged)
backend/src/routes/       auth, patients, patientTests, patientReport, reports, admin
backend/src/utils/range.js  reference-range / out-of-range logic (port of the PHP functions)
frontend/src/pages/        one React page per old PHP page
docs/                    business-rule notes from the original project
```

## Deliberate differences from the PHP version
1. **Login bypass removed.** The PHP login accepted `admin123` for admin/5001 forever, even after a password change. Now the default accounts get a real hashed `admin123` on first run and only the stored password works (the original admin guide said this bypass was meant to be removed).
2. **Final submit keeps a Report Date you chose** (PHP overwrote it with today). It only fills today's date if none was set.
3. Server now refuses: adding tests after final submit, editing a cancelled report, removing a test that already has a result (the PHP only hid those buttons).
4. Daily report no longer shows "1 PENDING" for a patient with no tests.
5. Sessions are a signed httpOnly cookie (12 h); a deleted user or changed role takes effect immediately; login is rate-limited.

## Hosting note (important)

This project has separate `frontend/` (React) and `backend/` (Node.js + Express API) folders. InfinityFree shared hosting supports PHP/MySQL, but does not run a persistent Node.js/Express backend. Therefore this React + Node.js version cannot run fully on InfinityFree alone. To deploy this version, host the frontend on a static hosting service and the backend on a Node.js-capable service, with a MySQL database reachable by the backend; alternatively, use the separate PHP version for all-in-one InfinityFree hosting. Do not upload database passwords or `.env` files into the public frontend.

## Recent updates
- Patient age accepts one decimal place (for example, `4.5` years). Existing databases are upgraded automatically by the backend on startup.
- Test budget is set once per patient before adding tests. It is stored in MySQL and cannot be changed through the app after locking. The test picker shows only tests priced at or below the remaining balance, and the API blocks any test that would exceed that balance.
- Patient report letterhead keeps the existing Lalaji image placement and displays the Society, founding line, Hindi name, clinic name, address, and telephone number.
- Patient report shows age and uses only two aligned signatures: Lab Technician on the left and Pathologist on the right.
