import { Link } from 'react-router-dom';

export function Loading({ text = 'Loading...' }) {
  return <div className="loading">{text}</div>;
}

export function ErrorBox({ error, backTo = '/dashboard', backLabel = 'Back to Dashboard' }) {
  if (!error) return null;
  return (
    <div className="portal-card">
      <div className="error-box">{error.message || String(error)}</div>
      <Link to={backTo} className="btn btn-outline">{backLabel}</Link>
    </div>
  );
}
