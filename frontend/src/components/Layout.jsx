import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Flash from './Flash.jsx';

function HubSearch({ field, placeholder }) {
  const navigate = useNavigate();
  return (
    <div className="hub-search-group">
      <form
        className="hub-search-form"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get(field).toString().trim();
          navigate(value ? `/records?${field}=${encodeURIComponent(value)}` : '/records');
          e.currentTarget.reset();
        }}
      >
        <input type="text" name={field} className="hub-search-input" placeholder={placeholder} />
        <button type="submit" className="btn-hub-go">Go</button>
      </form>
    </div>
  );
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();

  const onLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) await logout();
  };

  return (
    <>
      <header className="portal-navbar no-print">
        <div className="portal-navbar-inner">
          <Link to="/dashboard" className="portal-brand">
            <span className="portal-brand-icon">💙</span>
            <span className="portal-brand-text">Clinic Portal</span>
          </Link>
          <div className="portal-nav-right">
            <span className="portal-user-tag">User: <strong>{user?.username}</strong></span>
            {isAdmin && (
              <>
                <Link to="/admin/users" className="btn btn-outline" style={{ marginRight: 8 }}>👥 User Management</Link>
                <Link to="/admin/audit" className="btn btn-outline" style={{ marginRight: 8 }}>🧾 Activity Log</Link>
              </>
            )}
            <button type="button" className="btn-secure-logout" onClick={onLogout}>🔒 Logout</button>
          </div>
        </div>
      </header>

      <div className="portal-layout">
        <aside className="patient-hub-sidebar no-print">
          <div className="hub-title">PATIENT HUB</div>
          <div className="hub-top-buttons">
            <Link to="/patients/new" className="btn-hub-add">+ Add New</Link>
            <Link to="/records" className="btn-hub-view">📋 View All</Link>
          </div>

          <HubSearch field="receipt_id" placeholder="Find by Receipt ID..." />
          <HubSearch field="patient_id" placeholder="Find by Patient ID..." />
          <HubSearch field="patient_name" placeholder="Find patient by name..." />
          <HubSearch field="phone" placeholder="Find patient by phone..." />

          <div className="hub-report-label">REPORT</div>
          <Link to="/reports/daily" className="hub-report-btn">Daily Report</Link>
          <Link to="/reports/weekly" className="hub-report-btn">Weekly Report</Link>
          <Link to="/reports/summary" className="hub-report-btn">Summary Report</Link>
          <Link to="/reports/cancelled" className="hub-report-btn">Cancel Report</Link>
        </aside>

        <main className="portal-main-content">
          <Flash />
          <Outlet />
        </main>
      </div>

      <footer className="no-print" style={{ textAlign: 'center', padding: '25px 0', fontSize: '0.85rem', color: '#94a3b8', borderTop: '1px solid #e2e8f0', background: '#ffffff', marginTop: 'auto' }}>
        <p>&copy; {new Date().getFullYear()} Clinic Portal &bull; Pathology Laboratory Management System</p>
      </footer>
    </>
  );
}
