import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { useFlash } from './context/FlashContext.jsx';
import { useEffect } from 'react';
import Layout from './components/Layout.jsx';
import { Loading } from './components/Status.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PatientForm from './pages/PatientForm.jsx';
import Records from './pages/Records.jsx';
import EditPatient from './pages/EditPatient.jsx';
import PatientTests from './pages/PatientTests.jsx';
import SelectTest from './pages/SelectTest.jsx';
import TestResult from './pages/TestResult.jsx';
import Report from './pages/Report.jsx';
import { DailyReport, WeeklyReport, SummaryReport } from './pages/SummaryReports.jsx';
import CancelReport from './pages/CancelReport.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AuditLog from './pages/AuditLog.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  const { setFlash } = useFlash();
  useEffect(() => {
    if (!isAdmin) setFlash('error', 'Admin access is required for this action.');
  }, [isAdmin, setFlash]);
  return isAdmin ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="patients/new" element={<PatientForm />} />
        <Route path="records" element={<Records />} />
        <Route path="patients/:id/edit" element={<EditPatient />} />
        <Route path="patients/:id/tests" element={<PatientTests />} />
        <Route path="patients/:id/select-test" element={<SelectTest />} />
        <Route path="patients/:id/report" element={<Report />} />
        <Route path="test-result/:ptId" element={<TestResult />} />
        <Route path="reports/daily" element={<DailyReport />} />
        <Route path="reports/weekly" element={<WeeklyReport />} />
        <Route path="reports/summary" element={<SummaryReport />} />
        <Route path="reports/cancelled" element={<CancelReport />} />
        <Route path="admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
        <Route path="admin/audit" element={<RequireAdmin><AuditLog /></RequireAdmin>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
