import { useState } from 'react';

const API = 'http://localhost:4000/api';

const STATUS_STYLE = {
  reminded: { bg: 'rgba(16,185,129,0.12)', color: '#059669' },
  skipped:  { bg: 'rgba(51,149,255,0.10)', color: '#2878CC' },
  error:    { bg: 'rgba(239,68,68,0.12)', color: '#DC2626' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { bg: '#F1F5F9', color: '#6B7280' };
  return (
    <span style={{ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: 999,
                   fontSize: '0.75rem', fontWeight: 600, background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

export default function Campaign() {
  const [running,  setRunning]  = useState(false);
  const [summary,  setSummary]  = useState(null);
  const [runCount, setRunCount] = useState(0);

  async function runCampaign() {
    setRunning(true);
    try {
      const res  = await fetch(`${API}/agent/campaign`, { method: 'POST' });
      const data = await res.json();
      setSummary(data);
      setRunCount(n => n + 1);
    } catch {
      setSummary({ success: false, error: 'Backend unreachable' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>


      <div className="container">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">Campaign Orchestrator</h1>
            <p className="page-subtitle">
              Direction 4 — AI scans for abandoned carts and sends personalised recovery payment links.
            </p>
          </div>
          <button onClick={runCampaign} disabled={running} style={{ padding: '0.7rem 1.5rem', fontSize: '1rem' }}>
            {running ? 'Agent running…' : runCount === 0 ? 'Run Campaign Agent →' : 'Run Again →'}
          </button>
        </div>

        {/* How it works */}
        {!summary && (
          <div className="card" style={{ color: '#6B7280', lineHeight: 1.8 }}>
            <h3 style={{ color: '#1A1A1A', marginBottom: '0.75rem' }}>How it works</h3>
            <ol style={{ paddingLeft: '1.25rem' }}>
              <li>Scans for pending orders older than the configured age threshold</li>
              <li>Skips orders already reminded 3× (anti-spam guardrail)</li>
              <li>Creates a fresh Razorpay payment link per abandoned order</li>
              <li>Logs every action to the audit trail with reasoning + reminder message</li>
              <li>On subsequent runs, detects and logs orders that converted after a reminder</li>
            </ol>
            <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#9CA3AF' }}>
              CAMPAIGN_MIN_AGE_HOURS is set to 0 in dev mode — all pending orders are eligible.
            </p>
          </div>
        )}

        {/* Summary stats */}
        {summary?.success && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Abandoned Found',    value: summary.abandoned_found,    color: '#D97706' },
                { label: 'Reminders Sent',     value: summary.reminded,           color: '#059669' },
                { label: 'Skipped (max 3×)',   value: summary.skipped,            color: '#93c5fd' },
                { label: 'Conversions Logged', value: summary.conversions_logged, color: '#c084fc' },
              ].map(t => (
                <div key={t.label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: t.color }}>{t.value}</div>
                  <div style={{ color: '#6B7280', fontSize: '0.78rem', marginTop: '0.2rem' }}>{t.label}</div>
                </div>
              ))}
            </div>

            {/* Results table */}
            {summary.results?.length > 0 ? (
              <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '1.25rem' }}>Order</th>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Amount</th>
                      <th>Attempt #</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.results.map(r => (
                      <tr key={r.order_id}>
                        <td style={{ paddingLeft: '1.25rem', color: '#475569', fontSize: '0.8rem' }}>#{r.order_id}</td>
                        <td style={{ fontSize: '0.85rem' }}>{r.customer}</td>
                        <td style={{ fontSize: '0.85rem' }}>{r.product}</td>
                        <td style={{ fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
                          {r.amount_inr ? `₹${r.amount_inr.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                          {r.attempt ?? '—'}
                        </td>
                        <td style={{ maxWidth: 280, color: '#6B7280', fontSize: '0.8rem' }}>
                          {r.message || r.reason || '—'}
                        </td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>
                          {r.payment_link ? (
                            <a href={r.payment_link} target="_blank" rel="noreferrer"
                              style={{ color: '#1677C8', fontSize: '0.82rem' }}>Pay →</a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>
                No pending orders found to process.
              </div>
            )}
          </>
        )}

        {summary && !summary.success && (
          <div className="card" style={{ borderColor: '#7f1d1d', background: '#1a0e0e' }}>
            <p style={{ color: '#DC2626' }}>Error: {summary.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
