import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

const API = 'http://localhost:4000/api';
const PAGE_SIZE = 10;

function RiskBadge({ level, score }) {
  const styles = {
    high:   { bg: 'rgba(239,68,68,0.12)',   color: '#DC2626', border: 'rgba(239,68,68,0.3)' },
    medium: { bg: 'rgba(251,191,36,0.12)',  color: '#D97706', border: 'rgba(251,191,36,0.3)' },
    low:    { bg: 'rgba(52,211,153,0.12)',  color: '#059669', border: 'rgba(52,211,153,0.3)' },
  };
  const s = styles[level] || styles.low;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {level === 'high' ? '⚠' : level === 'medium' ? '◉' : '✓'} {score}/100
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    held:    { bg: 'rgba(239,68,68,0.12)',  color: '#DC2626', border: 'rgba(239,68,68,0.25)',  label: 'BLOCKED' },
    paid:    { bg: 'rgba(52,211,153,0.12)', color: '#059669', border: 'rgba(52,211,153,0.25)', label: 'PAID' },
    pending: { bg: 'rgba(251,191,36,0.12)', color: '#D97706', border: 'rgba(251,191,36,0.25)', label: 'PENDING' },
    failed:  { bg: 'rgba(239,68,68,0.12)',  color: '#DC2626', border: 'rgba(239,68,68,0.25)',  label: 'FAILED' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      padding: '0.15rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}

function ScoreBar({ score }) {
  const color = score >= 80 ? '#DC2626' : score >= 40 ? '#D97706' : '#059669';
  return (
    <div style={{ width: '80px', height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
    </div>
  );
}

export default function FraudPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [actionResult, setActionResult] = useState({});
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/fraud/orders`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleBlock(orderId) {
    setActionLoading(l => ({ ...l, [orderId]: 'blocking' }));
    const res = await fetch(`${API}/fraud/block/${orderId}`, { method: 'POST' });
    const json = await res.json();
    setActionResult(r => ({ ...r, [orderId]: { type: 'block', ...json } }));
    setActionLoading(l => ({ ...l, [orderId]: null }));
    fetchData();
  }

  async function handleApprove(orderId) {
    setActionLoading(l => ({ ...l, [orderId]: 'approving' }));
    const res = await fetch(`${API}/fraud/approve/${orderId}`, { method: 'POST' });
    const json = await res.json();
    setActionResult(r => ({ ...r, [orderId]: { type: 'approve', ...json } }));
    setActionLoading(l => ({ ...l, [orderId]: null }));
    fetchData();
  }

  const orders = data?.orders || [];
  const summary = data?.summary || {};

  const filtered = filter === 'all' ? orders
    : filter === 'high' ? orders.filter(o => o.risk_level === 'high')
    : filter === 'blocked' ? orders.filter(o => o.order?.status === 'held')
    : orders.filter(o => o.reasons?.some(r => r.includes('velocity')));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div>
      <div className="container">

        {/* ── Header ── */}
        <div className="fail-header">
          <div>
            <h1 className="page-title">Fraud Detection</h1>
            <p className="page-subtitle">
              Real-time risk scoring on every order — velocity checks, payment pattern analysis, and auto-blocking.
            </p>
          </div>
          <Link href="/audit" className="fail-audit-link">View Audit Trail →</Link>
        </div>

        {/* ── Stats Row ── */}
        {!loading && (
          <div className="fail-stats-row">
            {[
              { label: 'Total Scanned',    value: summary.total || 0,  color: '#1677C8' },
              { label: 'High Risk',        value: summary.high || 0,   color: '#DC2626' },
              { label: 'Medium Risk',      value: summary.medium || 0, color: '#D97706' },
              { label: 'Amount at Risk',   value: `₹${((summary.amount_at_risk_paise || 0) / 100).toLocaleString('en-IN')}`, color: '#DC2626' },
            ].map(s => (
              <div key={s.label} className="fail-stat-card">
                <div className="fail-stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="fail-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── How It Works ── */}
        <div className="fail-flow-wrap">
          <h3 className="fail-section-label">How It Works</h3>
          <div className="fail-flow">
            {[
              { icon: '⚡', color: '#1677C8', bg: 'rgba(22,119,200,0.1)', title: 'Order Placed',     desc: 'Every order is scored instantly on creation' },
              { icon: '⚖', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', title: 'Risk Scored',      desc: 'Velocity, payment patterns & amount analysed' },
              { icon: '⚠', color: '#D97706', bg: 'rgba(251,191,36,0.1)', title: 'Score > 80',        desc: 'Order automatically held, merchant alerted' },
              { icon: '✓', color: '#059669', bg: 'rgba(52,211,153,0.1)', title: 'Merchant Reviews',  desc: 'Block permanently or approve the order' },
            ].map((s, i) => (
              <div key={s.title} className="fail-flow-step" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
                <div className="fail-flow-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                <div className="fail-flow-title">{s.title}</div>
                <div className="fail-flow-desc">{s.desc}</div>
                {i < 3 && <div className="fail-flow-arrow">→</div>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Filter Tabs ── */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all',      label: `All Orders (${orders.length})` },
            { key: 'high',     label: `High Risk (${summary.high || 0})` },
            { key: 'velocity', label: 'Velocity Fraud' },
            { key: 'blocked',  label: 'Blocked' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setPage(1); }}
              style={{
                padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                background: filter === tab.key ? '#1677C8' : 'rgba(255,255,255,0.05)',
                color: filter === tab.key ? '#fff' : 'var(--text-muted)',
                borderColor: filter === tab.key ? '#1677C8' : 'rgba(255,255,255,0.1)',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Orders Table ── */}
        <div className="fail-orders-section">
          <div className="fail-table-wrap">
            {/* Header */}
            <div className="fail-thead">
              <span>Customer</span>
              <span>Product</span>
              <span className="fail-center">Order #</span>
              <span className="fail-center">Status</span>
              <span className="fail-center">Risk Score</span>
              <span className="fail-right">Amount</span>
              <span className="fail-center">Actions</span>
            </div>

            {loading ? (
              <div className="fail-empty">Scanning orders...</div>
            ) : filtered.length === 0 ? (
              <div className="fail-empty">No orders match this filter.</div>
            ) : (
              paginated.map((item, i) => {
                const o = item.order;
                const isHeld = o.status === 'held';
                return (
                  <div key={o.id}>
                    <div
                      className="fail-row"
                      style={{
                        animationDelay: `${0.04 + i * 0.04}s`,
                        borderLeft: item.risk_level === 'high' ? '3px solid #DC2626'
                          : item.risk_level === 'medium' ? '3px solid #D97706'
                          : '3px solid transparent',
                      }}
                    >
                      <div className="fail-cell fail-product-name">{o.customer_name || '—'}</div>
                      <div className="fail-cell" style={{ fontSize: '0.81rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.product_name || '—'}</div>
                      <div className="fail-cell fail-center fail-order-id">#{o.id}</div>
                      <div className="fail-cell fail-center"><StatusBadge status={o.status} /></div>
                      <div className="fail-cell fail-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <RiskBadge level={item.risk_level} score={item.score} />
                        <ScoreBar score={item.score} />
                      </div>
                      <div className="fail-cell fail-amount" style={{ textAlign: 'right' }}>₹{(o.total_paise / 100).toLocaleString('en-IN')}</div>
                      <div className="fail-cell fail-actions">
                        {!isHeld && item.risk_level !== 'low' && (
                          <button
                            className="fail-btn danger"
                            disabled={!!actionLoading[o.id]}
                            onClick={() => handleBlock(o.id)}
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
                          >
                            {actionLoading[o.id] === 'blocking' ? 'Blocking...' : 'Block'}
                          </button>
                        )}
                        {isHeld && (
                          <button
                            className="fail-btn retry"
                            disabled={!!actionLoading[o.id]}
                            onClick={() => handleApprove(o.id)}
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
                          >
                            {actionLoading[o.id] === 'approving' ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Risk reasons */}
                    {item.reasons?.length > 0 && (
                      <div style={{
                        padding: '0.5rem 1rem 0.5rem 1.25rem',
                        background: item.risk_level === 'high' ? 'rgba(239,68,68,0.04)' : 'rgba(251,191,36,0.04)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
                      }}>
                        {item.reasons.map((r, ri) => (
                          <span key={ri} style={{
                            fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                            background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}>
                            {r}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action result */}
                    {actionResult[o.id] && (
                      <div className={`fail-result-panel ${actionResult[o.id].success ? (actionResult[o.id].type === 'block' ? 'danger' : 'success') : 'danger'}`}>
                        <span className="fail-result-icon">{actionResult[o.id].type === 'block' ? '⛔' : '✓'}</span>
                        <span>{actionResult[o.id].message || actionResult[o.id].error}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '1.25rem 0 0.5rem' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  width: '36px', height: '36px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', border: '1px solid',
                  background: safePage === p ? '#1677C8' : 'rgba(255,255,255,0.05)',
                  color: safePage === p ? '#fff' : 'var(--text-muted)',
                  borderColor: safePage === p ? '#1677C8' : 'rgba(255,255,255,0.1)',
                  transition: 'all 0.15s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
