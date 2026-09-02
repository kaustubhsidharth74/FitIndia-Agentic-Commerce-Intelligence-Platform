# FitIndia — AI Commerce Intelligence Platform

> **Hackathon Track 01 — AI Growth & Agentic Commerce**
> *Build an agent that grows revenue for a merchant on Razorpay test-mode APIs, or that makes a merchant transactable by an AI buyer end to end.*

---

## The Problem

A fitness e-commerce merchant loses revenue at three stages every day:
- Customers abandon carts and never come back
- Failed payments go unretried — the sale is lost
- No one follows up on high-value customers with personalized offers

Manual intervention is slow, inconsistent, and doesn't scale. **FitIndia replaces that entire loop with 5 autonomous AI agents.**

---

## What It Does

FitIndia is a fully agentic commerce platform built on **Razorpay + Claude AI**. Five specialized agents run autonomously — recovering abandoned carts, retrying failed payments, upselling customers, handling conversational checkout, and simulating an AI buyer — all while maintaining a complete, explainable audit trail.

Every rupee moved by an agent is:
- **Explainable** — full reasoning written to `audit_log` before acting
- **Bounded** — hard guardrails enforced in code, not just prompts
- **Gated** — merchant alerts raised on failure; dashboard banner for manual intervention

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Next.js 14)                           │
│                                                                         │
│   Dashboard  │  Catalog  │  Chat  │  Buyer  │  Campaign  │  Audit       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │  REST / JSON  (port 3000 → 4000)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXPRESS.JS BACKEND  (port 4000)                  │
│                                                                         │
│   /api/catalog    /api/razorpay    /api/agent    /api/webhook           │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │                        5 AI AGENTS                                  │ │
│ │                                                                     │ │
│ │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│ │  │  Checkout    │  │   Buyer      │  │       Upsell             │  │ │
│ │  │  Agent       │  │   Agent      │  │       Agent              │  │ │
│ │  │              │  │              │  │                          │  │ │
│ │  │ Claude tool- │  │ Autonomous   │  │ Purchase history →       │  │ │
│ │  │ use loop:    │  │ agentic loop │  │ Claude picks product →   │  │ │
│ │  │ search →     │  │ browse →     │  │ discount offer →         │  │ │
│ │  │ link → pay   │  │ buy → log    │  │ Razorpay link            │  │ │
│ │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│ │                                                                     │ │
│ │  ┌──────────────────────────┐  ┌──────────────────────────────┐    │ │
│ │  │  Campaign Agent          │  │  Retry Agent                 │    │ │
│ │  │                          │  │                              │    │ │
│ │  │ Pending orders →         │  │ payment_failed →             │    │ │
│ │  │ AI-personalized message →│  │ auto-retry link →            │    │ │
│ │  │ Razorpay recovery link → │  │ if retry fails →             │    │ │
│ │  │ track conversion         │  │ merchant_alert raised        │    │ │
│ │  └──────────────────────────┘  └──────────────────────────────┘    │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                         │                   │                           │
│              ┌──────────┤                   ├──────────┐                │
│              ▼          ▼                   ▼          ▼                │
│       ┌──────────┐ ┌──────────┐    ┌─────────────┐ ┌──────────────┐   │
│       │ SQLite   │ │ Claude   │    │ Razorpay    │ │ Guardrails   │   │
│       │          │ │ Opus 5   │    │ (test mode) │ │ (live config)│   │
│       │ products │ │          │    │             │ │              │   │
│       │ customers│ │ Tool-use │    │ Pay Links   │ │ max discount │   │
│       │ orders   │ │ Agentic  │    │ Webhooks    │ │ max amount   │   │
│       │ audit_log│ │ Loop     │    │ Orders      │ │ max retries  │   │
│       └──────────┘ └──────────┘    └─────────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Deep-Dive

### Agent 1 — Conversational Checkout
**Route:** `POST /api/agent/chat` | **UI:** `/chat`

A customer types natural language ("I want something for muscle recovery under ₹2000") — Claude uses tool-use to search the catalog, picks the best match, and returns a live Razorpay payment link embedded in the chat response. No page reload. No form filling.

**Tools Claude can call:**
| Tool | What it does |
|------|-------------|
| `search_catalog` | Semantic search across products by name, category, description |
| `create_payment_link` | Creates Razorpay link + writes `pending` order to DB |
| `check_payment_status` | Polls Razorpay + updates order status in DB |

---

### Agent 2 — AI Buyer Bot
**Route:** `POST /api/agent/buyer` | **UI:** `/buyer`

Simulates an autonomous B2B buyer. Claude runs a full agentic loop — fetches the catalog, decides what to buy and why, places the order via Razorpay, and logs its reasoning. Zero human steps.

**Tools Claude can call:**
| Tool | What it does |
|------|-------------|
| `browse_catalog` | Returns all in-stock products with price and description |
| `place_order` | Creates Razorpay payment link + DB order with reasoning logged |

---

### Agent 3 — Upsell & Cross-sell
**Route:** `POST /api/agent/upsell` | **UI:** `/customers`

Triggered per customer. Claude reads their full order history, reasons about the best next product, proposes a discount, checks it against guardrails, and issues a new Razorpay payment link — all in one call.

**Guardrails enforced at code level (not prompt level):**
- Discount cannot exceed `max_upsell_discount_pct` (default 30%)
- Order value cannot exceed `max_auto_approve_inr` (default ₹5,000)

---

### Agent 4 — Campaign Orchestrator
**Route:** `POST /api/agent/campaign` | **UI:** `/campaign`

Runs on demand (or on a schedule). Scans all `pending` orders older than a configured threshold, generates a personalized recovery message via Groq/Claude, and issues a fresh Razorpay payment link per customer. On the next run, it detects which customers paid and logs `campaign_converted`.

**Flow:**
```
Pending orders (age > threshold)
        │
        ▼
Already ≥ 3 reminders? → Skip
        │
        ▼
Groq AI → Personalized message (tone: friendly / urgent / final)
        │
        ▼
Razorpay → Fresh payment link
        │
        ▼
audit_log → campaign entry (message + reasoning stored)
        │
Next run
        ▼
Order paid? → log campaign_converted
```

---

### Agent 5 — Retry Agent
**Route:** `POST /api/agent/retry` | **UI:** `/failures`

Handles the full payment failure lifecycle:

```
payment_failed event
        │
        ▼
Order marked failed + logged
        │
        ▼
Auto-retry → new Razorpay payment link issued
        │
        ├── Customer pays → paid ✓
        │
        └── Retry also fails
                │
                ▼
        merchant_alert raised
        Dashboard banner shown
        Manual intervention required
```

---

## Data Flow — End to End

```
Customer intent (chat or click)
        │
        ▼
Agent receives request → validates against guardrails
        │
        ▼
Claude (tool-use) decides action
        │
        ├── search_catalog / browse_catalog
        ├── create_payment_link  ──────────────────────► Razorpay API
        │                                                       │
        ▼                                               Payment Link URL
audit_log.INSERT (agent, action, reason, metadata)             │
        │                                                       ▼
        └──────────────────────────────────────────► Customer pays
                                                            │
                                                   Webhook / sync-status
                                                            │
                                                            ▼
                                              orders.UPDATE (status = paid)
                                              audit_log.INSERT (result)
```

---

## Guardrails System

Agent actions are bounded by **live-configurable limits** — editable from the dashboard Settings tab at runtime without restarting the server:

| Guardrail | Default | Enforced At |
|-----------|---------|------------|
| `max_upsell_discount_pct` | 30% | `upsellAgent.js` — throws before Razorpay call |
| `max_auto_approve_inr` | ₹5,000 | `upsellAgent.js` — blocks high-value auto-approval |
| `max_reminders_per_order` | 3 | `campaignAgent.js` — skips order if cap reached |
| `retry_enabled` | true | `retryAgent.js` — global kill switch |

Guardrails are **code-level checks**, not prompt instructions. Claude cannot reason around them.

---

## Database Schema

```sql
products   (id, name, description, price_paise, category, stock)

customers  (id, name, email, phone, type)
           -- type: 'human' | 'bot'

orders     (id, customer_id, product_id, quantity, total_paise,
            status, razorpay_order_id, razorpay_payment_id,
            payment_link, created_at, updated_at)
           -- status: 'pending' | 'paid' | 'failed' | 'cancelled'

audit_log  (id, timestamp, agent, action_type, customer_id,
            order_id, amount_paise, reason, result, metadata)
           -- metadata: JSON blob with full Claude reasoning
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14, React 18 | Pages-router, fast SSR |
| Backend | Node.js + Express.js | Lightweight, async-friendly |
| Database | SQLite (better-sqlite3) | Zero-config, synchronous reads |
| AI — Agents | Anthropic Claude (claude-opus-5) | Tool-use + agentic loop |
| AI — Campaign | Groq (llama-3.3-70b) | Free, fast text generation |
| Payments | Razorpay Test Mode | Payment Links, Webhooks, Orders |

---

## Project Structure

```
razorpay2.0/
├── .env                              # API keys and feature flags
├── .gitignore
├── package.json                      # Root scripts (install:all, dev:backend, dev:frontend)
├── README.md
│
├── backend/
│   ├── server.js                     # Express entry point + route registration
│   ├── razorpayClient.js             # Razorpay SDK wrapper (real + mock mode)
│   ├── package.json
│   │
│   ├── agents/
│   │   ├── checkoutAgent.js          # Agent 1 — Conversational checkout (Claude tool-use)
│   │   ├── buyerAgent.js             # Agent 2 — Autonomous AI buyer (Claude agentic loop)
│   │   ├── upsellAgent.js            # Agent 3 — Upsell & cross-sell (Claude + guardrails)
│   │   ├── campaignAgent.js          # Agent 4 — Abandoned cart recovery (Groq AI)
│   │   └── retryAgent.js             # Agent 5 — Payment retry + merchant alert
│   │
│   ├── routes/
│   │   ├── agent.js                  # Agent triggers + dashboard + stats endpoints
│   │   ├── catalog.js                # Product catalog + /api/buy
│   │   ├── razorpay.js               # Razorpay orders, payment links, sync
│   │   ├── webhook.js                # Razorpay webhook handler
│   │   ├── fraud.js                  # Fraud signal detection endpoints
│   │   └── config.js                 # Runtime config + mock toggle
│   │
│   ├── config/
│   │   ├── guardrails.js             # Live-editable agent limits (discount, amount, retries)
│   │   └── mockState.js              # Runtime mock flag (Razorpay / AI)
│   │
│   ├── db/
│   │   ├── database.js               # SQLite schema init + getDB()
│   │   ├── seed.js                   # Seed products & test customers
│   │   └── testPayment.js            # Manual end-to-end payment test script
│   │
│   └── utils/
│       └── fraudScorer.js            # Fraud risk scoring logic
│
└── frontend/
    ├── package.json
    │
    ├── pages/
    │   ├── _app.js                   # Next.js app wrapper + global styles
    │   ├── index.js                  # Merchant dashboard — stats, alerts, activity feed
    │   ├── catalog.js                # Product store + buy flow
    │   ├── chat.js                   # Conversational checkout UI (Agent 1)
    │   ├── buyer.js                  # AI buyer agent UI (Agent 2)
    │   ├── customers.js              # Customer list + upsell trigger (Agent 3)
    │   ├── campaign.js               # Campaign orchestrator UI (Agent 4)
    │   ├── failures.js               # Failed orders + retry UI (Agent 5)
    │   ├── audit.js                  # Full audit trail (filterable by agent/type)
    │   ├── fraud.js                  # Fraud detection dashboard
    │   └── demo.js                   # Demo / walkthrough page
    │
    ├── components/
    │   ├── Nav.js                    # Navigation bar
    │   ├── ChatBox.js                # Conversational chat component
    │   ├── ProductCard.js            # Product card component
    │   ├── AuditTable.js             # Audit log table component
    │   └── ParticleSphere.jsx        # Animated hero background
    │
    └── styles/
        └── globals.css               # Global CSS
```

---

## Setup & Running

### Prerequisites
- Node.js 18+
- Razorpay test account → keys from [dashboard.razorpay.com](https://dashboard.razorpay.com)
- Anthropic API key → from [console.anthropic.com](https://console.anthropic.com)
- Groq API key (free) → from [console.groq.com](https://console.groq.com)

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Configure `.env`
```env
# Razorpay (test mode keys from dashboard)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_here

# Claude AI
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# Groq (campaign agent)
GROQ_API_KEY=gsk_xxxxxxxxxxxx

# Mock flags — set both false for real API calls
MOCK_RAZORPAY=true
MOCK_AI=false

PORT=4000
FRONTEND_URL=http://localhost:3000
```

### 3. Seed the Database
```bash
cd backend
node db/seed.js
```

### 4. Run
```bash
# Terminal 1 — Backend
npm run dev:backend     # http://localhost:4000

# Terminal 2 — Frontend
npm run dev:frontend    # http://localhost:3000
```

---

## API Reference

### Catalog & Buying
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/catalog` | Machine-readable catalog with agent instructions |
| GET | `/api/catalog/:id` | Single product detail |
| POST | `/api/buy` | Agent-facing buy endpoint |
| POST | `/api/razorpay/buy` | Buy with Razorpay payment link |
| POST | `/api/razorpay/payment-link` | Standalone payment link creation |
| GET | `/api/razorpay/orders` | All Razorpay orders |

### AI Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/chat` | Conversational checkout (Claude tool-use) |
| POST | `/api/agent/upsell` | Upsell & cross-sell agent |
| POST | `/api/agent/buyer` | AI buyer bot (autonomous loop) |
| POST | `/api/agent/campaign` | Abandoned cart recovery campaign |
| POST | `/api/agent/retry` | Retry failed payments |
| POST | `/api/agent/simulate-failure` | Simulate payment failure (demo) |

### Dashboard & Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/stats` | Merchant dashboard stats |
| GET | `/api/agent/activity` | Live activity feed |
| GET | `/api/agent/alerts` | Merchant alerts |
| GET | `/api/agent/audit` | Full audit trail (filterable by agent/type) |
| GET | `/api/agent/customers` | Customer list with order summary |
| GET | `/api/agent/guardrails` | Current guardrail values |
| POST | `/api/agent/guardrails` | Update guardrail values at runtime |
| POST | `/api/razorpay/sync-status` | Sync payment status from Razorpay |
| GET | `/api/razorpay/test-connection` | Verify Razorpay API connectivity |

### Webhooks
| Method | Endpoint | Events Handled |
|--------|----------|----------------|
| POST | `/api/webhook` | `payment_link.paid`, `payment.captured`, `payment.failed`, `payment_link.expired` |

---

## Testing Payments

With `MOCK_RAZORPAY=false` and real test-mode keys:

| Method | Credentials |
|--------|-------------|
| UPI (success) | `success@razorpay` |
| UPI (failure) | `failure@razorpay` |
| Card | `4111 1111 1111 1111` — any future expiry — CVV `123` — OTP `1234` |

After paying, click **"I've Paid — Check Status"** on the catalog or buyer page to sync status from Razorpay (no ngrok needed for local dev).

---

## Track Requirements Checklist

| Requirement | How FitIndia satisfies it |
|-------------|--------------------------|
| Agent grows merchant revenue | Campaign agent recovers abandoned carts; upsell agent generates incremental orders; retry agent recovers failed payments |
| AI buyer end-to-end | Buyer agent autonomously browses catalog, decides purchases, creates Razorpay links, and logs reasoning — zero human steps |
| Every money action explainable | Every agent writes `reason` + full `metadata` JSON (Claude's tool-use reasoning) to `audit_log` before any Razorpay call |
| Bounded / guardrailed | `guardrails.js` enforces limits at the code layer — Claude cannot bypass max discount, max order value, or max reminders through prompting |
| Failure handled gracefully | `retryAgent.js`: `payment_failed` → auto-retry link → if retry fails → `merchant_alert` raised → dashboard banner |
| Full audit trail | `/audit` page — filterable by agent, action type, and date; every entry includes amount, reasoning, and Razorpay IDs |
| Merchant in control | Guardrails editable at runtime from dashboard; mock/live toggle; merchant alert banner for actions needing human review |
