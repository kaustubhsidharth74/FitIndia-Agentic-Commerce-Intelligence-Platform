import { useEffect, useState, useMemo } from 'react';

const API = 'http://localhost:4000/api';

const CATEGORY_THEME = {
  Nutrition:    { gradient: ['#DBEAFE', '#EFF6FF'], accent: '#1677C8' },
  Accessories:  { gradient: ['#EDE9FE', '#F5F3FF'], accent: '#8B5CF6' },
  Equipment:    { gradient: ['#D1FAE5', '#ECFDF5'], accent: '#10B981' },
  Subscription: { gradient: ['#FEF3C7', '#FFFBEB'], accent: '#F97316' },
};

const PRODUCT_ICONS = {
  'Protein Powder':       '🥤',
  'BCAA Energy Drink':    '⚡',
  'Peanut Butter':        '🥜',
  'Mass Gainer':          '🏋️',
  'Gym Gloves':           '🧤',
  'Shaker Bottle':        '🫗',
  'Wrist Wraps':          '🦾',
  'Gym Bag':              '🎒',
  'Resistance Bands':     '💪',
  'Yoga Mat':             '🧘',
  'Adjustable Dumbbells': '🏋️‍♂️',
  'Jump Rope':            '⏱️',
  'Monthly Supplement':   '💊',
  'Quarterly Plan':       '📋',
  'Annual Membership':    '🏅',
};

const CATEGORY_ORDER = ['Nutrition', 'Accessories', 'Equipment', 'Subscription'];

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('1');
  const [buying, setBuying] = useState(null);
  const [result, setResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    fetch(`${API}/catalog`)
      .then(r => r.json())
      .then(d => setProducts(d.products || []));

    fetch(`${API}/agent/customers`)
      .then(r => r.json())
      .then(d => setCustomers(d.customers || []));
  }, []);

  const grouped = useMemo(() => {
    const g = {};
    products.forEach(p => {
      const cat = p.category || 'Other';
      if (!g[cat]) g[cat] = [];
      g[cat].push(p);
    });
    return g;
  }, [products]);

  const sortedCategories = useMemo(() => {
    const cats = Object.keys(grouped);
    cats.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return cats;
  }, [grouped]);

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

  async function buy(productId) {
    setBuying(productId);
    setResult(null);
    setSyncResult(null);
    try {
      const res = await fetch(`${API}/razorpay/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: Number(customerId), product_id: productId }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ link: data.payment_link, amount: data.amount_inr });
      } else {
        setResult({ error: data.error });
      }
    } catch (e) {
      setResult({ error: 'Could not reach backend.' });
    } finally {
      setBuying(null);
    }
  }

  let cardIndex = 0;

  return (
    <div>
      <div className="container">
        {/* ── Page Header ── */}
        <div className="catalog-header">
          <div>
            <h1 className="catalog-title">FitIndia Store</h1>
            <p className="catalog-subtitle">
              Premium fitness products &middot; AI-powered checkout
            </p>
          </div>
          {products.length > 0 && (
            <span className="catalog-count">{products.length} Products</span>
          )}
        </div>

        {/* ── Customer Selector Bar ── */}
        <div className="catalog-customer-bar">
          <div className="catalog-customer-left">
            <span className="catalog-customer-icon">👤</span>
            <label className="catalog-customer-label">Buy as:</label>
            <select
              value={customerId}
              onChange={e => { setCustomerId(e.target.value); setResult(null); }}
              className="catalog-select"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>
          <span className="catalog-customer-hint">
            Also available at <code>GET /api/catalog</code> for AI agents
          </span>
        </div>

        {/* ── Payment Result Banner ── */}
        {result && (
          <div className={`catalog-result ${result.error ? 'error' : 'success'}`}>
            {result.error ? (
              <p className="catalog-result-text error">Error: {result.error}</p>
            ) : (
              <>
                <div className="catalog-result-row">
                  <div>
                    <p className="catalog-result-text success">
                      Payment link created — ₹{result.amount?.toLocaleString('en-IN')}
                    </p>
                    <p className="catalog-result-hint">
                      Test card: <code>4111 1111 1111 1111</code> &nbsp;|&nbsp; UPI: <code>success@razorpay</code>
                    </p>
                  </div>
                  <a href={result.link} target="_blank" rel="noreferrer" className="catalog-result-btn">
                    Open Payment →
                  </a>
                </div>
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(5,150,105,0.2)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <p style={{ color: '#6B7280', fontSize: '0.82rem' }}>
                    After paying in the Razorpay tab, click below to update your order status:
                  </p>
                  <button
                    onClick={syncStatus}
                    disabled={syncing}
                    style={{ background: syncing ? '#E2E8F0' : '#059669', color: '#fff', fontSize: '0.82rem', padding: '0.4rem 1rem', borderRadius: 8, border: 'none', cursor: syncing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {syncing ? 'Checking…' : 'I\'ve Paid — Check Status'}
                  </button>
                  {syncResult && (
                    <span style={{ fontSize: '0.82rem', color: syncResult.synced > 0 ? '#059669' : '#6B7280', fontWeight: 600 }}>
                      {syncResult.synced > 0
                        ? `✓ ${syncResult.synced} order(s) marked as paid!`
                        : `Checked ${syncResult.checked ?? 0} order(s) — payment not yet confirmed.`}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Category Sections ── */}
        {sortedCategories.map(cat => {
          const theme = CATEGORY_THEME[cat] || CATEGORY_THEME.Nutrition;
          const catProducts = grouped[cat];

          return (
            <div key={cat} className="catalog-section">
              <div className="catalog-section-header">
                <div className="catalog-section-title-row">
                  <div className="catalog-section-accent" style={{ background: theme.accent }} />
                  <h2 className="catalog-section-title">{cat}</h2>
                  <span className="catalog-section-count" style={{ color: theme.accent, background: `${theme.accent}15` }}>
                    {catProducts.length} {catProducts.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>

              <div className="catalog-grid">
                {catProducts.map(p => {
                  const emoji = PRODUCT_ICONS[p.name] || '📦';
                  const idx = cardIndex++;
                  const price = p.price_inr ?? (p.price_paise ? p.price_paise / 100 : 0);

                  return (
                    <div
                      key={p.id}
                      className="product-card"
                      style={{
                        '--card-accent': theme.accent,
                        animationDelay: `${0.1 + idx * 0.08}s`,
                      }}
                    >
                      {/* Top visual zone */}
                      <div
                        className="product-card-visual"
                        style={{
                          background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
                        }}
                      >
                        <span
                          className="product-card-category"
                          style={{ color: theme.accent, background: `${theme.accent}20`, borderColor: `${theme.accent}40` }}
                        >
                          {cat}
                        </span>
                        <span className="product-card-emoji">{emoji}</span>
                      </div>

                      {/* Bottom info zone */}
                      <div className="product-card-body">
                        <h3 className="product-card-name">{p.name}</h3>
                        {p.description && (
                          <p className="product-card-desc">{p.description}</p>
                        )}
                        <div className="product-card-price-row">
                          <span className="product-card-price" style={{ color: theme.accent }}>
                            ₹{price.toLocaleString('en-IN')}
                          </span>
                          <span className="product-card-stock">
                            <span className="product-card-stock-dot" style={{ background: p.stock > 50 ? '#06D6A0' : p.stock > 10 ? '#FB923C' : '#EF4444' }} />
                            {p.stock} in stock
                          </span>
                        </div>
                        <button
                          onClick={() => buy(p.id)}
                          disabled={buying === p.id || !p.buyable}
                          className="product-card-btn"
                          style={{
                            background: buying === p.id
                              ? '#E2E8F0'
                              : `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
                          }}
                        >
                          {buying === p.id ? 'Creating link...' : !p.buyable ? 'Out of Stock' : 'Buy Now →'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {products.length === 0 && (
          <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '3rem 0' }}>
            No products found. Run <code>seed.js</code> first.
          </p>
        )}
      </div>
    </div>
  );
}
