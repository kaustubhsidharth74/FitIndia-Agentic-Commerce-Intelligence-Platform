import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const ParticleSphere = dynamic(() => import('../components/ParticleSphere'), { ssr: false });


const API = 'http://localhost:4000/api';

/* ── Hero Graphic — AI neural constellation ─────────────────────────────── */
function HeroGraphic() {
  const dots = useMemo(() => {
    const result = [];
    for (let ring = 0; ring < 13; ring++) {
      const radius = 22 + ring * 18;
      const count = 6 + ring * 4;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + ring * 0.38;
        const x = 250 + Math.cos(angle) * radius;
        const y = 250 + Math.sin(angle) * radius;
        const size = 1.0 + ((ring * 7 + i * 3) % 5) * 0.5;
        const opacity = 0.15 + ((ring * 3 + i * 7) % 10) * 0.065;
        const hue = ring < 5 ? 'sky' : ring < 9 ? 'violet' : 'green';
        result.push({ x, y, size, opacity, ring, i: i, hue });
      }
    }
    return result;
  }, []);

  const connections = useMemo(() => {
    const lines = [];
    for (let idx = 0; idx < dots.length; idx++) {
      const d = dots[idx];
      if ((d.ring * 5 + d.i * 3) % 7 !== 0) continue;
      for (let j = idx + 1; j < dots.length; j++) {
        const d2 = dots[j];
        if (Math.abs(d.ring - d2.ring) !== 1) continue;
        const dist = Math.sqrt((d.x - d2.x) ** 2 + (d.y - d2.y) ** 2);
        if (dist < 45) {
          lines.push({ x1: d.x, y1: d.y, x2: d2.x, y2: d2.y, opacity: 0.06 + ((idx + j) % 5) * 0.02 });
        }
      }
    }
    return lines;
  }, [dots]);

  const hueColor = { sky: '#4A9FE0', violet: '#6366f1', green: '#10B981' };

  return (
    <div className="hero-graphic-wrapper">
      <div className="hero-graphic-glow" />
      <svg viewBox="0 0 500 500" width="100%" height="100%" className="hero-graphic-spin" style={{ position: 'relative', zIndex: 1 }}>
        <defs>
          <radialGradient id="center-glow">
            <stop offset="0%" stopColor="#4A9FE0" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#4A9FE0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="250" cy="250" r="180" fill="url(#center-glow)" />
        {[60, 110, 160, 210].map((r, i) => (
          <circle key={i} cx="250" cy="250" r={r} fill="none"
            stroke="rgba(22,119,200,0.04)" strokeWidth="1" strokeDasharray={i % 2 === 0 ? "4 8" : "none"} />
        ))}
        {connections.map((c, i) => (
          <line key={i} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
            stroke="#4A9FE0" strokeWidth="0.5" opacity={c.opacity} />
        ))}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.size}
            fill={hueColor[d.hue]} opacity={d.opacity} />
        ))}
        <circle cx="250" cy="250" r="4" fill="#4A9FE0" opacity="0.8" />
        <circle cx="250" cy="250" r="8" fill="none" stroke="#4A9FE0" strokeWidth="1" opacity="0.3" />
      </svg>
    </div>
  );
}

/* ── Hero Section ───────────────────────────────────────────────────────── */
function RazorpayLogo() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
      background: '#0f1829', borderRadius: 6,
      padding: '0.35rem 0.75rem',
    }}>
      <span style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 500 }}>Powered by</span>
      <svg width="20" height="20" viewBox="0 0 40 64" xmlns="http://www.w3.org/2000/svg">
        <polygon points="6,2 18,2 10,62 0,62" fill="#072654" />
        <polygon points="18,2 30,2 14,62 10,62 18,24" fill="#1677C8" />
      </svg>
      <span style={{
        fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
        fontWeight: 800, fontStyle: 'italic',
        fontSize: '1rem', color: '#FFFFFF', letterSpacing: '-0.3px',
      }}>Razorpay</span>
    </div>
  );
}

function HeroSection({ onScrollDown }) {
  return (
    <>
      <section className="hero">
        <div className="hero-grid-bg" />
        <div style={{
          position: 'absolute', top: '1.5rem', right: '2rem', zIndex: 10,
          display: 'flex', alignItems: 'center',
        }}>
          <RazorpayLogo />
        </div>
        <div className="hero-content">
          <div className="hero-left">
            <h1 className="hero-title">
              <span className="highlight">FitIndia AI</span><br />Commerce Intelligence
            </h1>
            <p className="hero-subtitle">
              Autonomous AI agents that recover abandoned payments, generate upsells,
              run smart campaigns, and manage your entire checkout experience — fully automated, real-time.
            </p>
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hero-stat-value" style={{ color: '#1677C8' }}>5</div>
                <div className="hero-stat-label">AI Agent Types<br /><span style={{ color: '#475569', fontSize: '0.65rem' }}>Upsell · Buyer · Retry · Campaign · Checkout</span></div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value" style={{ color: '#059669' }}>100%</div>
                <div className="hero-stat-label">Autonomous<br /><span style={{ color: '#475569', fontSize: '0.65rem' }}>Zero manual intervention</span></div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value" style={{ color: '#6366f1' }}>Real-time</div>
                <div className="hero-stat-label">Webhook Processing<br /><span style={{ color: '#475569', fontSize: '0.65rem' }}>Instant payment events</span></div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value" style={{ color: '#D97706' }}>&lt; 2s</div>
                <div className="hero-stat-label">Agent Response<br /><span style={{ color: '#475569', fontSize: '0.65rem' }}>Per decision cycle</span></div>
              </div>
            </div>
            <div className="hero-cta">
              <button className="cta-primary" onClick={onScrollDown}>
                Explore Dashboard
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <Link href="/demo" className="cta-secondary">
                Run Live Demo
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Link>
            </div>
          </div>
          <div className="hero-right">
            <div className="hero-graphic-wrapper">
              <ParticleSphere
                sphereColor="#1677C8"
                particlesCount={8000}
                speed={15}
                smoothing={7}
                scale={9}
                particleScale={7}
                cursorOn={true}
                cursorRadiusUI={80}
                cursorStrengthUI={8}
                drag={true}
                dragSpeed={5}
              />
            </div>
          </div>
        </div>
      </section>
      <div className="hero-divider" />
    </>
  );
}

const RESULT_COLOR = { success: '#059669', failed: '#DC2626', pending: '#D97706' };
const RESULT_BG    = { success: 'rgba(52,211,153,0.12)', failed: 'rgba(248,113,113,0.12)', pending: 'rgba(251,191,36,0.12)' };

const AGENT_THEME = {
  upsell_agent:   { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'Upsell' },
  buyer_agent:    { color: '#1677C8', bg: 'rgba(22,119,200,0.12)',  label: 'Buyer' },
  retry_agent:    { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  label: 'Retry' },
  campaign_agent: { color: '#059669', bg: 'rgba(5,150,105,0.12)',  label: 'Campaign' },
  checkout_agent: { color: '#f472b6', bg: 'rgba(244,114,182,0.12)', label: 'Checkout' },
  mock_webhook:   { color: '#9CA3AF', bg: 'rgba(100,116,139,0.12)', label: 'Webhook' },
  system:         { color: '#9CA3AF', bg: 'rgba(100,116,139,0.12)', label: 'System' },
};

const AGENT_NAMES = {
  upsell_agent: 'Upsell Agent',
  buyer_agent: 'Buyer Agent',
  retry_agent: 'Retry Agent',
  campaign_agent: 'Campaign Agent',
  checkout_agent: 'Checkout Agent',
  mock_webhook: 'Webhook',
  system: 'System',
};


/* ── SVG Icons ──────────────────────────────────────────────────────────── */
const Icons = {
  revenue: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  recovered: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  orders: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  pending: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  alert: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  agents: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  shield: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  campaign: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  ),
};

const TrendArrow = ({ direction }) => (
  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
    <path strokeLinecap="round" strokeLinejoin="round"
      d={direction === 'up' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
  </svg>
);

/* ── Animated number ─────────────────────────────────────────────────────── */
function AnimatedValue({ value, prefix = '', color, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplay(value);
      prevRef.current = value;
      return;
    }
    const from = mountedRef.current && typeof prevRef.current === 'number' ? prevRef.current : 0;
    mountedRef.current = true;
    const to = value;
    if (from === to) { setDisplay(to); prevRef.current = to; return; }
    const start = performance.now();
    let raf;
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    prevRef.current = to;
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const formatted = typeof display === 'number'
    ? `${prefix}${display.toLocaleString('en-IN')}`
    : `${prefix}${display}`;

  return <span style={{ color }}>{formatted}</span>;
}

/* ── Stat Tile ──────────────────────────────────────────────────────────── */
function MiniSparkBars({ color, count = 7 }) {
  const bars = useMemo(() => Array.from({ length: count }, () => 0.25 + Math.random() * 0.75), [count]);
  const maxH = 22;
  return (
    <div className="spark-bars">
      {bars.map((h, i) => (
        <div key={i} className="spark-bar" style={{
          height: `${Math.round(h * maxH)}px`,
          background: color,
          opacity: 0.4 + h * 0.6,
          animationDelay: `${0.6 + i * 0.06}s`,
        }} />
      ))}
    </div>
  );
}

function StatTile({ label, value, sub, color = '#1677C8', href, icon, index = 0, trend }) {
  const iconBg = `${color}15`;

  const inner = (
    <div className={`stat-tile stagger-${index + 1}`} style={{ cursor: href ? 'pointer' : 'default' }}>
      <div className="stat-label">{label}</div>
      <div className="stat-tile-row">
        <div className="stat-icon" style={{ background: iconBg, color }}>{icon}</div>
        <div className="stat-value">
          {typeof value === 'number'
            ? <AnimatedValue value={value} prefix={label.includes('Revenue') || label.includes('Recovered') ? '₹' : ''} color={color} />
            : <span style={{ color }}>{value}</span>
          }
        </div>
        <MiniSparkBars color={color} />
        {trend && (
          <span className={`trend-badge ${trend.direction}`}>
            <TrendArrow direction={trend.direction} />
            {trend.value}%
          </span>
        )}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );

  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

/* ── Activity Feed ──────────────────────────────────────────────────────── */
function ActivityFeed({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {items.map((item, i) => {
        const theme = AGENT_THEME[item.agent] || AGENT_THEME.system;
        return (
          <div key={item.id || i} className="activity-item" style={{ animationDelay: `${i * 30}ms` }}>
            <span className="activity-agent-badge" style={{ color: theme.color, background: theme.bg }}>{theme.label}</span>
            <span className="activity-text">{item.sentence}</span>
            <span className="activity-time">{item.time}</span>
            <span className="activity-dot" style={{ background: RESULT_COLOR[item.result] || '#9CA3AF', boxShadow: `0 0 6px ${RESULT_COLOR[item.result] || '#9CA3AF'}60` }} />
          </div>
        );
      })}
    </div>
  );
}

/* ── Toggle Switch ──────────────────────────────────────────────────────── */
function Toggle({ checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}>
      <span className="toggle-switch">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-track" />
        <span className="toggle-thumb" />
      </span>
      <span style={{ fontSize: '0.85rem', color: checked ? '#059669' : '#6B7280', fontWeight: 500, transition: 'color 0.15s' }}>
        {checked ? 'Enabled' : 'Disabled'}
      </span>
    </label>
  );
}

/* ── Guardrail Settings ─────────────────────────────────────────────────── */
function GuardrailPanel({ guardrails, onSave }) {
  const [draft, setDraft] = useState(guardrails);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(guardrails); }, [guardrails]);

  async function save() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const field = (key, label, min, max, step = 1, unit = '') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ color: '#6B7280', fontSize: '0.78rem', fontWeight: 500 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type="number" min={min} max={max} step={step} value={draft[key] || ''} onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) }))} style={{ paddingRight: unit ? '2.5rem' : '1rem' }} />
        {unit && <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '0.78rem', pointerEvents: 'none' }}>{unit}</span>}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {field('max_upsell_discount_pct', 'Max upsell discount', 1, 50, 1, '%')}
        {field('max_auto_approve_inr', 'Max auto-approve', 100, 50000, 100, '₹')}
        {field('max_reminders_per_order', 'Max campaign reminders', 1, 10)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ color: '#6B7280', fontSize: '0.78rem', fontWeight: 500 }}>Retry agent</label>
          <div style={{ marginTop: '0.45rem' }}>
            <Toggle checked={draft.retry_enabled === true} onChange={v => setDraft(d => ({ ...d, retry_enabled: v }))} />
          </div>
        </div>
      </div>
      <button onClick={save} disabled={saving} style={{ background: saved ? '#059669' : undefined, padding: '0.55rem 1.5rem', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {saving ? <><span className="spin" style={{ fontSize: '0.8rem' }}>⟳</span> Saving…</> : saved ? <>✓ Saved</> : <>{Icons.shield} Save Settings</>}
      </button>
    </div>
  );
}

/* ── Section Header ─────────────────────────────────────────────────────── */
function SectionHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 600 }}>{title}</h3>
      {action}
    </div>
  );
}

/* ── Dashboard Tabs ─────────────────────────────────────────────────────── */
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Activity' },
  { key: 'settings', label: 'Settings' },
];

function DashboardTabs({ active, onChange }) {
  return (
    <div className="dash-tabs">
      {TABS.map(t => (
        <button key={t.key} className={`dash-tab${active === t.key ? ' active' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Revenue Hero Card ──────────────────────────────────────────────────── */
function RevenueHeroCard({ totalRevenue }) {
  return (
    <div className="revenue-hero-card">
      <div>
        <div className="revenue-hero-label">Total Revenue</div>
        <div className="revenue-hero-value">
          {typeof totalRevenue === 'number'
            ? <AnimatedValue value={totalRevenue} prefix="₹" color="#1677C8" />
            : <span style={{ color: '#1677C8' }}>—</span>
          }
        </div>
        <div className="revenue-hero-sub">Lifetime processed revenue across all agents</div>
      </div>
      <div className="revenue-hero-actions">
        <Link href="/audit">View Audit</Link>
        <Link href="/campaign">Run Campaign</Link>
      </div>
    </div>
  );
}

/* ── Metric Card ────────────────────────────────────────────────────────── */
function MetricCard({ label, value, prefix = '', color, icon, subtitle, trend }) {
  return (
    <div className="metric-card">
      <div className="metric-card-icon" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className="metric-card-body">
        <div className="metric-card-label">{label}</div>
        <div className="metric-card-value">
          {typeof value === 'number'
            ? <AnimatedValue value={value} prefix={prefix} color={color} />
            : <span style={{ color }}>{value || '—'}</span>
          }
        </div>
        {trend && (
          <span className={`trend-badge ${trend.direction}`}>
            <TrendArrow direction={trend.direction} />
            {trend.value}% vs last month
          </span>
        )}
        {subtitle && <div className="metric-card-sub">{subtitle}</div>}
      </div>
    </div>
  );
}

/* ── Revenue Trend Chart (SVG) ──────────────────────────────────────────── */
// A newly seeded local database has only the current month's orders. Show an
// illustrative trend in that case, while explicitly labelling it as demo data.
function buildDemoRevenueTrend(latestRevenue) {
  const latest = Math.max(Number(latestRevenue) || 0, 12000);
  const now = new Date();
  const factors = [0.46, 0.58, 0.54, 0.68, 0.89, 1];
  return factors.map((factor, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (factors.length - 1 - index), 1);
    return {
      month: date.toLocaleString('en-IN', { month: 'short' }),
      // The final chart point must exactly match the live total shown above.
      value: index === factors.length - 1 ? latest : Math.round((latest * factor) / 100) * 100,
    };
  });
}

function RevenueChart({ data, stats, isDemo = false }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!data) {
    return (
      <div className="chart-card chart-card-premium" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ color: '#6B7280', fontSize: '0.85rem' }}>No paid orders yet — revenue trend will appear here.</span>
      </div>
    );
  }

  const padL = 50, padR = 25, padT = 20, padB = 40;
  const W = 700, H = 280;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = data.map(d => d.value);
  const maxV = Math.max(...values) * 1.15;
  const minV = Math.min(...values) * 0.85;

  const toX = i => data.length === 1 ? padL + plotW / 2 : padL + (i / (data.length - 1)) * plotW;
  const toY = v => padT + (1 - (v - minV) / (maxV - minV)) * plotH;

  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.value) }));

  function catmullRomPath(points) {
    if (points.length < 2) return '';
    const tension = 0.35;
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  const linePath = catmullRomPath(pts);
  const areaPath = linePath + ` L ${pts[pts.length - 1].x},${padT + plotH} L ${pts[0].x},${padT + plotH} Z`;

  const gridLines = 5;
  const gridValues = Array.from({ length: gridLines }, (_, i) => {
    const v = minV + ((maxV - minV) / (gridLines + 1)) * (i + 1);
    return Math.round(v / 100) * 100;
  });

  const latestVal = values[values.length - 1];
  const activeIndex = hover !== null ? hover : data.length - 1;
  const activeValue = values[activeIndex];
  const activePreviousValue = values[activeIndex - 1];
  const hasPriorMonth = activeIndex > 0 && Boolean(activePreviousValue);
  const changePct = hasPriorMonth ? (((activeValue - activePreviousValue) / activePreviousValue) * 100).toFixed(1) : null;
  const isUp = activeValue >= activePreviousValue;

  const highVal = Math.max(...values);
  const lowVal = Math.min(...values);

  function handleMouseMove(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    let closest = 0;
    let closestDist = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(svgX - p.x);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    if (closestDist < plotW / (data.length - 1)) {
      setHover(closest);
    } else {
      setHover(null);
    }
  }

  return (
    <div className="chart-card chart-card-premium">
      {/* ── Header with value + trend ── */}
      <div className="chart-premium-header">
        <div className="chart-premium-left">
          <h3 className="chart-premium-title">Revenue Overview</h3>
          <div className="chart-premium-value-row">
            <span className="chart-premium-value">
              <AnimatedValue value={activeValue} prefix="₹" duration={hover !== null ? 300 : 1400} />
            </span>
            {hasPriorMonth ? (
              <span className={`chart-premium-badge ${isUp ? 'up' : 'down'}`}>
                {isUp ? '↗' : '↘'} {isUp ? '+' : ''}{changePct}%
              </span>
            ) : (
              <span className="chart-premium-badge" style={{ color: '#64748B', background: '#F1F5F9' }}>First month</span>
            )}
          </div>
          <span className="chart-premium-sub">
            {hover !== null
              ? `${data[hover].month} vs ${data[hover - 1]?.month || 'start of period'}`
              : `${data[data.length - 1].month} • Latest month`
            }
          </span>
        </div>
        <div className="chart-premium-right">
          <span className="chart-premium-period">{isDemo ? 'Illustrative demo trend' : 'Monthly Revenue'}</span>
        </div>
      </div>

      {/* ── SVG Chart ── */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="revenue-chart"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="area-grad-premium" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4A9FE0" stopOpacity="0.30" />
            <stop offset="40%" stopColor="#6366F1" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#4A9FE0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="35%" stopColor="#4A9FE0" />
            <stop offset="70%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="dot-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Gridlines */}
        {gridValues.map((v, i) => (
          <g key={i}>
            <line
              x1={padL} y1={toY(v)} x2={W - padR} y2={toY(v)}
              className="chart-gridline"
              strokeDasharray="4 4"
            />
            <text x={padL - 10} y={toY(v) + 4} className="chart-label" textAnchor="end">
              {v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#area-grad-premium)" className="chart-area" />

        {/* Outer ambient glow */}
        <path d={linePath} fill="none" stroke="#4A9FE0" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.06" filter="url(#glow)" className="chart-line-glow" />

        {/* Inner glow */}
        <path d={linePath} fill="none" stroke="url(#line-grad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.18" className="chart-line-glow" />

        {/* Main crisp line */}
        <path d={linePath} fill="none" stroke="url(#line-grad)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="chart-line" />

        {/* Month labels */}
        {data.map((d, i) => (
          <text key={i} x={toX(i)} y={H - 10} className="chart-label chart-month-label" textAnchor="middle"
            style={{ opacity: 0, animation: `legend-enter 0.3s ease-out ${0.6 + i * 0.08}s forwards` }}>
            {d.month}
          </text>
        ))}

        {/* Data dots — ring style */}
        {data.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toY(d.value)}
            r={hover === i ? 0 : 4} fill="#FFFFFF" stroke="#4A9FE0" strokeWidth="2"
            className={`chart-dot${i === data.length - 1 ? ' chart-dot-latest' : ''}`}
            style={{ animationDelay: `${1.0 + i * 0.1}s` }} />
        ))}

        {/* Hover crosshair + tooltip */}
        {hover !== null && (
          <g className="chart-hover-group">
            <line
              x1={pts[hover].x} y1={padT}
              x2={pts[hover].x} y2={padT + plotH}
              stroke="rgba(22,119,200,0.3)" strokeWidth="1" strokeDasharray="4 3"
            />
            {/* Glow circle */}
            <circle cx={pts[hover].x} cy={pts[hover].y} r="12" fill="#4A9FE0" opacity="0.10" filter="url(#dot-glow)" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="6" fill="#FFFFFF" stroke="#4A9FE0" strokeWidth="2.5" />
            {/* Tooltip bubble */}
            <g transform={`translate(${pts[hover].x}, ${pts[hover].y - 28})`}>
              <rect x="-32" y="-14" width="64" height="22" rx="6" fill="rgba(22,119,200,0.9)" />
              <text x="0" y="1" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700" fontFamily="inherit">
                ₹{data[hover].value.toLocaleString('en-IN')}
              </text>
            </g>
            {/* Bottom label pill */}
            <g transform={`translate(${pts[hover].x}, ${padT + plotH + 10})`}>
              <rect x="-18" y="-7" width="36" height="16" rx="8" fill="#4A9FE0" />
              <text x="0" y="5" textAnchor="middle" fill="#FFFFFF" fontSize="8.5" fontWeight="700" fontFamily="inherit">
                {data[hover].month}
              </text>
            </g>
          </g>
        )}
      </svg>

      {/* ── Bottom Stats Row ── */}
      <div className="chart-bottom-stats">
        <div className="chart-stat-item">
          <span className="chart-stat-label">Highest</span>
          <span className="chart-stat-val"><AnimatedValue value={highVal} prefix="₹" duration={1000} /></span>
        </div>
        <div className="chart-stat-item">
          <span className="chart-stat-label">Lowest</span>
          <span className="chart-stat-val"><AnimatedValue value={lowVal} prefix="₹" duration={1000} /></span>
        </div>
        <div className="chart-stat-item">
          <span className="chart-stat-label">Latest</span>
          <span className="chart-stat-val"><AnimatedValue value={latestVal} prefix="₹" duration={1000} /></span>
        </div>
        <div className="chart-stat-item">
          <span className="chart-stat-label">Total Revenue</span>
          <span className="chart-stat-val chart-stat-highlight">
            <AnimatedValue value={stats?.total_revenue_inr != null ? Number(stats.total_revenue_inr) : values.reduce((s, v) => s + v, 0)} prefix="₹" duration={1600} />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Donut Chart ────────────────────────────────────────────────────────── */
function DonutChart({ activity }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const COLORS = ['#1677C8', '#8B5CF6', '#06D6A0', '#FB923C', '#F472B6'];

  const segments = useMemo(() => {
    const counts = {};
    (activity || []).forEach(item => {
      const agent = item.agent || 'system';
      counts[agent] = (counts[agent] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([agent, count]) => ({ agent, count, label: AGENT_NAMES[agent] || agent }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((seg, i) => ({ ...seg, color: COLORS[i] }));
  }, [activity]);

  const total = segments.reduce((s, seg) => s + seg.count, 0);

  const CX = 120, CY = 120, R = 90, SW = 32;

  const arcs = useMemo(() => {
    const circ = 2 * Math.PI * R;
    const gapAngle = 3;
    const totalGap = segments.length * gapAngle;
    const available = 360 - totalGap;
    let offset = 0;
    return segments.map((seg) => {
      const angle = (seg.count / total) * available;
      const dashLen = (angle / 360) * circ;
      const gapLen = circ - dashLen;
      const rot = offset - 90;
      offset += angle + gapAngle;
      return { ...seg, dashLen, gapLen, rot };
    });
  }, [segments, total]);

  return (
    <div className="donut-card">
      <div className="donut-card-header">
        <h3>Agent Activity</h3>
        <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{total} events</span>
      </div>
      {total === 0 ? (
        <div className="donut-empty">
          <svg viewBox="0 0 240 240" style={{ width: '100%', maxWidth: 180, display: 'block', margin: '0 auto 1rem' }}>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(30,58,110,0.15)" strokeWidth={SW} />
          </svg>
          <p>No activity data yet</p>
          <span>Run an agent to see the breakdown</span>
        </div>
      ) : (
        <>
          <div className="multiring-wrapper">
            <svg viewBox="0 0 240 240" className="multiring-svg">
              <defs>
                <filter id="ring-glow">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                {COLORS.map((c, i) => (
                  <linearGradient key={i} id={`arc-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={c} stopOpacity="1" />
                    <stop offset="100%" stopColor={c} stopOpacity="0.65" />
                  </linearGradient>
                ))}
              </defs>

              {/* Single background track */}
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={SW} />

              {/* Colored arc segments on a single ring */}
              {arcs.map((arc, idx) => {
                const isHover = hoverIdx === idx;
                return (
                  <circle
                    key={arc.agent}
                    cx={CX} cy={CY} r={R}
                    fill="none"
                    stroke={`url(#arc-grad-${idx})`}
                    strokeWidth={isHover ? SW + 6 : SW}
                    strokeDasharray={`${arc.dashLen} ${arc.gapLen}`}
                    strokeLinecap="round"
                    transform={`rotate(${arc.rot} ${CX} ${CY})`}
                    filter={isHover ? 'url(#ring-glow)' : undefined}
                    style={{
                      opacity: 0,
                      cursor: 'pointer',
                      transition: 'stroke-width 0.25s ease, filter 0.25s ease',
                      animation: `donut-draw 0.6s ease-out ${0.2 + idx * 0.08}s forwards`,
                    }}
                    onMouseEnter={() => setHoverIdx(idx)}
                    onMouseLeave={() => setHoverIdx(null)}
                  />
                );
              })}

              {/* Center circle */}
              <circle cx={CX} cy={CY} r={R - SW / 2 - 4} fill="#FFFFFF" />
              <circle cx={CX} cy={CY} r={R - SW / 2 - 4} fill="none" stroke="rgba(22,119,200,0.12)" strokeWidth="1" />
            </svg>

            <div className="multiring-center">
              <div className="multiring-center-value">
                <AnimatedValue value={hoverIdx !== null ? segments[hoverIdx].count : total} duration={hoverIdx !== null ? 250 : 900} />
              </div>
              <div className="multiring-center-label">
                {hoverIdx !== null ? segments[hoverIdx].label : 'total events'}
              </div>
            </div>
          </div>

          <div className="multiring-legend">
            {segments.map((seg, idx) => {
              const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
              return (
                <div
                  key={seg.agent}
                  className={`multiring-legend-row${hoverIdx === idx ? ' active' : ''}`}
                  onMouseEnter={() => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <span className="multiring-legend-dot" style={{ background: seg.color }} />
                  <span className="multiring-legend-name">{seg.label}</span>
                  <span className="multiring-legend-pct" style={{ color: seg.color }}>{pct}%</span>
                  <span className="multiring-legend-count">{seg.count}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Transaction List ───────────────────────────────────────────────────── */
function TransactionList({ logs }) {
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('latest');
  const PER_PAGE = 8;

  const sorted = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    const arr = [...logs];
    arr.sort((a, b) => sortOrder === 'latest'
      ? new Date(b.timestamp + 'Z') - new Date(a.timestamp + 'Z')
      : new Date(a.timestamp + 'Z') - new Date(b.timestamp + 'Z')
    );
    return arr;
  }, [logs, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const pageData = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function formatDate(ts) {
    const d = new Date(ts + 'Z');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatAmount(paise) {
    if (!paise && paise !== 0) return '—';
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function getPageNumbers() {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1, 2, 3);
      if (page > 4) pages.push('...');
      if (page > 3 && page < totalPages - 2) pages.push(page);
      if (page < totalPages - 3) pages.push('...');
      pages.push(totalPages - 1, totalPages);
    }
    return [...new Set(pages)];
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="txn-list">
        <div className="txn-list-header">
          <h3>Transaction History</h3>
        </div>
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>No transactions yet.</div>
      </div>
    );
  }

  return (
    <div className="txn-list">
      <div className="txn-list-header">
        <h3>Transaction History</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link href="/audit" className="txn-viewall-btn">View all →</Link>
          <button
            className="txn-sort-btn"
            onClick={() => setSortOrder(s => s === 'latest' ? 'oldest' : 'latest')}
          >
            Sort by {sortOrder === 'latest' ? 'Latest' : 'Oldest'} ↕
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="txn-table-head">
        <span>Invoice ID</span>
        <span>Agent</span>
        <span>Date</span>
        <span>Customer</span>
        <span>Amount</span>
        <span>Status</span>
      </div>

      {/* Data Rows */}
      {pageData.map((log, i) => {
        const theme = AGENT_THEME[log.agent] || AGENT_THEME.system;
        return (
          <div key={log.id} className="txn-table-row" style={{ animationDelay: `${0.05 * i}s` }}>
            <span className="txn-id">
              #TXN-{String(log.id).padStart(4, '0')}
            </span>
            <span className="txn-agent">
              <span className="txn-agent-dot" style={{ background: theme.color }} />
              {theme.label}
            </span>
            <span className="txn-date">{formatDate(log.timestamp)}</span>
            <span className="txn-customer">{log.customer_name || 'System'}</span>
            <span className="txn-amount">{formatAmount(log.amount_paise)}</span>
            <span className={`txn-status txn-status-${log.result || 'pending'}`}>
              <span className="txn-status-dot" style={{ background: RESULT_COLOR[log.result] || '#9CA3AF' }} />
              {log.result || 'pending'}
            </span>
          </div>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="txn-pagination">
          <button
            className="txn-page-nav"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            ‹ Previous
          </button>
          <div className="txn-page-nums">
            {getPageNumbers().map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className="txn-page-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  className={`txn-page-btn${page === p ? ' active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}
          </div>
          <button
            className="txn-page-nav"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Paginated Card (shared by Live Feed + Audit Trail) ────────────────── */
function ActivityPaginatedCard({ title, badge, linkHref, linkText, items, perPage = 6, emptyMsg, renderHeader, renderItem }) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageItems = items.slice((page - 1) * perPage, page * perPage);

  useEffect(() => { setPage(1); }, [items]);

  return (
    <div className="activity-paged-card">
      <div className="activity-paged-header">
        <h3>{title}</h3>
        {badge && <span className="activity-count-badge">{badge}</span>}
        {linkHref && <Link href={linkHref} className="activity-view-all">{linkText}</Link>}
      </div>
      {total === 0 ? (
        <div className="activity-empty">
          <p>{emptyMsg}</p>
        </div>
      ) : (
        <>
          {renderHeader && renderHeader()}
          <div className="activity-paged-list">
            {pageItems.map((item, i) => renderItem(item, i))}
          </div>
          {totalPages > 1 && (
            <div className="activity-paged-footer">
              <button className="activity-page-nav" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <span className="activity-page-info">Page {page} of {totalPages}</span>
              <button className="activity-page-nav" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Activity Tab ──────────────────────────────────────────────────────── */
function ActivityTabContent({ activity, recentAudit, stats, onRefresh }) {
  const [agentFilter, setAgentFilter] = useState('all');

  const agents = useMemo(() => {
    const set = new Set();
    activity.forEach(a => set.add(a.agent));
    recentAudit.forEach(a => set.add(a.agent));
    return ['all', ...Array.from(set).sort()];
  }, [activity, recentAudit]);

  const filteredActivity = agentFilter === 'all' ? activity : activity.filter(a => a.agent === agentFilter);
  const filteredAudit = agentFilter === 'all' ? recentAudit : recentAudit.filter(a => a.agent === agentFilter);

  const auditStats = useMemo(() => {
    const total = recentAudit.length;
    const success = recentAudit.filter(l => l.result === 'success').length;
    const failed = recentAudit.filter(l => l.result === 'failed').length;
    const pending = recentAudit.filter(l => l.result === 'pending').length;
    const totalAmount = recentAudit.reduce((s, l) => s + (l.amount_paise || 0), 0) / 100;
    const uniqueAgents = new Set(recentAudit.map(l => l.agent)).size;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    return { total, success, failed, pending, totalAmount, uniqueAgents, successRate };
  }, [recentAudit]);

  const hourlyData = useMemo(() => {
    const hours = {};
    recentAudit.forEach(log => {
      const h = new Date(log.timestamp + 'Z').getHours();
      const label = `${h.toString().padStart(2, '0')}:00`;
      hours[label] = (hours[label] || 0) + 1;
    });
    const sorted = Object.entries(hours).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted;
  }, [recentAudit]);

  const maxHourly = Math.max(1, ...hourlyData.map(d => d[1]));

  function relativeTime(ts) {
    const diff = Date.now() - new Date(ts + 'Z').getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <>
      {/* ── Summary Stats Bar ── */}
      <div className="activity-stats-bar">
        <div className="activity-stat-item">
          <div className="activity-stat-value"><AnimatedValue value={auditStats.total} duration={1000} /></div>
          <div className="activity-stat-label">Total Events</div>
        </div>
        <div className="activity-stat-item">
          <div className="activity-stat-value" style={{ color: '#059669' }}><AnimatedValue value={auditStats.successRate} duration={1000} /><span>%</span></div>
          <div className="activity-stat-label">Success Rate</div>
        </div>
        <div className="activity-stat-item">
          <div className="activity-stat-value" style={{ color: '#1677C8' }}><AnimatedValue value={auditStats.uniqueAgents} duration={800} /></div>
          <div className="activity-stat-label">Active Agents</div>
        </div>
        <div className="activity-stat-item">
          <div className="activity-stat-value" style={{ color: '#6366f1' }}>
            <AnimatedValue value={auditStats.totalAmount} prefix="₹" duration={1200} />
          </div>
          <div className="activity-stat-label">Total Amount</div>
        </div>
        <div className="activity-stat-item">
          <div className="activity-stat-value" style={{ color: '#DC2626' }}><AnimatedValue value={auditStats.failed} duration={800} /></div>
          <div className="activity-stat-label">Failed</div>
        </div>
      </div>

      {/* ── Agent Filter Pills ── */}
      <div className="activity-filter-bar">
        <span className="activity-filter-label">Filter by agent:</span>
        <div className="activity-filter-pills">
          {agents.map(agent => {
            const theme = AGENT_THEME[agent] || AGENT_THEME.system;
            const isAll = agent === 'all';
            const isActive = agentFilter === agent;
            return (
              <button
                key={agent}
                className={`activity-pill${isActive ? ' active' : ''}`}
                onClick={() => setAgentFilter(agent)}
                style={isActive && !isAll ? { background: theme.bg, color: theme.color, borderColor: theme.color + '40' } : undefined}
              >
                {!isAll && <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.color, display: 'inline-block' }} />}
                {isAll ? 'All' : (AGENT_NAMES[agent] || agent)}
              </button>
            );
          })}
        </div>
        <button
          onClick={onRefresh}
          className="activity-refresh-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Agent Breakdown Bar Chart ── */}
      {auditStats.total > 0 && (
        <div className="activity-timeline-card">
          <div className="activity-timeline-header">
            <h3>Agent Breakdown</h3>
            <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{auditStats.total} events</span>
          </div>
          <div className="agent-breakdown">
            {(() => {
              const counts = {};
              filteredAudit.forEach(l => {
                const a = l.agent || 'system';
                counts[a] = (counts[a] || 0) + 1;
              });
              const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
              const maxC = sorted.length > 0 ? sorted[0][1] : 1;
              return sorted.map(([agent, count], i) => {
                const theme = AGENT_THEME[agent] || AGENT_THEME.system;
                const pct = Math.round((count / auditStats.total) * 100);
                return (
                  <div key={agent} className="agent-breakdown-row" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
                    <div className="agent-breakdown-info">
                      <span className="agent-breakdown-dot" style={{ background: theme.color }} />
                      <span className="agent-breakdown-name">{AGENT_NAMES[agent] || agent}</span>
                      <span className="agent-breakdown-count" style={{ color: theme.color }}>{count}</span>
                      <span className="agent-breakdown-pct">{pct}%</span>
                    </div>
                    <div className="agent-breakdown-track">
                      <div className="agent-breakdown-fill" style={{
                        width: `${(count / maxC) * 100}%`,
                        background: `linear-gradient(90deg, ${theme.color}, ${theme.color}80)`,
                      }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ── Main content: two column layout ── */}
      <div className="activity-content-grid">

        {/* ── Live Feed ── */}
        <ActivityPaginatedCard
          title="Live Activity Feed"
          badge={`${filteredActivity.length} events`}
          items={filteredActivity}
          perPage={6}
          emptyMsg={`No activity${agentFilter !== 'all' ? ` from ${AGENT_NAMES[agentFilter] || agentFilter}` : ''} yet`}
          renderItem={(item, i) => {
            const theme = AGENT_THEME[item.agent] || AGENT_THEME.system;
            return (
              <div key={item.id || i} className="activity-feed-row">
                <div className="activity-feed-icon" style={{ background: theme.bg, color: theme.color }}>
                  {Icons.agents}
                </div>
                <div className="activity-feed-body">
                  <div className="activity-feed-top">
                    <span className="activity-agent-pill" style={{ color: theme.color, background: theme.bg }}>{theme.label}</span>
                    <span className="activity-feed-time">{item.time}</span>
                  </div>
                  <div className="activity-feed-sentence">{item.sentence}</div>
                  <div className="activity-feed-meta">
                    {item.amount_inr && (
                      <span className="activity-amount">₹{item.amount_inr.toLocaleString('en-IN')}</span>
                    )}
                    <span className={`activity-result-dot ${item.result}`}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', background: RESULT_COLOR[item.result] || '#9CA3AF' }} />
                      {item.result}
                    </span>
                  </div>
                </div>
              </div>
            );
          }}
        />

        {/* ── Audit Trail Table ── */}
        <ActivityPaginatedCard
          title="Audit Trail"
          linkHref="/audit"
          linkText="View full log →"
          items={filteredAudit}
          perPage={6}
          emptyMsg={`No audit entries${agentFilter !== 'all' ? ` for ${AGENT_NAMES[agentFilter] || agentFilter}` : ''}`}
          renderHeader={() => (
            <div className="audit-table-head">
              <span>Time</span>
              <span>Agent</span>
              <span>Action</span>
              <span>Customer</span>
              <span>Amount</span>
              <span>Result</span>
            </div>
          )}
          renderItem={(log, i) => {
            const theme = AGENT_THEME[log.agent] || AGENT_THEME.system;
            return (
              <div key={log.id} className="audit-table-row">
                <div className="audit-time-cell">
                  <span className="audit-time-main">{new Date(log.timestamp + 'Z').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className="audit-time-relative">{relativeTime(log.timestamp)}</span>
                </div>
                <span className="audit-agent-badge" style={{ color: theme.color, background: theme.bg }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.color, display: 'inline-block' }} />
                  {AGENT_NAMES[log.agent] || log.agent}
                </span>
                <span className="audit-action-cell">{(log.action_type || '').replace(/_/g, ' ')}</span>
                <span className="audit-customer-cell">{log.customer_name || '—'}</span>
                <span className="audit-amount-cell">
                  {log.amount_paise ? `₹${(log.amount_paise / 100).toLocaleString('en-IN')}` : '—'}
                </span>
                <span className="audit-result-badge" style={{ color: RESULT_COLOR[log.result] || '#9CA3AF', background: RESULT_BG[log.result] || 'rgba(100,116,139,0.1)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', background: RESULT_COLOR[log.result] || '#9CA3AF' }} />
                  {log.result}
                </span>
              </div>
            );
          }}
        />
      </div>
    </>
  );
}

/* ── Dashboard ──────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [recentAudit, setRecentAudit] = useState([]);
  const [guardrails, setGuardrails] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const timerRef = useRef(null);
  const dashboardRef = useRef(null);

  const fetchAll = useCallback(async () => {
    const [healthR, statsR, alertsR, activityR, auditR, grR, trendR] = await Promise.allSettled([
      fetch(`${API}/health`).then(r => r.json()),
      fetch(`${API}/agent/stats`).then(r => r.json()),
      fetch(`${API}/agent/alerts`).then(r => r.json()),
      fetch(`${API}/agent/activity`).then(r => r.json()),
      fetch(`${API}/agent/audit?limit=25`).then(r => r.json()),
      fetch(`${API}/agent/guardrails`).then(r => r.json()),
      fetch(`${API}/agent/revenue-trend`).then(r => r.json()),
    ]);
    if (healthR.status === 'fulfilled') setHealth(healthR.value);
    if (statsR.status === 'fulfilled') setStats(statsR.value.stats);
    if (alertsR.status === 'fulfilled') setAlerts(alertsR.value.alerts || []);
    if (activityR.status === 'fulfilled') setActivity(activityR.value.activity || []);
    if (auditR.status === 'fulfilled') setRecentAudit(auditR.value.logs || []);
    if (grR.status === 'fulfilled') setGuardrails(grR.value.guardrails);
    if (trendR.status === 'fulfilled' && trendR.value.trend?.length >= 1) setRevenueTrend(trendR.value.trend);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Local development fallback for webhooks: periodically reconcile pending
  // Razorpay payment links, then refresh the live dashboard metrics.
  useEffect(() => {
    const syncPayments = async () => {
      try {
        await fetch(`${API}/razorpay/sync-status`, { method: 'POST' });
        fetchAll();
      } catch {
        // The normal dashboard fetch will surface any backend connection issue.
      }
    };
    const interval = setInterval(syncPayments, 10_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(fetchAll, 5000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [autoRefresh, fetchAll]);

  async function saveGuardrails(draft) {
    const res = await fetch(`${API}/agent/guardrails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (data.guardrails) setGuardrails(data.guardrails);
  }

  const rawNum = v => v != null ? Number(v) : 0;
  const usingDemoRevenueTrend = revenueTrend.length < 2;
  const chartRevenueTrend = useMemo(
    () => usingDemoRevenueTrend ? buildDemoRevenueTrend(stats?.total_revenue_inr) : revenueTrend,
    [revenueTrend, stats?.total_revenue_inr, usingDemoRevenueTrend],
  );

  function scrollToDashboard() {
    dashboardRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div>
      <HeroSection onScrollDown={scrollToDashboard} />

      <div className="container" ref={dashboardRef} style={{ scrollMarginTop: '60px' }}>
        {/* ── Greeting Header ──────────────────────────────────────── */}
        <div className="greeting-header">
          <div>
            <h1><span className="gradient-text">{greeting}, Merchant</span></h1>
            <p className="greeting-sub">Here is your AI commerce overview</p>
          </div>
          <div className="greeting-right">
            <span className="greeting-status">
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: health?.status === 'ok' ? '#059669' : '#DC2626',
                boxShadow: health?.status === 'ok' ? '0 0 8px rgba(52,211,153,0.5)' : '0 0 8px rgba(248,113,113,0.5)',
                animation: 'pulse-dot 2s ease-in-out infinite', display: 'inline-block',
              }} />
              Backend {health?.status === 'ok' ? 'connected' : health?.status || 'connecting…'}
            </span>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '0.8rem', color: '#6B7280', cursor: 'pointer',
              background: autoRefresh ? 'rgba(52,211,153,0.08)' : 'transparent',
              padding: '0.4rem 0.75rem', borderRadius: '8px',
              border: `1px solid ${autoRefresh ? 'rgba(52,211,153,0.2)' : 'transparent'}`,
              transition: 'all 0.15s',
            }}>
              {autoRefresh && <span className="live-dot" />}
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ display: 'none' }} />
              {autoRefresh ? 'Live' : 'Auto-refresh off'}
            </label>
          </div>
        </div>

        {/* ── Alert Banner ─────────────────────────────────────────── */}
        {alerts.length > 0 && (
          <div className="alert-banner" style={{ animation: 'border-glow 3s ease-in-out infinite, slide-in 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
                  {Icons.alert}
                </span>
                <p style={{ color: '#fb923c', fontWeight: 700, fontSize: '0.9rem' }}>
                  {alerts.length} Merchant Alert{alerts.length > 1 ? 's' : ''} — Manual Intervention Required
                </p>
              </div>
              <Link href="/failures" style={{ color: '#fb923c', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.75rem', borderRadius: '6px', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)', textDecoration: 'none' }}>
                Manage →
              </Link>
            </div>
            {alerts.slice(0, 2).map(a => (
              <p key={a.id} style={{ color: '#92400e', fontSize: '0.8rem', marginTop: '0.4rem', paddingLeft: '2.6rem' }}>{a.reason}</p>
            ))}
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <DashboardTabs active={activeTab} onChange={setActiveTab} />

        {/* ══════════════════════ OVERVIEW TAB ═══════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Revenue Hero Card */}
            <RevenueHeroCard totalRevenue={rawNum(stats?.total_revenue_inr)} />

            {/* Two Metric Cards */}
            <div className="dash-metrics-row">
              <MetricCard
                label="Revenue Recovered"
                value={rawNum(stats?.recovered_inr)}
                prefix="₹"
                color="#059669"
                icon={Icons.recovered}
                subtitle="by AI agents"
                trend={{ value: 12, direction: 'up' }}
              />
              <MetricCard
                label="Pending Orders"
                value={stats?.pending_orders != null ? Number(stats.pending_orders) : 0}
                color="#D97706"
                icon={Icons.pending}
                subtitle="campaign targets"
                trend={{ value: 3, direction: 'down' }}
              />
            </div>

            {/* Charts Row */}
            <div className="dash-charts-row">
              <RevenueChart data={chartRevenueTrend} stats={stats} isDemo={usingDemoRevenueTrend} />
              <DonutChart activity={activity} />
            </div>

            {/* Bottom Stats Row */}
            <div className="dash-stats-row">
              <StatTile label="Paid Orders" icon={Icons.orders} value={stats?.paid_orders ?? 0} color="#059669" trend={{ value: 8, direction: 'up' }} index={0} />
              <StatTile label="Merchant Alerts" icon={Icons.alert} value={stats?.merchant_alerts ?? 0} color={stats?.merchant_alerts > 0 ? '#fb923c' : '#9CA3AF'} href="/failures" sub="needs review" index={1} />
              <StatTile label="Active Agents" icon={Icons.agents} value={stats?.active_agents_24h ?? 0} color="#6366f1" sub="last 24h" index={2} />
            </div>

            {/* Transaction List */}
            <TransactionList logs={recentAudit} />
          </>
        )}

        {/* ══════════════════════ ACTIVITY TAB ══════════════════════ */}
        {activeTab === 'activity' && (
          <ActivityTabContent
            activity={activity}
            recentAudit={recentAudit}
            stats={stats}
            onRefresh={fetchAll}
          />
        )}

        {/* ══════════════════════ SETTINGS TAB ══════════════════════ */}
        {activeTab === 'settings' && (
          <>
            {/* Campaign Status */}
            <div className="card-glass" style={{ marginBottom: '1.5rem', borderLeft: '3px solid #1677C8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '8px', background: 'rgba(22,119,200,0.12)', color: '#1677C8', flexShrink: 0 }}>
                    {Icons.campaign}
                  </span>
                  <div>
                    <h2 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>Active Campaign Status</h2>
                    <p style={{ color: '#6B7280', fontSize: '0.8rem' }}>
                      {stats?.pending_orders ?? '—'} pending order{stats?.pending_orders !== 1 ? 's' : ''} eligible for recovery.
                      {stats?.last_campaign
                        ? ` Last run: ${new Date(stats.last_campaign + 'Z').toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}`
                        : ' Campaign not run yet.'}
                    </p>
                  </div>
                </div>
                <Link href="/campaign">
                  <button style={{ fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    Run Campaign <span>→</span>
                  </button>
                </Link>
              </div>
            </div>

            {/* Guardrail Settings */}
            <div className="card-glass">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                  {Icons.shield}
                </span>
                <h2 style={{ fontSize: '0.95rem' }}>Guardrail Settings</h2>
              </div>
              <p style={{ color: '#6B7280', fontSize: '0.78rem', marginBottom: '1.15rem', paddingLeft: '2.6rem' }}>
                Code-enforced limits on AI agent actions. Changes take effect immediately.
              </p>
              <div style={{ paddingLeft: '0.25rem' }}>
                {guardrails
                  ? <GuardrailPanel guardrails={guardrails} onSave={saveGuardrails} />
                  : <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9CA3AF', fontSize: '0.85rem' }}><span className="spin">⟳</span> Loading guardrail settings…</div>
                }
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
