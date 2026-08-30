require('dotenv').config({ path: '../.env' });

// Route all outbound HTTPS through the corporate proxy.
// We patch https.request directly because axios (used by Razorpay SDK) sets
// agent:false which bypasses https.globalAgent — the patch forces the proxy
// agent onto every outbound HTTPS request regardless.
if (process.env.HTTPS_PROXY) {
  const https = require('https');
  const { HttpsProxyAgent } = require('https-proxy-agent');
  const proxyAgent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
  https.globalAgent = proxyAgent;

  const _originalRequest = https.request.bind(https);
  https.request = function patchedRequest(options, callback) {
    if (typeof options === 'object') {
      options.agent = proxyAgent;
    }
    return _originalRequest(options, callback);
  };

  console.log(`Proxy: ${process.env.HTTPS_PROXY}`);
}

const express = require('express');
const cors    = require('cors');
const { initDB } = require('./db/database');

const razorpayRoutes = require('./routes/razorpay');
const agentRoutes    = require('./routes/agent');
const catalogRoutes  = require('./routes/catalog');
const webhookRoutes  = require('./routes/webhook');
const fraudRoutes    = require('./routes/fraud');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));

// Webhook must get raw body — mount before json middleware
app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());

app.use('/api/razorpay', razorpayRoutes);
app.use('/api/agent',    agentRoutes);
app.use('/api/catalog',  catalogRoutes);
app.use('/api/fraud',    fraudRoutes);

// POST /api/buy  — top-level agent-friendly buy endpoint
app.post('/api/buy', async (req, res) => {
  req.url = '/buy';
  catalogRoutes(req, res, () => res.status(404).json({ error: 'Not found' }));
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Init DB first, then start server
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FitIndia backend running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to init DB:', err);
    process.exit(1);
  });
