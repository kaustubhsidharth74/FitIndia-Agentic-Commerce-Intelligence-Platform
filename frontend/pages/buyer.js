import { useEffect, useState } from 'react';
import Link from 'next/link';


const API = 'http://localhost:4000/api';

const PRESETS = [
  {
    label:   'HealthBox Bot — 10x Protein',
    goal:    'Purchase 10 units of Protein Powder for bulk resale to gym clients',
    product: 'Protein Powder',
    qty:     10,
  },
  {
    label:   'HealthBox Bot — Gym Accessories Bundle',
    goal:    'Stock up on gym accessories (Gym Gloves and Resistance Bands) for a gym opening',
    product: 'Gym Gloves',
    qty:     5,
  },
  {
    label:   'HealthBox Bot — Supplement Subscription',
    goal:    'Purchase Monthly Supplement packs for distribution to premium members',
    product: 'Monthly Supplement',
    qty:     2,
  },
];

export default function BuyerPage() {
  const [catalog,   setCatalog]   = useState([]);
  const [running,   setRunning]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [syncing,   setSyncing]   = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [preset,    setPreset]    = useState(0);
  const [customGoal, setCustomGoal] = useState('');
  const [customProd, setCustomProd] = useState('');
  const [customQty,  setCustomQty]  = useState('1');
  const [mode,      setMode]      = useState('preset'); // 'preset' | 'custom'

  useEffect(() => {
    fetch(`${API}/catalog`)
      .then(r => r.json())
      .then(d => setCatalog(d.products || []));
  }, []);

  async function syncStatus() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API}/razorpay/sync-status`, { method: 'POST' });
      const data = await res.json();
      setSyncResult(data);
    } catch {
      setSyncResult({ success: false, message: 'Could not reach backend.' });
    } finally {
      setSyncing(false);
    }
  }

  async function runBuyer() {
    setRunning(true);
    setResult(null);
    setSyncResult(null);
    const body = mode === 'preset'
      ? { bot_customer_id: 4, goal: PRESETS[preset].goal, target_product_name: PRESETS[preset].product, quantity: PRESETS[preset].qty }
      : { bot_customer_id: 4, goal: customGoal, target_product_name: customProd, quantity: Number(customQty) };

    try {
      const res  = await fetch(`${API}/agent/buyer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: 'Backend unreachable' });
    } finally {
      setRunning(false);
    }
  }

  const selectStyle = {
    background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1A1A1A',
    padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer', width: '100%',
  };

  return (
    <div>


      <div className="container">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="page-title">AI Buyer Agent</h1>
          <p className="page-subtitle">
            Direction 2 — Bot reads <code style={{ color: '#1677C8' }}>GET /api/catalog</code>, reasons about what to buy, and places orders via <code style={{ color: '#1677C8' }}>POST /api/buy</code>.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left: Configuration */}
          <div>
            {/* Bot identity */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Bot Identity</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  🤖
                </div>
                <div>
                  <p style={{ fontWeight: 600 }}>HealthBox Bot</p>
                  <p style={{ color: '#6B7280', fontSize: '0.82rem' }}>Customer ID: 4 · type: bot</p>
                </div>
                <span className="badge pending" style={{ marginLeft: 'auto' }}>bot</span>
              </div>
            </div>

            {/* Mode selector */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {['preset', 'custom'].map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    style={{ flex: 1, background: mode === m ? '#0ea5e9' : '#E2E8F0', fontSize: '0.85rem' }}>
                    {m === 'preset' ? 'Preset scenarios' : 'Custom goal'}
                  </button>
                ))}
              </div>

              {mode === 'preset' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {PRESETS.map((p, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
                                            padding: '0.75rem 1rem', borderRadius: 8, background: preset === i ? '#DBEAFE' : '#F8FAFC',
                                            border: `1px solid ${preset === i ? '#0ea5e9' : '#E2E8F0'}`, width: '100%', boxSizing: 'border-box' }}>
                      <input type="radio" name="preset" checked={preset === i} onChange={() => setPreset(i)}
                        style={{ width: 16, height: 16, flexShrink: 0, flexGrow: 0, cursor: 'pointer', accentColor: '#0ea5e9' }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.2rem' }}>{p.label}</p>
                        <p style={{ color: '#6B7280', fontSize: '0.78rem' }}>{p.goal}</p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ color: '#6B7280', fontSize: '0.82rem', display: 'block', marginBottom: '0.3rem' }}>Goal</label>
                    <textarea value={customGoal} onChange={e => setCustomGoal(e.target.value)}
                      placeholder="e.g. Buy resistance bands in bulk for a new gym branch"
                      style={{ height: 80, resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
                    <div>
                      <label style={{ color: '#6B7280', fontSize: '0.82rem', display: 'block', marginBottom: '0.3rem' }}>Product</label>
                      <select value={customProd} onChange={e => setCustomProd(e.target.value)} style={selectStyle}>
                        <option value="">Pick a product</option>
                        {catalog.map(p => <option key={p.id} value={p.name}>{p.name} — ₹{p.price_inr}</option>)}
                      </select>
                    </div>
                    <div style={{ minWidth: 80 }}>
                      <label style={{ color: '#6B7280', fontSize: '0.82rem', display: 'block', marginBottom: '0.3rem' }}>Qty</label>
                      <input type="number" min="1" max="50" value={customQty} onChange={e => setCustomQty(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={runBuyer} disabled={running || (mode === 'custom' && !customGoal.trim())}
              style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}>
              {running ? 'Agent browsing catalog & placing orders…' : 'Run AI Buyer Agent →'}
            </button>
          </div>

          {/* Right: Result */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!result && !running && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, color: '#9CA3AF', textAlign: 'center', padding: '2rem' }}>
                <p style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>🤖</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 500, color: '#6B7280' }}>Select a scenario and run the agent.</p>
                <p style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>
                  The bot will read <code>/api/catalog</code> and call <code>/api/buy</code> automatically.
                </p>
              </div>
            )}

            {running && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: '#1677C8', marginBottom: '0.5rem', fontWeight: 600 }}>Agent active…</p>
                <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>Reading catalog → reasoning → placing orders</p>
              </div>
            )}

            {result && (
              <div className="card" style={{ borderColor: result.success ? '#059669' : '#DC2626', background: result.success ? '#ECFDF5' : '#FEF2F2' }}>
                {result.success ? (
                  <>
                    <p style={{ color: '#059669', fontWeight: 600, marginBottom: '0.75rem' }}>
                      {result.purchases?.length || 0} order(s) placed by {result.bot} {result.mock_ai ? '[mock AI]' : '[Claude]'}
                    </p>

                    {result.reasoning && (
                      <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
                        <p style={{ color: '#6B7280', fontSize: '0.78rem', marginBottom: '0.3rem' }}>Reasoning</p>
                        <p style={{ color: '#1A1A1A', fontSize: '0.85rem', lineHeight: 1.6 }}>{result.reasoning}</p>
                      </div>
                    )}

                    {result.purchases?.map((p, i) => (
                      <div key={i} style={{ borderTop: '1px solid #E2E8F0', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 600 }}>{p.product} x{p.quantity}</span>
                          <span style={{ color: '#1677C8', fontWeight: 700 }}>₹{p.amount_inr?.toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>Order #{p.order_id}</span>
                          <a href={p.payment_link} target="_blank" rel="noreferrer"
                            style={{ color: '#0ea5e9', fontSize: '0.82rem', fontWeight: 600 }}>
                            Pay →
                          </a>
                        </div>
                      </div>
                    ))}

                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <Link href="/audit" style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                        View in Audit Trail →
                      </Link>
                      <button
                        onClick={syncStatus}
                        disabled={syncing}
                        style={{ background: syncing ? '#E2E8F0' : '#059669', color: '#fff', fontSize: '0.78rem', padding: '0.35rem 0.85rem', borderRadius: 8, border: 'none', cursor: syncing ? 'not-allowed' : 'pointer' }}
                      >
                        {syncing ? 'Checking…' : 'I\'ve Paid — Sync Status'}
                      </button>
                      {syncResult && (
                        <span style={{ fontSize: '0.78rem', color: syncResult.synced > 0 ? '#059669' : '#6B7280', fontWeight: 600 }}>
                          {syncResult.synced > 0
                            ? `✓ ${syncResult.synced} order(s) marked as paid!`
                            : `Checked ${syncResult.checked ?? 0} — payment not yet confirmed.`}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p style={{ color: '#DC2626' }}>Error: {result.error}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Catalog preview */}
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#6B7280' }}>
            Live Catalog — <code style={{ color: '#1677C8', fontSize: '0.85rem' }}>GET /api/catalog</code>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {catalog.map(p => (
              <div key={p.id} className="card" style={{ padding: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</span>
                  <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>#{p.id}</span>
                </div>
                <p style={{ color: '#1677C8', fontWeight: 700 }}>₹{p.price_inr}</p>
                <p style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.2rem' }}>Stock: {p.stock} · {p.category}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
