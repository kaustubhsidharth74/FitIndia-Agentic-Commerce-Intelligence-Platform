import { useState, useRef } from 'react';
import Link from 'next/link';


const API = 'http://localhost:4000/api';

const DIRECTIONS = [
  {
    id: 'checkout',
    direction: 'Direction 1',
    title: 'Conversational Checkout',
    subtitle: 'Ravi Sharma asks to buy Protein Powder via chat → AI generates payment link',
    color: '#1677C8',
  },
  {
    id: 'buyer',
    direction: 'Direction 2',
    title: 'AI Buyer Agent',
    subtitle: 'HealthBox Bot reads catalog autonomously → places bulk order',
    color: '#6366f1',
  },
  {
    id: 'upsell',
    direction: 'Direction 3',
    title: 'Upsell Agent',
    subtitle: 'AI analyses Meena Patel\'s purchase history → sends personalised offer',
    color: '#059669',
  },
  {
    id: 'campaign',
    direction: 'Direction 4',
    title: 'Campaign Orchestrator',
    subtitle: 'Scans all pending orders → sends recovery reminders with payment links',
    color: '#fb923c',
  },
  {
    id: 'failure',
    direction: 'Bonus',
    title: 'Failure & Recovery',
    subtitle: 'Payment fails → retry agent intervenes → merchant alert raised on dashboard',
    color: '#DC2626',
  },
];

const IDLE    = 'idle';
const RUNNING = 'running';
const DONE    = 'done';
const ERROR   = 'error';

function StepIcon({ state }) {
  if (state === IDLE)    return <span style={{ color: '#475569', fontSize: '1.2rem' }}>○</span>;
  if (state === RUNNING) return <span className="spin" style={{ color: '#D97706', fontSize: '1rem', display: 'inline-block' }}>↺</span>;
  if (state === DONE)    return <span style={{ color: '#22c55e', fontSize: '1.2rem' }}>✓</span>;
  if (state === ERROR)   return <span style={{ color: '#ef4444', fontSize: '1.2rem' }}>✗</span>;
}

function StepResult({ id, result }) {
  if (!result) return null;
  const style = { fontSize: '0.82rem', marginTop: '0.5rem', lineHeight: 1.6 };

  if (id === 'checkout') return (
    <div style={style} className="fade-in">
      <p style={{ color: '#059669' }}>Chat reply sent to {result.customer || 'Ravi'}</p>
      {result.paymentLink && (
        <a href={result.paymentLink} target="_blank" rel="noreferrer" style={{ color: '#1677C8' }}>
          Payment link → {result.paymentLink.split('/').pop()}
        </a>
      )}
    </div>
  );

  if (id === 'buyer') return (
    <div style={style} className="fade-in">
      {result.purchases?.map((p, i) => (
        <p key={i} style={{ color: '#059669' }}>
          {p.product} x{p.quantity} — ₹{p.amount_inr?.toLocaleString('en-IN')}
          {' '}<a href={p.payment_link} target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>Pay →</a>
        </p>
      ))}
    </div>
  );

  if (id === 'upsell') return (
    <div style={style} className="fade-in">
      <p style={{ color: '#059669' }}>{result.discount_percent}% off {result.product} sent to {result.customer}</p>
      <p style={{ color: '#6B7280', fontStyle: 'italic' }}>"{result.message}"</p>
      {result.payment_link && (
        <a href={result.payment_link} target="_blank" rel="noreferrer" style={{ color: '#059669' }}>Offer link →</a>
      )}
    </div>
  );

  if (id === 'campaign') return (
    <div style={style} className="fade-in">
      <p style={{ color: '#059669' }}>
        {result.reminded ?? 0} reminder{result.reminded !== 1 ? 's' : ''} sent
        {result.conversions_logged > 0 && `, ${result.conversions_logged} conversion${result.conversions_logged !== 1 ? 's' : ''} logged`}
      </p>
      {result.abandoned_found >= 0 && (
        <p style={{ color: '#6B7280' }}>{result.abandoned_found} pending orders scanned</p>
      )}
    </div>
  );

  if (id === 'failure') return (
    <div style={style} className="fade-in">
      <p style={{ color: '#DC2626' }}>✗ Payment failed (simulated)</p>
      <p style={{ color: '#D97706' }}>↺ Retry agent fired</p>
      <p style={{ color: '#fb923c' }}>⚠ Merchant alert raised — see dashboard</p>
      {result.alertOrder && <p style={{ color: '#6B7280' }}>Order #{result.alertOrder} flagged for manual review</p>}
    </div>
  );

  return null;
}

export default function DemoPage() {
  const [states,  setStates]  = useState(() => Object.fromEntries(DIRECTIONS.map(d => [d.id, IDLE])));
  const [results, setResults] = useState({});
  const [errors,  setErrors]  = useState({});
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  const [elapsed, setElapsed] = useState({});
  const startRef = useRef({});

  function setState(id, state) {
    setStates(s => ({ ...s, [id]: state }));
  }
  function setResult(id, result) {
    setResults(r => ({ ...r, [id]: result }));
  }
  function setError(id, msg) {
    setErrors(e => ({ ...e, [id]: msg }));
  }
  function startTimer(id) {
    startRef.current[id] = Date.now();
  }
  function stopTimer(id) {
    const ms = Date.now() - (startRef.current[id] || Date.now());
    setElapsed(e => ({ ...e, [id]: (ms / 1000).toFixed(1) }));
  }

  async function runAll() {
    setRunning(true);
    setDone(false);
    setStates(Object.fromEntries(DIRECTIONS.map(d => [d.id, IDLE])));
    setResults({});
    setErrors({});
    setElapsed({});

    // ── Step 1: Conversational Checkout ───────────────────────────────────────
    setState('checkout', RUNNING);
    startTimer('checkout');
    try {
      const res  = await fetch(`${API}/agent/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'I want to buy protein powder' }], customer_id: 1 }),
      });
      const data = await res.json();
      setResult('checkout', { ...data, customer: 'Ravi Sharma' });
      setState('checkout', DONE);
    } catch (e) {
      setError('checkout', e.message);
      setState('checkout', ERROR);
    }
    stopTimer('checkout');

    // ── Step 2: AI Buyer Agent ────────────────────────────────────────────────
    setState('buyer', RUNNING);
    startTimer('buyer');
    try {
      const res  = await fetch(`${API}/agent/buyer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_customer_id: 4, goal: 'Stock gym accessories for new branch opening', target_product_name: 'Gym Gloves', quantity: 3 }),
      });
      const data = await res.json();
      setResult('buyer', data);
      setState('buyer', data.success ? DONE : ERROR);
      if (!data.success) setError('buyer', data.error);
    } catch (e) {
      setError('buyer', e.message);
      setState('buyer', ERROR);
    }
    stopTimer('buyer');

    // ── Step 3: Upsell Agent ──────────────────────────────────────────────────
    setState('upsell', RUNNING);
    startTimer('upsell');
    try {
      const res  = await fetch(`${API}/agent/upsell`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: 2 }),
      });
      const data = await res.json();
      setResult('upsell', data);
      setState('upsell', data.success ? DONE : ERROR);
      if (!data.success) setError('upsell', data.error);
    } catch (e) {
      setError('upsell', e.message);
      setState('upsell', ERROR);
    }
    stopTimer('upsell');

    // ── Step 4: Campaign Orchestrator ─────────────────────────────────────────
    setState('campaign', RUNNING);
    startTimer('campaign');
    try {
      const res  = await fetch(`${API}/agent/campaign`, { method: 'POST' });
      const data = await res.json();
      setResult('campaign', data);
      setState('campaign', DONE);
    } catch (e) {
      setError('campaign', e.message);
      setState('campaign', ERROR);
    }
    stopTimer('campaign');

    // ── Step 5: Failure & Recovery ────────────────────────────────────────────
    setState('failure', RUNNING);
    startTimer('failure');
    try {
      // Create a fresh order for Suresh
      const orderRes = await fetch(`${API}/buy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: 3, product_id: 3, quantity: 1 }),
      });
      const orderData = await orderRes.json();
      const orderId   = orderData.db_order_id;

      // Simulate failure
      await fetch(`${API}/agent/simulate-failure`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });

      // Retry → force fail → merchant alert
      const retryRes  = await fetch(`${API}/agent/retry`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, force_retry_fail: true }),
      });
      const retryData = await retryRes.json();

      setResult('failure', { alertOrder: orderId, ...retryData });
      setState('failure', DONE);
    } catch (e) {
      setError('failure', e.message);
      setState('failure', ERROR);
    }
    stopTimer('failure');

    setRunning(false);
    setDone(true);
  }

  const allDone  = DIRECTIONS.every(d => states[d.id] === DONE || states[d.id] === ERROR);
  const passCount = DIRECTIONS.filter(d => states[d.id] === DONE).length;

  return (
    <div>

      <div className="container">
        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '2rem 0 1.5rem' }}>
          <p style={{ color: '#6366f1', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            FitIndia AI · Live Demo
          </p>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>One screen. All 4 AI directions.</h1>
          <p style={{ color: '#6B7280', fontSize: '0.95rem', maxWidth: 560, margin: '0 auto 1.5rem' }}>
            Click once to trigger Conversational Checkout, AI Buyer Agent, Upsell Agent, and Campaign Orchestrator — with a failure & recovery demo.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={runAll}
              disabled={running}
              style={{ background: running ? '#E2E8F0' : '#7c3aed', padding: '0.8rem 2rem', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.02em' }}>
              {running ? '▶ Running demo…' : done ? '↺ Run Again' : '▶ Run Full Demo'}
            </button>
            {done && (
              <Link href="/audit">
                <button style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#6B7280', padding: '0.8rem 1.5rem' }}>
                  View Audit Trail →
                </button>
              </Link>
            )}
          </div>
          {done && (
            <p style={{ color: passCount === 5 ? '#059669' : '#D97706', marginTop: '1rem', fontWeight: 600, fontSize: '0.9rem' }} className="fade-in">
              {passCount === 5 ? `✓ All ${passCount} directions demonstrated successfully` : `${passCount}/5 directions completed`}
            </p>
          )}
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 800, margin: '0 auto' }}>
          {DIRECTIONS.map((dir) => {
            const state = states[dir.id];
            const cls   = `card step-${state === IDLE ? 'waiting' : state === RUNNING ? 'running' : state === DONE ? 'success' : 'error'}`;
            return (
              <div key={dir.id} className={cls} style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1 }}>
                    <span style={{ minWidth: 24, marginTop: 2 }}><StepIcon state={state} /></span>
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span style={{ background: dir.color + '22', color: dir.color, fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: 999, border: `1px solid ${dir.color}44` }}>
                          {dir.direction}
                        </span>
                        <span style={{ fontWeight: 600 }}>{dir.title}</span>
                      </div>
                      <p style={{ color: '#6B7280', fontSize: '0.82rem' }}>{dir.subtitle}</p>
                      {errors[dir.id]  && <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: '0.4rem' }}>Error: {errors[dir.id]}</p>}
                      <StepResult id={dir.id} result={results[dir.id]} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                    {state === RUNNING && <span className="pulse" style={{ color: '#D97706', fontSize: '0.78rem' }}>running…</span>}
                    {(state === DONE || state === ERROR) && elapsed[dir.id] && (
                      <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{elapsed[dir.id]}s</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom links */}
        {done && (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }} className="fade-in">
            {[
              { href: '/',          label: 'Dashboard →' },
              { href: '/audit',     label: 'Audit Trail →' },
              { href: '/failures',  label: 'Failures →' },
              { href: '/customers', label: 'Customers →' },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ color: '#6B7280', fontSize: '0.85rem' }}>{l.label}</Link>
            ))}
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: '3rem', padding: '1rem', background: '#F1F5F9', borderRadius: 10, maxWidth: 800, margin: '2rem auto 0' }}>
          <p style={{ color: '#9CA3AF', fontSize: '0.78rem', textAlign: 'center' }}>
            Running in <strong style={{ color: '#D97706' }}>mock mode</strong> — no real payments or AI API calls. Every action is logged to the audit trail.
            Set <code style={{ color: '#6B7280' }}>MOCK_AI=false</code> + <code style={{ color: '#6B7280' }}>MOCK_RAZORPAY=false</code> for production.
          </p>
        </div>
      </div>
    </div>
  );
}
