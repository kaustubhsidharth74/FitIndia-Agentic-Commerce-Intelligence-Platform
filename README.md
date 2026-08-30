# FitIndia — AI Commerce Intelligence Platform

> **Hackathon Track 01 — AI Growth & Agentic Commerce**
> Build an agent that grows revenue for a merchant on Razorpay test-mode APIs, or that makes a merchant transactable by an AI buyer end to end.

---

## What It Does

FitIndia is an autonomous AI commerce platform for a fitness products store. Instead of a merchant manually managing orders, follow-ups, and marketing — **5 specialized AI agents** handle everything end-to-end using Claude AI and Razorpay's payment infrastructure.

Every money action is **explainable** (full reasoning logged), **bounded** (guardrails enforced in code), and **gated** (merchant alert raised on failure).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│  Dashboard · Catalog · Chat · Buyer · Campaign · Audit · Failures│
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API (HTTP)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express.js)                         │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  ┌──────────┐ │
│  │ /api/agent  │  │/api/catalog │  │/api/razorpay│ │/api/      │ │
│  │             │  │             │  │           │  │webhook   │ │
│  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  └────┬─────┘ │
│         │                │               │              │        │
│         ▼                ▼               ▼              ▼        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    5 AI AGENTS                            │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐   │   │
│  │  │ Checkout    │  │   Buyer     │  │    Upsell      │   │   │
│  │  │ Agent       │  │   Agent     │  │    Agent       │   │   │
│  │  │ (chat flow) │  │ (autonomous │  │ (cross-sell    │   │   │
│  │  │             │  │  purchases) │  │  + discount)   │   │   │
│  │  └─────────────┘  └─────────────┘  └────────────────┘   │   │
│  │                                                           │   │
│  │  ┌─────────────────────┐  ┌──────────────────────────┐   │   │
│  │  │  Campaign Agent     │  │     Retry Agent          │   │   │
│  │  │ (abandoned cart     │  │  (failed payment retry + │   │   │
│  │  │  recovery)          │  │   merchant alert)        │   │   │
│  │  └─────────────────────┘  └──────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                       │
│         ┌─────────────────┼──────────────────┐                  │
│         ▼                 ▼                  ▼                   │
│  ┌────────────┐   ┌──────────────┐   ┌─────────────────┐        │
│  │  SQLite DB │   │ Claude AI    │   │  Razorpay API   │        │
│  │            │   │ (claude-     │   │  (test mode)    │        │
│  │ products   │   │  opus-5)     │   │  Payment Links  │        │
│  │ customers  │   │              │   │  Webhooks       │        │
│  │ orders     │   │ Tool-use     │   │                 │        │
│  │ audit_log  │   │ Agentic loop │   │                 │        │
│  └────────────┘   └──────────────┘   └─────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## The 5 AI Agents

### 1. Conversational Checkout Agent
**Route:** `POST /api/agent/chat` | **Page:** `/chat`

Customer types natural language intent → Claude searches catalog using tools → generates a Razorpay payment link inline in the chat.

**Tools available to Claude:**
- `search_catalog` — finds products by name/category/description
- `create_payment_link` — creates Razorpay link + DB order
- `check_payment_status` — verifies payment after customer confirms

---

### 2. AI Buyer Agent
**Route:** `POST /api/agent/buyer` | **Page:** `/buyer`

An autonomous bot that reads the public catalog and places bulk orders without human intervention. Uses a full Claude agentic loop.

**Tools available to Claude:**
- `browse_catalog` — fetches all in-stock products
- `place_order` — purchases a product with reasoning

---

### 3. Upsell & Cross-sell Agent
**Route:** `POST /api/agent/upsell` | **Page:** `/customers`

Analyzes a customer's purchase history → Claude decides the best product to upsell → applies a discount → creates a Razorpay payment link → guardrail check → audit log.

**Guardrails enforced:**
- Max discount % cannot exceed `max_upsell_discount_pct`
- Order value cannot exceed `max_auto_approve_inr` without approval

---

### 4. Campaign Orchestrator Agent
**Route:** `POST /api/agent/campaign` | **Page:** `/campaign`

Scans all abandoned (pending) orders older than a configured threshold → sends up to 3 timed reminder payment links → tracks conversions when orders are later paid.

**Flow:**
1. Find pending orders → check reminder count
2. Skip if ≥ 3 reminders already sent
3. Create fresh Razorpay payment link
4. Log reminder to audit trail
5. On next run, detect conversions and log `campaign_converted`

---

### 5. Retry Agent
**Route:** `POST /api/agent/retry` | **Page:** `/failures`

Handles payment failures gracefully in 3 steps:
1. `payment_failed` — order marked failed, logged
2. Auto-retry — new payment link issued
3. If retry also fails → `merchant_alert` raised → banner shown on dashboard for manual intervention

---

## Database Schema

```sql
products   — id, name, description, price (paise), category, stock
customers  — id, name, email, phone, type (human | bot)
orders     — id, customer_id, product_id, quantity, total_paise,
             status (pending | paid | failed | cancelled),
             razorpay_order_id, razorpay_payment_id, payment_link
audit_log  — id, timestamp, agent, action_type, customer_id, order_id,
             amount_paise, reason, result, metadata (JSON)
```

---

## API Reference

### Catalog & Buying
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/catalog` | Machine-readable catalog with agent instructions |
| GET | `/api/catalog/:id` | Single product |
| POST | `/api/buy` | Agent-facing buy endpoint |
| POST | `/api/razorpay/buy` | Buy with Razorpay payment link |
| POST | `/api/razorpay/payment-link` | Standalone payment link |
| GET | `/api/razorpay/orders` | All orders |

### AI Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/chat` | Conversational checkout agent |
| POST | `/api/agent/upsell` | Upsell & cross-sell agent |
| POST | `/api/agent/buyer` | AI buyer bot |
| POST | `/api/agent/campaign` | Abandoned cart recovery |
| POST | `/api/agent/retry` | Retry failed payments |
| POST | `/api/agent/simulate-failure` | Simulate payment failure (demo) |

### Dashboard & Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/stats` | Merchant dashboard stats |
| GET | `/api/agent/activity` | Live activity feed |
| GET | `/api/agent/alerts` | Merchant alerts |
| GET | `/api/agent/audit` | Full audit trail (filterable) |
| GET | `/api/agent/customers` | Customer list with order summary |
| GET | `/api/agent/guardrails` | Current guardrail settings |
| POST | `/api/agent/guardrails` | Update guardrail settings live |
| POST | `/api/razorpay/sync-status` | Sync payment status from Razorpay |
| GET | `/api/razorpay/test-connection` | Verify Razorpay API connectivity |

### Webhooks
| Method | Endpoint | Events handled |
|--------|----------|----------------|
| POST | `/api/webhook` | `payment_link.paid`, `payment.captured`, `payment.failed`, `payment_link.expired` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18 |
| Backend | Node.js, Express.js |
| Database | SQLite (better-sqlite3) |
| AI | Anthropic Claude API (claude-opus-5) — tool-use agentic loops |
| Payments | Razorpay (test mode) — Payment Links, Webhooks |
| Dev | nodemon |

---

## Project Structure

```
fitindia/
├── .env                          # API keys and feature flags
├── backend/
│   ├── server.js                 # Express app entry point
│   ├── razorpayClient.js         # Razorpay SDK wrapper (real + mock)
│   ├── agents/
│   │   ├── checkoutAgent.js      # Direction 1 — Conversational checkout
│   │   ├── buyerAgent.js         # Direction 2 — AI buyer bot
│   │   ├── upsellAgent.js        # Direction 3 — Upsell & cross-sell
│   │   ├── campaignAgent.js      # Direction 4 — Campaign orchestrator
│   │   └── retryAgent.js         # Failure handling & retry logic
│   ├── routes/
│   │   ├── agent.js              # All agent + dashboard endpoints
│   │   ├── catalog.js            # Catalog & buy endpoints
│   │   ├── razorpay.js           # Razorpay order/payment endpoints
│   │   └── webhook.js            # Razorpay webhook handler
│   ├── config/
│   │   └── guardrails.js         # Live-editable agent limits
│   └── db/
│       ├── database.js           # SQLite init + schema
│       └── seed.js               # Seed products & customers
└── frontend/
    ├── pages/
    │   ├── index.js              # Merchant dashboard
    │   ├── catalog.js            # Product store + buy flow
    │   ├── chat.js               # Conversational checkout UI
    │   ├── buyer.js              # AI buyer agent UI
    │   ├── campaign.js           # Campaign orchestrator UI
    │   ├── audit.js              # Full audit trail
    │   ├── customers.js          # Customer list + upsell trigger
    │   └── failures.js           # Failed orders + retry UI
    └── components/
        ├── Nav.js                # Navigation bar
        ├── ChatBox.js            # Conversational chat component
        ├── ProductCard.js        # Product card component
        └── AuditTable.js         # Audit log table component
```

---

## Setup & Running

### Prerequisites
- Node.js 18+
- Razorpay test account (keys from [dashboard.razorpay.com](https://dashboard.razorpay.com))
- Anthropic API key (for live Claude mode)

### 1. Clone & Install
```bash
cd fitindia
npm run install:all
# installs both backend and frontend dependencies
```

### 2. Configure Environment
Edit `.env` in the project root:
```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_here
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# Set both to false for real API calls
MOCK_RAZORPAY=true    # true = no real Razorpay calls (dev mode)
MOCK_AI=true          # true = no real Claude calls (dev mode)
```

### 3. Seed the Database
```bash
cd backend
node db/seed.js
```

### 4. Run the App
```bash
# Terminal 1 — Backend (port 4000)
npm run dev:backend

# Terminal 2 — Frontend (port 3000)
npm run dev:frontend
```

Open [http://localhost:3000](http://localhost:3000)

---

## Guardrails System

AI agent actions are bounded by live-configurable limits — editable from the dashboard Settings tab without restart:

| Guardrail | Default | Effect |
|-----------|---------|--------|
| `max_upsell_discount_pct` | 30% | Upsell agent cannot offer more than this discount |
| `max_auto_approve_inr` | ₹5,000 | Orders above this value are blocked from auto-approval |
| `max_reminders_per_order` | 3 | Campaign agent caps reminders per abandoned order |
| `retry_enabled` | true | Toggle retry agent on/off globally |

---

## The Bar (Track Requirements)

| Requirement | Implementation |
|-------------|---------------|
| Every money action explainable | Every agent writes reasoning + metadata to `audit_log` before acting |
| Bounded | `guardrails.js` enforces limits at call-time — Claude cannot bypass them |
| Gated | Merchant alerts raised on retry exhaustion; dashboard banner for manual intervention |
| Show the audit trail | `/audit` page — filterable, sortable, paginated, auto-refreshing |
| One failure handled gracefully | `retryAgent.js` — simulate failure → auto-retry → merchant alert if retry also fails |

---

## Testing Payments

**With Razorpay test mode (`MOCK_RAZORPAY=false`):**

| Method | Details |
|--------|---------|
| UPI | `success@razorpay` (instant success) |
| UPI | `failure@razorpay` (simulate failure) |
| Card | `4111 1111 1111 1111` / any future expiry / CVV `123` / OTP `1234` |

After paying, click **"I've Paid — Check Status"** on the catalog or buyer page to sync payment status from Razorpay (replaces webhooks during local development).

---

## Network Notes

- **Corporate network:** Razorpay API may be blocked by proxy. Set `MOCK_RAZORPAY=true` for development.
- **Personal network / hotspot:** Set `MOCK_RAZORPAY=false` for real end-to-end payment testing.
- **Webhooks:** For local dev, use the `/api/razorpay/sync-status` endpoint instead of setting up ngrok.
