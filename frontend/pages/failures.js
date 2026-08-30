import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = 'http://localhost:4000/api';

function StatusBadge({ status }) {
  const styles = {
    paid:    { bg: 'rgba(52, 211, 153, 0.12)', color: '#059669', border: 'rgba(52, 211, 153, 0.25)' },
    failed:  { bg: 'rgba(239, 68, 68, 0.12)', color: '#DC2626', border: 'rgba(239, 68, 68, 0.25)' },
    pending: { bg: 'rgba(251, 191, 36, 0.12)', color: '#D97706', border: 'rgba(251, 191, 36, 0.25)' },
  };
  const s = styles[status] || styles.pending;
  return (
    <span className="fail-badge" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {status}
    </span>
  );
}

function StepLog({ steps }) {
  if (!steps?.length) return null;
  const ICONS = {
    payment_failed: { icon: '✗', color: '#DC2626' },
    retry_attempt:  { icon: '↺', color: '#D97706' },
    retry_result:   { icon: '↺', color: '#D97706' },
    merchant_alert: { icon: '⚠', color: '#fb923c' },
  };
  return (
    <div className="fail-steps">
      {steps.map((s, i) => {
        const meta = ICONS[s.step] || { icon: '•', color: '#6B7280' };
        const dotColor = s.status === 'success' ? '#059669' : s.status === 'failed' ? '#DC2626' : '#D97706';
        return (
          <div key={i} className="fail-step">
            <span className="fail-step-icon" style={{ color: meta.color }}>{meta.icon}</span>
            <span className="fail-step-dot" style={{ background: dotColor }} />
            <span className="fail-step-msg">{s.message}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function FailuresPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simResult, setSimResult] = useState({});
  const [retryResult, setRetryResult] = useState({});
  const [running, setRunning] = useState({});
  const [forceRetryFail, setForceRetryFail] = useState(false);

  async function fetchOrders() {
    const res = await fetch(`${API}/razorpay/orders`);
    const d = await res.json();
    setOrders(d.orders || []);
    setLoading(false);
  }

  useEffect(() => { fetchOrders(); }, []);

  const sureshOrders = orders.filter(o => o.customer_name === 'Suresh Reddy');
  const otherFailed = orders.filter(o => o.status === 'failed' && o.customer_name !== 'Suresh Reddy');
  const failedCount = orders.filter(o => o.status === 'failed').length;

  async function simulateFailure(orderId) {
    setRunning(r => ({ ...r, [`sim_${orderId}`]: true }));
    const res = await fetch(`${API}/agent/simulate-failure`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    });
    const data = await res.json();
    setSimResult(r => ({ ...r, [orderId]: data }));
    setRunning(r => ({ ...r, [`sim_${orderId}`]: false }));
    await fetchOrders();
  }

  async function runRetry(orderId) {
    setRunning(r => ({ ...r, [`retry_${orderId}`]: true }));
    const res = await fetch(`${API}/agent/retry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, force_retry_fail: forceRetryFail }),
    });
    const data = await res.json();
    const result = data.results?.[0];
    setRetryResult(r => ({ ...r, [orderId]: result || data }));
    setRunning(r => ({ ...r, [`retry_${orderId}`]: false }));
    await fetchOrders();
  }

  return (
    <div>
      <div className="container">
        {/* ── Header ── */}
        <div className="fail-header">
          <div>
            <h1 className="fail-title">Failure & Recovery</h1>
            <p className="fail-subtitle">
              Simulate payment failures, trigger the retry agent, and watch merchant alerts fire.
            </p>
          </div>
          <Link href="/audit" className="fail-audit-link">View Audit Trail →</Link>
        </div>

        {/* ── Stats Row ── */}
        <div className="fail-stats-row">
          {[
            { label: 'Total Orders', value: orders.length, color: '#1677C8' },
            { label: 'Failed', value: failedCount, color: '#DC2626' },
            { label: "Suresh's Orders", value: sureshOrders.length, color: '#8B5CF6' },
            { label: 'Other Failed', value: otherFailed.length, color: '#FB923C' },
          ].map(s => (
            <div key={s.label} className="fail-stat-card">
              <div className="fail-stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="fail-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── How It Works — Visual Flow ── */}
        <div className="fail-flow-wrap">
          <h3 className="fail-section-label">How It Works</h3>
          <div className="fail-flow">
            {[
              { icon: '✗', color: '#DC2626', bg: 'rgba(248,113,113,0.08)', title: 'Payment Fails', desc: 'Order marked failed & logged to audit' },
              { icon: '↺', color: '#D97706', bg: 'rgba(251,191,36,0.08)', title: 'Agent Retries', desc: 'Retry agent creates a new payment link' },
              { icon: '✓', color: '#059669', bg: 'rgba(52,211,153,0.08)', title: 'Retry Succeeds', desc: 'Customer gets fresh link, order recovers' },
              { icon: '⚠', color: '#fb923c', bg: 'rgba(251,146,60,0.08)', title: 'Or Alert Fires', desc: 'Merchant notified on dashboard if retry fails' },
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

        {/* ── Retry Scenario Toggle ── */}
        <div className="fail-scenario-wrap">
          <h3 className="fail-section-label">Retry Scenario</h3>
          <div className="fail-scenario-options">
            <button
              className={`fail-scenario-card ${!forceRetryFail ? 'active' : ''}`}
              onClick={() => setForceRetryFail(false)}
            >
              <div className="fail-scenario-icon" style={{ background: 'rgba(52,211,153,0.1)', color: '#059669' }}>✓</div>
              <div>
                <div className="fail-scenario-title">Retry Succeeds</div>
                <div className="fail-scenario-desc">New payment link issued, order recovers</div>
              </div>
            </button>
            <button
              className={`fail-scenario-card ${forceRetryFail ? 'active' : ''}`}
              onClick={() => setForceRetryFail(true)}
            >
              <div className="fail-scenario-icon" style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>⚠</div>
              <div>
                <div className="fail-scenario-title">Retry Also Fails</div>
                <div className="fail-scenario-desc">Merchant alert raised on dashboard</div>
              </div>
            </button>
          </div>
        </div>

        {/* ── Orders Table ── */}
        <div className="fail-orders-section">
          <h3 className="fail-section-label">Suresh Reddy's Orders</h3>
          <div className="fail-table-wrap">
            <div className="fail-thead">
              <span>Product</span>
              <span className="fail-center">Order #</span>
              <span className="fail-center">Status</span>
              <span className="fail-right">Amount</span>
              <span className="fail-center">Actions</span>
            </div>

            {loading ? (
              <div className="fail-empty">Loading orders...</div>
            ) : sureshOrders.length === 0 ? (
              <div className="fail-empty">No orders found for Suresh Reddy.</div>
            ) : (
              sureshOrders.map((o, i) => (
                <div key={o.id}>
                  <div className="fail-row" style={{ animationDelay: `${0.05 + i * 0.05}s` }}>
                    <div className="fail-cell-product">
                      <span className="fail-product-name">{o.product_name}</span>
                    </div>
                    <div className="fail-cell fail-center fail-order-id">#{o.id}</div>
                    <div className="fail-cell fail-center"><StatusBadge status={o.status} /></div>
                    <div className="fail-cell fail-right fail-amount">₹{(o.total_paise / 100).toLocaleString('en-IN')}</div>
                    <div className="fail-cell fail-center fail-actions">
                      {o.status !== 'failed' && (
                        <button
                          className="fail-btn danger"
                          disabled={running[`sim_${o.id}`]}
                          onClick={() => simulateFailure(o.id)}
                        >
                          {running[`sim_${o.id}`] ? 'Simulating...' : 'Simulate Failure'}
                        </button>
                      )}
                      {(o.status === 'failed' || simResult[o.id]?.success) && (
                        <button
                          className="fail-btn retry"
                          disabled={running[`retry_${o.id}`]}
                          onClick={() => runRetry(o.id)}
                        >
                          {running[`retry_${o.id}`] ? 'Retrying...' : 'Retry →'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sim result */}
                  {simResult[o.id] && (
                    <div className="fail-result-panel danger">
                      <span className="fail-result-icon">✗</span>
                      <span>{simResult[o.id].success ? simResult[o.id].message : `Error: ${simResult[o.id].error}`}</span>
                    </div>
                  )}

                  {/* Retry result */}
                  {retryResult[o.id] && (
                    <div className={`fail-result-panel ${retryResult[o.id].success ? 'success' : retryResult[o.id].alerted ? 'warning' : 'danger'}`}>
                      <div className="fail-result-header">
                        {retryResult[o.id].success ? '✓ Retry succeeded' : retryResult[o.id].alerted ? '⚠ Merchant alerted' : '✗ Retry failed'}
                      </div>
                      {retryResult[o.id].payment_link && (
                        <a href={retryResult[o.id].payment_link} target="_blank" rel="noreferrer" className="fail-result-link">
                          New payment link →
                        </a>
                      )}
                      <StepLog steps={retryResult[o.id].steps} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Other Failed Orders ── */}
        {otherFailed.length > 0 && (
          <div className="fail-orders-section">
            <h3 className="fail-section-label">Other Failed Orders</h3>
            <div className="fail-table-wrap">
              <div className="fail-thead">
                <span>Customer</span>
                <span>Product</span>
                <span className="fail-center">Order #</span>
                <span className="fail-right">Amount</span>
                <span className="fail-center">Action</span>
              </div>
              {otherFailed.map((o, i) => (
                <div key={o.id} className="fail-row" style={{ animationDelay: `${0.05 + i * 0.05}s` }}>
                  <div className="fail-cell fail-product-name">{o.customer_name}</div>
                  <div className="fail-cell">{o.product_name}</div>
                  <div className="fail-cell fail-center fail-order-id">#{o.id}</div>
                  <div className="fail-cell fail-right fail-amount">₹{(o.total_paise / 100).toLocaleString('en-IN')}</div>
                  <div className="fail-cell fail-center">
                    <button
                      className="fail-btn retry"
                      disabled={running[`retry_${o.id}`]}
                      onClick={() => runRetry(o.id)}
                    >
                      {running[`retry_${o.id}`] ? 'Retrying...' : 'Retry →'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
