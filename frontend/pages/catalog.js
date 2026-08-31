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
  const [cart, setCart] = useState([]);
  const [checkingOut, setCheckingOut] = useState(false);
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

  function addToCart(product) {
    setResult(null);
    setCart(current => {
      const existing = current.find(item => item.product_id === product.id);
      if (existing) {
        return current.map(item => item.product_id === product.id
          ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
          : item);
      }
      return [...current, { product_id: product.id, name: product.name, price_inr: product.price_inr, stock: product.stock, quantity: 1 }];
    });
  }

  function updateCartQuantity(productId, quantity) {
    setCart(current => current
      .map(item => item.product_id === productId ? { ...item, quantity: Math.max(0, Math.min(Number(quantity) || 0, item.stock)) } : item)
      .filter(item => item.quantity > 0));
  }

  async function checkoutCart() {
    if (cart.length === 0) return;
    setCheckingOut(true);
    setResult(null);
    setSyncResult(null);
    setMockOutcome(null);
    try {
      const res = await fetch(`${API}/razorpay/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: Number(customerId),
          items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ link: data.payment_link, amount: data.amount_inr, db_order_id: data.db_order_id, mock: data.mock });
        setCart([]);
      } else {
        setResult({ error: data.error });
      }
    } catch {
      setResult({ error: 'Could not reach backend.' });
    } finally {
      setCheckingOut(false);
    }
  }

  const [mockOutcome, setMockOutcome] = useState(null); // null | 'success' | 'fail'
  const [mockLoading, setMockLoading] = useState(false);

  async function resolveMockPayment(outcome) {
    if (!result?.db_order_id) return;
    setMockLoading(true);
    try {
      const res = await fetch(`${API}/razorpay/mock-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_order_id: result.db_order_id, outcome }),
      });
      const data = await res.json();
      if (data.success) setMockOutcome(outcome);
    } catch {
      // ignore
    } finally {
      setMockLoading(false);
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

        {/* Cart checkout */}
        <div className="card" style={{ marginBottom: '2rem', padding: '1rem 1.25rem', borderColor: cart.length ? '#93C5FD' : '#E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)} item{cart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? '' : 's'})</h3>
              <p style={{ margin: '0.25rem 0 0', color: '#6B7280', fontSize: '0.82rem' }}>Add one or more products, then create one payment link.</p>
            </div>
            {cart.length > 0 && (
              <button onClick={checkoutCart} disabled={checkingOut} style={{ background: '#1677C8', color: '#fff', border: 'none', borderRadius: 8, padding: '0.65rem 1rem', fontWeight: 700, cursor: checkingOut ? 'not-allowed' : 'pointer' }}>
                {checkingOut ? 'Creating payment link...' : `Checkout · ₹${cart.reduce((sum, item) => sum + item.price_inr * item.quantity, 0).toLocaleString('en-IN')}`}
              </button>
            )}
          </div>
          {cart.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.9rem' }}>
              {cart.map(item => (
                <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.4rem 0.55rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.82rem' }}>
                  <strong>{item.name}</strong>
                  <button onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}>−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)} disabled={item.quantity >= item.stock} style={{ border: 'none', background: 'transparent', cursor: item.quantity >= item.stock ? 'not-allowed' : 'pointer', fontWeight: 700 }}>+</button>
                  <button onClick={() => updateCartQuantity(item.product_id, 0)} aria-label={`Remove ${item.name}`} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626', fontWeight: 700 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Payment Result Banner ── */}
        {result && (
          <div className={`catalog-result ${result.error ? 'error' : 'success'}`}>
            {result.error ? (
              <p className="catalog-result-text error">Error: {result.error}</p>
            ) : result.mock ? (
              /* ── Mock Payment Simulator ── */
              <>
                <div className="catalog-result-row">
                  <div>
                    <p className="catalog-result-text success">
                      Order #{result.db_order_id} created — ₹{result.amount?.toLocaleString('en-IN')}
                    </p>
                    <p className="catalog-result-hint">
                      Mock mode active — choose what happens to this payment:
                    </p>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#6B7280', background: '#F1F5F9', padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                    🧪 Mock Mode
                  </span>
                </div>

                {mockOutcome ? (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(5,150,105,0.2)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {mockOutcome === 'success' ? (
                      <>
                        <span style={{ fontSize: '1.1rem' }}>✅</span>
                        <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.88rem' }}>Payment marked as paid — go to Failure &amp; Recovery to test retry flow.</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '1.1rem' }}>❌</span>
                        <span style={{ color: '#DC2626', fontWeight: 600, fontSize: '0.88rem' }}>Payment marked as failed — go to <a href="/failures" style={{ color: '#DC2626' }}>Failure &amp; Recovery</a> to run the retry agent.</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(5,150,105,0.2)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#6B7280', fontSize: '0.82rem' }}>Simulate payment outcome:</span>
                    <button
                      onClick={() => resolveMockPayment('success')}
                      disabled={mockLoading}
                      style={{ background: '#059669', color: '#fff', fontSize: '0.82rem', fontWeight: 700, padding: '0.45rem 1.1rem', borderRadius: 8, border: 'none', cursor: mockLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      ✅ Payment Succeeds
                    </button>
                    <button
                      onClick={() => resolveMockPayment('fail')}
                      disabled={mockLoading}
                      style={{ background: '#DC2626', color: '#fff', fontSize: '0.82rem', fontWeight: 700, padding: '0.45rem 1.1rem', borderRadius: 8, border: 'none', cursor: mockLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      ❌ Payment Fails
                    </button>
                    {mockLoading && <span style={{ color: '#6B7280', fontSize: '0.82rem' }}>Processing…</span>}
                  </div>
                )}
              </>
            ) : (
              /* ── Live / real Razorpay ── */
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
                          onClick={() => addToCart(p)}
                          disabled={!p.buyable}
                          className="product-card-btn"
                          style={{
                            background: !p.buyable
                              ? '#E2E8F0'
                              : `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
                          }}
                        >
                          {!p.buyable ? 'Out of Stock' : 'Add to Cart'}
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
