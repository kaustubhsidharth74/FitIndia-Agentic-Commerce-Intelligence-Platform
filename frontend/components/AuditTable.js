export default function AuditTable({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="card">
        <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '2rem 0' }}>
          No audit entries yet. Agents will write here as they act.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
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
          {logs.map(log => (
            <tr key={log.id}>
              <td style={{ whiteSpace: 'nowrap', color: '#6B7280' }}>
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td>{log.agent}</td>
              <td>{log.action_type}</td>
              <td>{log.customer_name || '—'}</td>
              <td>
                {log.amount_paise
                  ? `₹${(log.amount_paise / 100).toFixed(2)}`
                  : '—'}
              </td>
              <td style={{ maxWidth: 280, color: '#6B7280', fontSize: '0.82rem' }}>
                {log.reason || '—'}
              </td>
              <td>
                <span className={`badge ${log.result || 'pending'}`}>
                  {log.result || 'pending'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
