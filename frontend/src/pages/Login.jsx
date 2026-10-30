import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageTitle } from '../hooks/useFetch.js';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('5001');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  usePageTitle('Login');

  // The login page uses a full-screen centred background.
  useEffect(() => {
    document.body.classList.add('login-page-wrap');
    return () => document.body.classList.remove('login-page-wrap');
  }, []);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) return setError('Please enter your Username / Employee ID.');
    if (!password) return setError('Please enter your password.');
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login-card-container">
      <div className="login-clinic-header">
        <div className="login-clinic-avatar" title="Lala Lajpat Rai">
          <img src="/images/lalajinew21.png" alt="Lala Lajpat Rai" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
        </div>
        <div className="login-clinic-info">
          <div className="login-soc-title">SERVANTS OF THE PEOPLE SOCIETY</div>
          <div className="login-soc-founded">Founded by Punjab Kesari Lala Lajpat Rai in 1921</div>
          <div className="login-soc-hindi">लोक सेवक मंडल</div>
          <div className="login-clinic-name">Major Gen. B. N. Bhandari Charitable Medical Clinic</div>
          <div className="login-clinic-address">Lajpat Bhawan, Lajpat Nagar IV, New Delhi</div>
          <div className="login-clinic-phone">📞 011-26434175</div>
        </div>
      </div>

      <div className="login-blue-bar">Pathology Lab System Login</div>

      <form onSubmit={onSubmit}>
        {error && <div className="alert alert-danger"><span>{error}</span></div>}

        <div className="form-group">
          <label htmlFor="username" className="form-label">Username / Employee ID</label>
          <input id="username" className="form-control" placeholder="5001" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </div>

        <div className="form-group" style={{ marginBottom: 25 }}>
          <label htmlFor="password" className="form-label">Password</label>
          <input id="password" type="password" className="form-control" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button type="submit" className="btn-secure-login" disabled={busy}>
          {busy ? 'Processing...' : '🔒  Login'}
        </button>
      </form>
    </div>
  );
}
