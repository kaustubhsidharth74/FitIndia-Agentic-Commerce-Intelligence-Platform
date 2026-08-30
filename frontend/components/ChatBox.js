import { useState, useRef, useEffect } from 'react';

const API = 'http://localhost:4000/api';

function Message({ msg }) {
  if (msg.role === 'system') {
    return (
      <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
        <a href={msg.link} target="_blank" rel="noreferrer" style={{
          display: 'inline-block', background: '#0ea5e9', color: '#fff',
          padding: '0.55rem 1.5rem', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem',
        }}>
          Pay Now — ₹{msg.amount} →
        </a>
        <p style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.35rem' }}>
          Test UPI: <code>success@razorpay</code> &nbsp;|&nbsp; Card: <code>4111 1111 1111 1111</code>
        </p>
      </div>
    );
  }

  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '0.5rem',
    }}>
      <div style={{
        background:   isUser ? '#0ea5e9' : '#E2E8F0',
        color:        '#fff',
        padding:      '0.6rem 1rem',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        maxWidth:     '80%',
        fontSize:     '0.9rem',
        lineHeight:   1.5,
        whiteSpace:   'pre-wrap',
      }}>
        {msg.content}
      </div>
    </div>
  );
}

export default function ChatBox({ customerId = 1, customerName = 'Guest' }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm the FitIndia AI assistant. Tell me what you'd like to buy and I'll set up payment instantly.\n\nTry: "I want to buy Protein Powder" or "Show me your products"`,
    },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    const next    = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      // Send only role+content messages (strip system messages)
      const history = next.filter(m => m.role === 'user' || m.role === 'assistant');
      const res  = await fetch(`${API}/agent/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history, customer_id: customerId }),
      });
      const data = await res.json();

      const newMessages = [...next];

      if (data.reply) {
        newMessages.push({ role: 'assistant', content: data.reply });
      }
      if (data.paymentLink) {
        newMessages.push({
          role:   'system',
          link:   data.paymentLink,
          amount: data.amount_inr ?? '?',
        });
      }
      setMessages(newMessages);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach backend. Make sure it\'s running on port 4000.' }]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessages([{
      role: 'assistant',
      content: `Hi! I'm the FitIndia AI assistant. Tell me what you'd like to buy and I'll set up payment instantly.\n\nTry: "I want to buy Protein Powder" or "Show me your products"`,
    }]);
    setInput('');
  }

  return (
    <div className="card" style={{ maxWidth: 660 }}>
      {/* Chat header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
        <div>
          <span style={{ fontWeight: 600 }}>FitIndia AI</span>
          <span style={{ color: '#6B7280', fontSize: '0.82rem', marginLeft: '0.5rem' }}>
            Buying as: <strong style={{ color: '#1677C8' }}>{customerName}</strong>
          </span>
        </div>
        <button onClick={reset} style={{ background: '#E2E8F0', fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>
          New chat
        </button>
      </div>

      {/* Message list */}
      <div style={{ height: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
        {messages.map((m, i) => <Message key={i} msg={m} />)}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6B7280', fontSize: '0.85rem' }}>
            <span style={{ display: 'flex', gap: 3 }}>
              {[0,1,2].map(i => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#475569',
                  animation: `pulse 1.2s ${i*0.2}s infinite` }} />
              ))}
            </span>
            AI thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        {['Protein Powder', 'Gym Gloves', 'Show products'].map(s => (
          <button key={s} onClick={() => { setInput(s); }}
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '0.78rem', padding: '0.25rem 0.65rem', color: '#6B7280' }}>
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder='Type your message…'
          disabled={loading}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{ whiteSpace: 'nowrap' }}>
          Send
        </button>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
      `}</style>
    </div>
  );
}
