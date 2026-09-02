import { useEffect, useState } from 'react';
import Link from 'next/link';

import ChatBox from '../components/ChatBox';

const API = 'http://localhost:4000/api';

export default function ChatCheckout() {
  const [customers,  setCustomers]  = useState([]);
  const [customerId, setCustomerId] = useState(1);
  const [chatKey,    setChatKey]    = useState(0); // increment to reset ChatBox

  useEffect(() => {
    fetch(`${API}/agent/customers`)
      .then(r => r.json())
      .then(d => setCustomers(d.customers || []));
  }, []);

  function switchCustomer(id) {
    setCustomerId(Number(id));
    setChatKey(k => k + 1); // fresh conversation when switching customer
  }

  const currentCustomer = customers.find(c => c.id === customerId);

  return (
    <div>


      <div className="container">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="page-title">Conversational Checkout</h1>
          <p className="page-subtitle">
            Direction 1 — Customer types intent, AI finds the product and generates a payment link inside chat.
          </p>
        </div>

        {/* Customer selector */}
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ color: '#6B7280', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>Shopping as:</label>
          <select
            value={customerId}
            onChange={e => switchCustomer(e.target.value)}
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1A1A1A',
                     padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.9rem', cursor: 'pointer' }}
          >
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
            ))}
          </select>
          <span style={{ color: '#9CA3AF', fontSize: '0.82rem' }}>
            Switching customer starts a new conversation.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Chat */}
          <ChatBox
            key={chatKey}
            customerId={customerId}
            customerName={currentCustomer?.name || 'Guest'}
          />

          {/* Tips panel */}
          <div style={{ flex: '1 1 220px', minWidth: 200 }}>
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Try saying…</h3>
              <ul style={{ color: '#6B7280', fontSize: '0.85rem', lineHeight: 2, paddingLeft: '1.1rem' }}>
                <li>"I want to buy Protein Powder"</li>
                <li>"Show me your products"</li>
                <li>"I'm looking for gym accessories"</li>
                <li>"What's the price of Shaker Bottle?"</li>
                <li>"I just paid"</li>
              </ul>
            </div>
            <div className="card" style={{ marginTop: '0.75rem' }}>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Mode</h3>
              <p style={{ color: '#6B7280', fontSize: '0.82rem', lineHeight: 1.7 }}>
                <span style={{ color: process.env.NEXT_PUBLIC_MOCK_AI === 'false' ? '#059669' : '#D97706' }}>
                  AI: {process.env.NEXT_PUBLIC_MOCK_AI === 'false' ? 'Claude (live)' : 'Mock mode'}
                </span>
                <br />
                Set <code>MOCK_AI=false</code> + real Anthropic key for Claude.
                <br /><br />
                Payment links auto-capture in 5s during mock mode.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
