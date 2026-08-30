import { useEffect, useState, useCallback, useMemo, useRef } from 'react';

const API = 'http://localhost:4000/api';
const PER_PAGE = 12;
const PAYMENT_SYNC_INTERVAL_SECONDS = 10;

const RESULT_COLORS = {
  success: { bg: 'rgba(16,185,129,0.12)', color: '#059669' },
  failed:  { bg: 'rgba(239,68,68,0.12)', color: '#DC2626' },
  pending: { bg: 'rgba(245,158,11,0.12)', color: '#D97706' },
  ok:      { bg: 'rgba(51,149,255,0.10)', color: '#2878CC' },
};

function Badge({ value }) {
  const style = RESULT_COLORS[value] || { bg: '#F1F5F9', color: '#6B7280' };
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: 999,
      fontSize: '0.75rem', fontWeight: 600,
      background: style.bg, color: style.color,
    }}>
      {value || '—'}
    </span>
  );
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [secondsUntilSync, setSecondsUntilSync] = useState(PAYMENT_SYNC_INTERVAL_SECONDS);
  const syncInProgress = useRef(false);

  const [filterAgent, setFilterAgent] = useState('');
  const [filterResult, setFilterResult] = useState('');
  const [sortBy, setSortBy] = useState('latest');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 500 });
    if (filterAgent) params.set('agent', filterAgent);
    if (filterResult) params.set('result', filterResult);

    fetch(`${API}/agent/audit?${params}`)
      .then(r => r.json())
      .then(d => { setLogs(d.logs || []); setStats(d.stats || null); })
      .finally(() => setLoading(false));
  }, [filterAgent, filterResult]);

  useEffect(() => {
    fetch(`${API}/agent/audit/agents`)
      .then(r => r.json())
      .then(d => setAgents(d.agents || []));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filterAgent, filterResult, sortBy]);

  const sortedLogs = useMemo(() => {
    const sorted = [...logs];
    switch (sortBy) {
      case 'oldest':
        sorted.sort((a, b) => a.id - b.id);
        break;
      case 'amount-high':
        sorted.sort((a, b) => (b.amount_paise || 0) - (a.amount_paise || 0));
        break;
      case 'amount-low':
        sorted.sort((a, b) => (a.amount_paise || 0) - (b.amount_paise || 0));
        break;
      case 'success-first':
        sorted.sort((a, b) => {
          const order = { success: 0, pending: 1, failed: 2 };
          return (order[a.result] ?? 3) - (order[b.result] ?? 3);
        });
        break;
      case 'failed-first':
        sorted.sort((a, b) => {
          const order = { failed: 0, pending: 1, success: 2 };
          return (order[a.result] ?? 3) - (order[b.result] ?? 3);
        });
        break;
      default:
        sorted.sort((a, b) => b.id - a.id);
    }
    return sorted;
  }, [logs, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageLogs = useMemo(() =>
    sortedLogs.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE),
    [sortedLogs, currentPage]
  );
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  const syncPayments = useCallback(async ({ silent = false } = {}) => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${API}/razorpay/sync-status`, { method: 'POST' });
      const data = await res.json();
      if (silent) {
        load();
        return;
      }
      setSyncMsg(data.synced > 0
        ? `✓ ${data.synced} payment(s) updated to paid`
        : 'All orders already up to date');
      load();
    } catch {
      if (!silent) setSyncMsg('Could not reach backend');
    } finally {
      setSyncing(false);
      syncInProgress.current = false;
      setSecondsUntilSync(PAYMENT_SYNC_INTERVAL_SECONDS);
      if (!silent) setTimeout(() => setSyncMsg(null), 4000);
    }
  }, [load]);

  // Local fallback for webhooks: check Razorpay and refresh the audit trail
  // every 10 seconds while this page is open.
  useEffect(() => {
    const paymentSync = setInterval(
      () => syncPayments({ silent: true }),
      PAYMENT_SYNC_INTERVAL_SECONDS * 1000,
    );
    const countdown = setInterval(() => {
      setSecondsUntilSync(seconds => seconds <= 1 ? PAYMENT_SYNC_INTERVAL_SECONDS : seconds - 1);
    }, 1000);

    return () => {
      clearInterval(paymentSync);
      clearInterval(countdown);
    };
  }, [syncPayments]);

  const selectStyle = {
    background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1A1A1A',
    padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <div>
      <div className="container">
        {/* Header */}
        <div className="audit-page-header">
          <div>
            <h1 className="audit-page-title">Audit Trail</h1>
            <p className="audit-page-subtitle">
              Every action every AI agent takes — timestamped, with reasoning and result.
            </p>
          </div>
          <div className="audit-page-actions">
            <button
              onClick={syncPayments}
              disabled={syncing}
              className="audit-btn"
              style={{ background: syncing ? '#E2E8F0' : '#059669', color: '#fff', border: 'none', fontWeight: 600 }}
            >
              {syncing ? 'Syncing…' : 'Sync Payments'}
            </button>
            <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
              {syncing ? 'Auto-syncing payment status…' : `Auto-sync in ${secondsUntilSync}s`}
            </span>
            {syncMsg && (
              <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 500 }}>{syncMsg}</span>
            )}
            {/*
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={`audit-btn ${autoRefresh ? 'active' : ''}`}
            >
              {autoRefresh ? '⏸ Auto-refresh ON' : '▶ Auto-refresh'}
            </button>
            <button onClick={load} className="audit-btn refresh">Refresh</button>
            */}
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="audit-stats-row">
            {[
              { label: 'Total Actions', value: stats.total, color: '#1677C8' },
              { label: 'Successful', value: stats.success, color: '#059669' },
              { label: 'Failed', value: stats.failed, color: '#DC2626' },
              { label: 'Revenue Logged', value: `₹${((stats.total_revenue_paise || 0) / 100).toLocaleString('en-IN')}`, color: '#D97706' },
            ].map(t => (
              <div key={t.label} className="audit-stat-card">
                <div className="audit-stat-value" style={{ color: t.color }}>{t.value}</div>
                <div className="audit-stat-label">{t.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="audit-filter-bar">
          <span className="audit-filter-label">Filter:</span>
          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} style={selectStyle}>
            <option value="">All agents</option>
            {agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filterResult} onChange={e => setFilterResult(e.target.value)} style={selectStyle}>
            <option value="">All results</option>
            <option value="success">success</option>
            <option value="failed">failed</option>
            <option value="pending">pending</option>
          </select>
          <span className="audit-filter-divider" />

          <span className="audit-filter-label">Sort:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
            <option value="latest">Latest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount-high">Amount ↓</option>
            <option value="amount-low">Amount ↑</option>
          </select>

          {(filterAgent || filterResult || sortBy !== 'latest') && (
            <button
              onClick={() => { setFilterAgent(''); setFilterResult(''); setSortBy('latest'); }}
              className="audit-btn clear"
            >
              Reset all
            </button>
          )}
          <span className="audit-entry-count">
            {loading ? 'Loading…' : `${logs.length} entries`}
          </span>
        </div>

        {/* Table */}
        {logs.length === 0 && !loading ? (
          <div className="audit-empty">
            No audit entries match the current filters.
          </div>
        ) : (
          <div className="audit-table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: '1.25rem' }}>#</th>
                  <th>Timestamp</th>
                  <th>Agent</th>
                  <th>Action</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {pageLogs.map(log => (
                  <tr key={log.id} style={{ opacity: loading ? 0.5 : 1 }}>
                    <td style={{ paddingLeft: '1.25rem', color: '#9CA3AF', fontSize: '0.8rem' }}>{log.id}</td>
                    <td style={{ whiteSpace: 'nowrap', color: '#6B7280', fontSize: '0.82rem' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td>
                      <span className="audit-agent-tag">{log.agent}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{log.action_type}</td>
                    <td style={{ fontSize: '0.85rem' }}>{log.customer_name || <span style={{ color: '#9CA3AF' }}>—</span>}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.85rem' }}>
                      {log.amount_paise
                        ? `₹${(log.amount_paise / 100).toLocaleString('en-IN')}`
                        : <span style={{ color: '#9CA3AF' }}>—</span>}
                    </td>
                    <td style={{ maxWidth: 260, color: '#6B7280', fontSize: '0.82rem' }}>
                      {log.reason || <span style={{ color: '#9CA3AF' }}>—</span>}
                    </td>
                    <td><Badge value={log.result} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="audit-pagination">
                <button
                  className="audit-page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  ← Prev
                </button>

                <div className="audit-page-numbers">
                  {pageNumbers.map((pn, i) =>
                    pn === '...' ? (
                      <span key={`e${i}`} className="audit-page-ellipsis">…</span>
                    ) : (
                      <button
                        key={pn}
                        className={`audit-page-num ${pn === currentPage ? 'active' : ''}`}
                        onClick={() => setPage(pn)}
                      >
                        {pn}
                      </button>
                    )
                  )}
                </div>

                <button
                  className="audit-page-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next →
                </button>

                <span className="audit-page-info">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
