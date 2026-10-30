import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useFlash } from '../context/FlashContext.jsx';
import { useFetch, usePageTitle } from '../hooks/useFetch.js';
import { formatCurrency } from '../utils/format.js';
import { ErrorBox, Loading } from '../components/Status.jsx';

export default function SelectTest() {
  usePageTitle('Add Laboratory Test');
  const { id } = useParams();
  const navigate = useNavigate();
  const { setFlash } = useFlash();
  const [sp, setSp] = useSearchParams();
  const search = sp.get('search') || '';
  const [text, setText] = useState(search);
  const [adding, setAdding] = useState(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [lockingBudget, setLockingBudget] = useState(false);
  useEffect(() => setText(search), [search]);

  const { data, error, reload } = useFetch(() => api.get(`/patients/${id}/available-tests`, { search }), [id, search]);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const { patient, tests, assigned } = data;
  const budgetLocked = patient.test_budget !== null && patient.test_budget !== undefined && patient.test_budget !== '';
  const remainingBudget = budgetLocked ? Number(data.remainingBudget ?? patient.test_budget) : null;
  const visibleTests = budgetLocked ? tests.filter((test) => Number(test.price) <= remainingBudget + 0.0001) : [];

  const lockBudget = async (e) => {
    e.preventDefault();
    const amount = Number(budgetInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFlash('error', 'Enter a valid amount greater than ₹0.');
      return;
    }
    setLockingBudget(true);
    try {
      await api.put(`/patients/${id}/test-budget`, { test_budget: amount });
      setFlash('success', `Budget ₹${amount.toFixed(2)} locked. It cannot be changed.`);
      setBudgetInput('');
      reload();
    } catch (err) {
      setFlash('error', err.message);
    } finally {
      setLockingBudget(false);
    }
  };

  const addTest = async (testId) => {
    setAdding(testId);
    try {
      await api.post(`/patients/${id}/tests`, { test_id: testId });
      setFlash('success', 'Test added. You can add another test or click Done.');
      setAdding(null);
      reload();
    } catch (err) {
      setFlash('error', err.message);
      setAdding(null);
    }
  };

  return (
    <div className="portal-card">
      <div className="page-head">
        <div>
          <h2 className="portal-card-title">Add Laboratory Test</h2>
          <p className="portal-card-subtitle" style={{ marginBottom: 0 }}>
            {patient.patient_name} · Patient ID: <strong>{patient.patient_code}</strong> · Receipt ID: <strong>{patient.receipt_id}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/patients/${id}/tests`} className="btn btn-outline">&larr; Back</Link>
          <Link to={`/patients/${id}/tests`} className="btn btn-success">Done</Link>
        </div>
      </div>

      {!budgetLocked ? (
        <form onSubmit={lockBudget} style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '0 0 20px', flexWrap: 'wrap' }}>
          <label htmlFor="test-budget" style={{ fontWeight: 700 }}>Set total test amount (₹)</label>
          <input id="test-budget" type="number" min="1" step="0.01" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="e.g. 100" required
            style={{ width: 170, padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 15 }} />
          <button type="submit" className="btn btn-primary" disabled={lockingBudget}>{lockingBudget ? 'Locking...' : 'Set & Lock Amount'}</button>
          <p style={{ flexBasis: '100%', margin: '0', color: '#64748b' }}>The amount can be set only once, before adding tests. The app will show only tests that fit the remaining balance.</p>
        </form>
      ) : (
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 18px', padding: 14, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8 }}>
          <div><div style={{ color: '#64748b', fontSize: 13 }}>Locked total amount</div><strong>{formatCurrency(patient.test_budget)}</strong></div>
          <div><div style={{ color: '#64748b', fontSize: 13 }}>Amount used</div><strong>{formatCurrency(Number(patient.test_budget) - remainingBudget)}</strong></div>
          <div><div style={{ color: '#64748b', fontSize: 13 }}>Remaining balance</div><strong>{formatCurrency(remainingBudget)}</strong></div>
          <span className="badge badge-completed">AMOUNT LOCKED</span>
        </div>
      )}

      <form
        style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '0 0 20px', flexWrap: 'wrap' }}
        onSubmit={(e) => {
          e.preventDefault();
          setSp(text.trim() ? { search: text.trim() } : {});
        }}
      >
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search test name..." autoComplete="off"
          style={{ flex: 1, minWidth: 220, padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 15 }} />
        <button type="submit" className="btn btn-primary">Search Test</button>
        {search !== '' && <Link to={`/patients/${id}/select-test`} className="btn btn-outline">Clear Search</Link>}
      </form>

      {budgetLocked && (
        <p style={{ margin: '-8px 0 16px', color: '#475569' }}>
          Showing tests priced at <strong>{formatCurrency(remainingBudget)}</strong> or less, based on your remaining locked balance.
        </p>
      )}
      {!budgetLocked && <p style={{ margin: '0 0 16px', color: '#64748b' }}>Lock a total amount first to view eligible tests.</p>}

      <div className="test-card-grid">
        {visibleTests.map((test) => {
          const a = assigned[test.id];
          return (
            <div className="test-card" key={test.id}>
              <div>
                <h4>{test.test_name}</h4>
                <div className="price">Test Amount: {formatCurrency(test.price)}</div>
              </div>
              <div>
                {a ? (
                  <>
                    <span className={`badge badge-block ${a.status === 'COMPLETED' ? 'badge-completed' : 'badge-pending'}`}>
                      {a.status === 'COMPLETED' ? 'ADDED - RESULT SAVED' : 'ADDED - RESULT PENDING'}
                    </span>
                    <Link to={`/test-result/${a.patient_test_id}`} className="btn btn-outline" style={{ width: '100%' }}>Open Result</Link>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary" style={{ width: '100%' }} disabled={adding !== null} onClick={() => addTest(test.id)}>
                    {adding === test.id ? 'Adding...' : '+ ADD TEST'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {visibleTests.length === 0 && (
          <p style={{ gridColumn: '1 / -1', padding: 16, color: '#64748b' }}>
            No available tests fit the remaining locked balance. Choose an eligible lower-priced test or finish this patient's test selection.
          </p>
        )}
      </div>
    </div>
  );
}
