import { useEffect, useState, useMemo } from 'react';

const API = 'http://localhost:4000/api';

const AVATAR_COLORS = ['#1677C8', '#8B5CF6', '#10B981', '#F97316', '#EC4899', '#0EA5E9', '#EF4444', '#84CC16'];

function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function UpsellResult({ result }) {
  if (!result) return null;
  const isOk = result.success;
  return (
    <div className={`cust-upsell-panel ${isOk ? 'success' : 'error'}`}>
      {isOk ? (
        <>
          <p className="cust-upsell-title">
            Upsell created {result.mock_ai ? '[mock AI]' : '[Claude]'} {result.mock_razorpay ? '[mock pay]' : '[real pay]'}
          </p>
          <div className="cust-upsell-details">
            <div className="cust-upsell-grid">
              {[
                ['Product', result.product],
                ['Original', `₹${result.original_price}`],
                ['Discount', `${result.discount_percent}%`],
                ['Final', `₹${result.final_price}`],
              ].map(([k, v]) => (
                <div key={k} className="cust-upsell-item">
                  <span className="cust-upsell-label">{k}</span>
                  <span className="cust-upsell-value">{v}</span>
                </div>
              ))}
            </div>
            <p className="cust-upsell-reasoning">Reasoning: {result.reasoning}</p>
            <p className="cust-upsell-message">"{result.message}"</p>
            <a href={result.payment_link} target="_blank" rel="noreferrer" className="cust-upsell-link">
              Open Payment Link →
            </a>
          </div>
        </>
      ) : (
        <p className="cust-upsell-error">
          {result.error?.startsWith('Guardrail') ? '🛡 ' : ''}
          {result.error}
        </p>
      )}
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState({});
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [customerOrders, setCustomerOrders] = useState({});
  const [loadingOrders, setLoadingOrders] = useState(null);

  useEffect(() => {
    fetch(`${API}/agent/customers`)
      .then(r => r.json())
      .then(d => setCustomers(d.customers || []));
  }, []);

  async function toggleOrders(customerId) {
    if (expandedId === customerId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(customerId);
    if (customerOrders[customerId]) return;
    setLoadingOrders(customerId);
    try {
      const res = await fetch(`${API}/agent/customers/${customerId}/orders`);
      const data = await res.json();
      setCustomerOrders(prev => ({ ...prev, [customerId]: data.orders || [] }));
    } catch {
      setCustomerOrders(prev => ({ ...prev, [customerId]: [] }));
    } finally {
      setLoadingOrders(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [customers, search]);

  async function runUpsell(customerId) {
    setRunning(customerId);
    setResults(prev => ({ ...prev, [customerId]: null }));
    try {
      const res = await fetch(`${API}/agent/upsell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      });
      const data = await res.json();
      setResults(prev => ({ ...prev, [customerId]: data }));
    } catch {
      setResults(prev => ({ ...prev, [customerId]: { success: false, error: 'Backend unreachable' } }));
    } finally {
      setRunning(null);
    }
  }

  return (
    <div>
      <div className="container">
        {/* ── Page Header ── */}
        <div className="cust-header">
          <div>
            <h1 className="page-title">Customers</h1>
            <p className="page-subtitle">
              Manage your customer base and run AI-powered upsell campaigns.
            </p>
          </div>
          <div className="cust-header-right">
            <span className="cust-count-badge">
              {customers.length} {customers.length === 1 ? 'Customer' : 'Customers'}
            </span>
          </div>
        </div>

        {/* ── Search + Summary Bar ── */}
        <div className="cust-toolbar">
          <div className="cust-search-wrap">
            <span className="cust-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="cust-search"
            />
          </div>
          <span className="cust-summary">
            Showing <strong>{filtered.length}</strong> of <strong>{customers.length}</strong> customers
          </span>
        </div>

        {/* ── Table ── */}
        <div className="cust-table-wrap">
          {/* Header */}
          <div className="cust-thead">
            <span>Customer</span>
            <span>Type</span>
            <span>Phone</span>
            <span className="cust-center">Orders</span>
            <span className="cust-center">Paid</span>
            <span className="cust-right">Spent</span>
            <span className="cust-center">Action</span>
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="cust-empty">
              {customers.length === 0
                ? 'No customers found. Run seed.js first.'
                : `No customers match "${search}"`
              }
            </div>
          ) : (
            filtered.map((c, i) => {
              const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const spent = ((c.total_spent_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 });

              const isExpanded = expandedId === c.id;
              const orders = customerOrders[c.id];
              const isLoadingThis = loadingOrders === c.id;

              return (
                <div key={c.id}>
                  <div
                    className={`cust-row ${isExpanded ? 'expanded' : ''}`}
                    style={{ animationDelay: `${0.05 + i * 0.06}s`, cursor: 'pointer' }}
                    onClick={() => toggleOrders(c.id)}
                  >
                    {/* Customer */}
                    <div className="cust-cell-customer">
                      <div className="cust-avatar" style={{ background: `${color}20`, color }}>
                        {getInitials(c.name)}
                      </div>
                      <div>
                        <div className="cust-name">{c.name}</div>
                        <div className="cust-email">{c.email}</div>
                      </div>
                    </div>

                    {/* Type */}
                    <div className="cust-cell">
                      <span className={`cust-type-badge ${c.type}`}>{c.type}</span>
                    </div>

                    {/* Phone */}
                    <div className="cust-cell cust-phone">{c.phone || '—'}</div>

                    {/* Orders */}
                    <div className="cust-cell cust-center cust-stat">{c.total_orders ?? 0}</div>

                    {/* Paid */}
                    <div className="cust-cell cust-center cust-stat">{c.paid_orders ?? 0}</div>

                    {/* Spent */}
                    <div className="cust-cell cust-right cust-spent">₹{spent}</div>

                    {/* Action */}
                    <div className="cust-cell cust-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); runUpsell(c.id); }}
                        disabled={running === c.id}
                        className="cust-action-btn"
                      >
                        {running === c.id ? 'Running...' : 'Upsell →'}
                      </button>
                    </div>
                  </div>

                  {/* Order history panel */}
                  {isExpanded && (
                    <div className="cust-orders-panel">
                      <div className="cust-orders-header">
                        <span className="cust-orders-title">Purchase History</span>
                        <span className="cust-orders-count">
                          {isLoadingThis ? 'Loading...' : orders ? `${orders.length} orders` : ''}
                        </span>
                      </div>
                      {isLoadingThis ? (
                        <div className="cust-orders-loading">
                          <span className="cust-orders-spinner" />
                          Fetching orders...
                        </div>
                      ) : !orders || orders.length === 0 ? (
                        <div className="cust-orders-empty">No purchases found for this customer.</div>
                      ) : (
                        <>
                          <div className="cust-orders-thead">
                            <span>Product</span>
                            <span>Date & Time</span>
                            <span className="cust-center">Qty</span>
                            <span className="cust-right">Amount</span>
                            <span className="cust-center">Status</span>
                          </div>
                          {orders.map(o => {
                            const statusColor = o.status === 'paid' ? '#059669' : o.status === 'failed' ? '#DC2626' : '#D97706';
                            const statusBg = o.status === 'paid' ? 'rgba(5,150,105,0.1)' : o.status === 'failed' ? 'rgba(220,38,38,0.1)' : 'rgba(217,119,6,0.1)';
                            return (
                              <div key={o.id} className="cust-order-row">
                                <span className="cust-order-product">{o.product_name || 'Unknown'}</span>
                                <span className="cust-order-date">
                                  {new Date(o.created_at + 'Z').toLocaleString('en-IN', {
                                    timeZone: 'Asia/Kolkata',
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit', hour12: true,
                                  })}
                                </span>
                                <span className="cust-order-qty cust-center">{o.quantity || 1}</span>
                                <span className="cust-order-amount cust-right">
                                  ₹{((o.total_paise || 0) / 100).toLocaleString('en-IN')}
                                </span>
                                <span className="cust-center">
                                  <span
                                    className="cust-order-status"
                                    style={{ color: statusColor, background: statusBg, borderColor: `${statusColor}30` }}
                                  >
                                    {o.status}
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {/* Upsell result panel */}
                  <UpsellResult result={results[c.id]} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
