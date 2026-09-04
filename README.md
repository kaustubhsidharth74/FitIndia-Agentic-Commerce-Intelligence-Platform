# FitIndia — AI Commerce Intelligence Platform

FitIndia is a fully agentic commerce platform built for fitness e-commerce merchants. It replaces manual revenue recovery with **five autonomous AI agents** that work 24/7 — recovering abandoned carts, retrying failed payments, upselling customers with personalized offers, enabling conversational checkout, and making the merchant's catalog fully transactable by an AI buyer without any human in the loop.

Built on **Razorpay test-mode APIs** + **Groq LLM (llama-3.3-70b)** + **Next.js** + **Express**, the platform demonstrates that every rupee an agent touches is explainable, bounded by hard guardrails, and traceable through a complete audit trail.

**Five agents. One audit trail. Zero manual intervention.**

> **NOTE:** Fill in your API keys in `.env` before running. If you don't have them, set `MOCK_RAZORPAY=true` and `MOCK_AI=true`. If you do have them, set both to `false`.

---

## Problem Statement

**Track 01: AI Growth & Agentic Commerce**
*Grow the merchant's revenue, and make them sellable to AI buyers.*

> Build an agent that grows revenue for a merchant on Razorpay test-mode APIs, or that makes a merchant transactable by an AI buyer end to end.

### Why Now

NPCI's UAP and the global protocol race (ACP, AP2, x402) make agent-to-agent commerce the open problem of the year, and Razorpay's in-app pilots are already live. The merchant who can be discovered, evaluated, and transacted with by an AI buyer — without any human in the loop — wins the next decade of commerce.

### The Bar

- Every money action **explainable** — full reasoning written before acting
- Every money action **bounded** — hard guardrails enforced at the code layer, not in prompts
- Every money action **gated** — merchant alerts raised on failure; dashboard banner for manual intervention
- Show a complete **audit trail**
- Handle **one failure gracefully** end to end

### Example Directions

| Direction | Description |
|-----------|-------------|
| Conversational in-app checkout | Customer types intent in natural language; agent finds product and issues a live payment link in the chat |
| Agent-readable catalog | Catalog served as structured JSON with machine-readable buy instructions for AI buyers |
| Upsell & cross-sell agent | Per-customer AI recommendations with guardrail-checked discounts and payment links |
| Campaign orchestrator | Abandoned cart recovery with AI-personalized messages and conversion tracking |

---

## The Problem We're Solving

A fitness e-commerce merchant bleeds revenue at three points every day:

- Customers abandon carts and never return — no automated follow-up
- Failed payments go unretried — the sale is permanently lost
- High-value customers get no personalized offers — no incremental revenue

Manual intervention is slow, inconsistent, and doesn't scale. **FitIndia replaces that entire loop with five autonomous AI agents running on Razorpay test-mode APIs.**

---

## What It Does

FitIndia is a fully agentic commerce platform. Five specialized agents operate autonomously — recovering abandoned carts, retrying failed payments, upselling customers, handling conversational checkout, and enabling a fully autonomous AI buyer. Every agent action creates a traceable, explainable, bounded record before any money moves.

---

## Visual Architecture Diagram

View the full interactive system architecture diagram: [fitindia-arch.html](./fitindia-arch.html)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BROWSER  ·  Next.js 14  ·  port 3000                 │
│                                                                             │
│  Dashboard  │  Catalog  │  Chat  │  AI Buyer  │  Campaign  │  Audit         │
│  Customers  │  Failures │  Fraud │  Demo                                    │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │  HTTP REST  (native fetch, no library)
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS BACKEND  ·  port 4000                        │
│                                                                             │
│  /api/catalog    /api/razorpay    /api/agent    /api/webhook    /api/fraud  │
└───────────┬──────────────────────────────┬──────────────────────────────────┘
            │  module calls                │
            ▼                              ▼
┌───────────────────────────┐  ┌───────────────────────────────────────────────┐
│        AI AGENTS          │  │              CORE SERVICES                    │
│   Groq · llama-3.3-70b    │  │                                               │
│                           │  │  ┌──────────────┐   ┌───────────────────────┐ │
│  ┌──────────────────────┐ │  │  │ Razorpay     │   │ Guardrails            │ │
│  │ Checkout Agent       │ │  │  │ Client       │   │                       │ │
│  │ search → link → pay  │ │  │  │ createOrder  │   │ max_discount_pct  30% │ │
│  └──────────────────────┘ │  │  │ createPayLink│   │ max_auto_approve  ₹5k │ │
│  ┌──────────────────────┐ │  │  │ fetchStatus  │   │ max_reminders      3  │ │
│  │ Buyer Bot            │ │  │  └──────────────┘   │ retry_enabled   true  │ │
│  │ browse → decide → buy│ │  │                     └───────────────────────┘ │
│  └──────────────────────┘ │  │  ┌──────────────┐   ┌───────────────────────┐ │
│  ┌──────────────────────┐ │  │  │ Fraud Scorer │   │ Mock Layer            │ │
│  │ Upsell Agent         │ │  │  │ 5 risk rules │   │ MOCK_RAZORPAY         │ │
│  │ history → offer      │ │  │  │ 0–100 score  │   │ MOCK_AI               │ │
│  │ → guardrail → link   │ │  │  │ auto-block80+│   │ live toggle via API   │ │
│  └──────────────────────┘ │  │  └──────────────┘   └───────────────────────┘ │
│  ┌──────────────────────┐ │  └───────────────────────────────────────────────┘
│  │ Campaign Agent       │ │
│  │ pending → message    │ │
│  │ → link → convert     │ │
│  └──────────────────────┘ │              ▼  sql.js WASM queries
│  ┌──────────────────────┐ │  ┌───────────────────────────────────────────────┐
│  │ Retry Agent          │ │  │               DATABASE  ·  SQLite             │
│  │ fail → retry → alert │ │  │                                               │
│  └──────────────────────┘ │  │  products  │  customers  │  orders            │
└───────────────────────────┘  │  order_items             │  audit_log         │
                               └───────────────────────────────────────────────┘
                                              ▼  HTTPS outbound
                               ┌───────────────────────────────────────────────┐
                               │            EXTERNAL APIs                      │
                               │                                               │
                               │  Razorpay (test mode)    Groq API             │
                               │  Payment Links           llama-3.3-70b        │
                               │  Orders · Webhooks       AI reasoning          │
                               └───────────────────────────────────────────────┘
```

### Architecture in Three Points

1. **Frontend → Backend over plain REST.** Next.js pages call Express endpoints with `fetch()`. No GraphQL, no WebSockets — simple, debuggable, fast.

2. **Backend is a thin orchestrator.** Route handlers validate input, call an agent function or SDK wrapper, and return JSON. All state lives in SQLite; all AI reasoning goes through the Groq SDK.

3. **Every money action has three mandatory stops:** guardrail check → `audit_log.INSERT` (with reason and metadata) → Razorpay API call. No Razorpay call is ever made without a corresponding audit entry written first.

---

## Data Flow — End to End

```
Customer intent (chat message or UI click)
          │
          ▼
  Agent receives request
          │
          ├─── Guardrail check ──── FAIL ──► audit_log (result = failed) ──► HTTP 400
          │
          ▼ PASS
  audit_log.INSERT  ← reason + metadata written HERE, before any Razorpay call
          │
          ▼
  Groq tool-use loop
  ├── search_catalog / browse_catalog   (reads SQLite)
  └── create_payment_link ─────────────────────────────► Razorpay API
                                                               │
                                                      Payment Link URL returned
                                                               │
                                                               ▼
                                               orders.INSERT  (status = pending)
                                                               │
                                                  Customer follows link and pays
                                                               │
                                                    Webhook event OR sync-status
                                                               │
                                                               ▼
                                               orders.UPDATE  (status = paid)
                                               audit_log.INSERT (result = success)
```

---

## Failure Handling Flow

```
payment_failed event (webhook or simulate-failure)
          │
          ▼
  orders.UPDATE  (status = failed)
  audit_log.INSERT  (payment_failed · result = failed)
          │
          ▼
  retryAgent.runRetryAgent()
  ├── Checks: retry_enabled guardrail
  │
  ├── RETRY SUCCEEDS
  │     Razorpay → new payment link
  │     orders.UPDATE  (status = pending)
  │     audit_log.INSERT  (payment_retry · result = success)
  │
  └── RETRY FAILS
        audit_log.INSERT  (payment_retry · result = failed)
        audit_log.INSERT  (merchant_alert · result = failed)
                │
                ▼
        Orange alert banner on dashboard
        "X Merchant Alerts — Manual Intervention Required"
```

---

## Agents

### Agent 1 — Conversational Checkout

**Route:** `POST /api/agent/chat` | **UI:** `/chat`

A customer types natural language ("I want something for muscle recovery under ₹2000"). The agent searches the catalog, picks the best match, confirms product and price, then returns a live Razorpay payment link embedded as a "Pay Now" button inside the chat thread. No page reload. No form filling.

**Groq tool-use loop (up to 5 iterations):**

| Tool | What it does |
|------|-------------|
| `search_catalog` | Fuzzy match across product name, category, description |
| `create_payment_link` | Creates DB order + Razorpay payment link; writes to audit_log |
| `check_payment_status` | Polls Razorpay; updates order status |

**Guardrail in system prompt:** agent must confirm product + price with the customer before calling `create_payment_link`.

---

### Agent 2 — AI Buyer Bot

**Route:** `POST /api/agent/buyer` | **UI:** `/buyer`

Simulates an autonomous B2B buyer. The bot reads the agent-readable catalog, decides what to buy and why (with explicit `reasoning` field), places the order via Razorpay, and logs full reasoning to `audit_log`. Zero human steps. Customer `type = 'bot'` is verified before any purchase.

**Groq agentic loop (up to 8 iterations):**

| Tool | What it does |
|------|-------------|
| `browse_catalog` | Returns all in-stock products with price, category, description |
| `place_order` | Creates DB order + payment link; `reasoning` is a required argument |

**Agent-readable catalog endpoint:** `GET /api/catalog` returns a `agent_instructions` field alongside every product — `"To purchase, POST /api/buy with { customer_id, product_id, quantity }"` — so any external AI agent can discover and transact with the store.

---

### Agent 3 — Upsell & Cross-sell

**Route:** `POST /api/agent/upsell` | **UI:** `/customers`

Triggered per customer. The agent reads their full order history and the complete catalog, then calls Groq with `create_upsell_offer` (forced tool choice). The model returns a product, discount %, reasoning, and personalized message. Two guardrail checks fire in code before any order is placed.

**Guardrails enforced at code level — not in the prompt:**

| Guardrail | Default | Effect |
|-----------|---------|--------|
| `max_upsell_discount_pct` | 30% | Blocks any offer above this discount |
| `max_auto_approve_inr` | ₹5,000 | Blocks high-value orders without manual review |

Cross-sell logic: finds products the customer has not yet purchased, picks the best upsell candidate. If the customer has bought everything, offers a loyalty re-order with a reduced discount.

---

### Agent 4 — Campaign Orchestrator

**Route:** `POST /api/agent/campaign` | **UI:** `/campaign`

Scans all `pending` orders older than `CAMPAIGN_MIN_AGE_HOURS`, generates a personalized recovery message via Groq (`compose_campaign_message` tool), and issues a fresh Razorpay payment link per customer. On the next run, it detects conversions (pending → paid) and logs `campaign_converted`.

**Flow:**
```
Pending orders (age > CAMPAIGN_MIN_AGE_HOURS)
        │
        ├── Already ≥ max_reminders_per_order? ──► Skip (anti-spam guardrail)
        │
        ▼
Groq → Personalized message
        Attempt 1 → tone: friendly
        Attempt 2 → tone: urgent
        Attempt 3 → tone: final
        │
        ▼
Razorpay → Fresh payment link (previous may have expired)
        │
        ▼
audit_log → campaign entry (attempt number, message, tone, reasoning, ai_powered flag)
        │
  Next run
        ▼
Order now paid? → log campaign_converted
```

---

### Agent 5 — Retry Agent

**Route:** `POST /api/agent/retry` | **UI:** `/failures`

Handles the full payment failure lifecycle. Pure deterministic rule logic — no LLM call. The `retry_enabled` guardrail flag acts as a kill switch.

The `/demo` page runs this agent with `force_retry_fail: true` to guarantee the full merchant alert path is demonstrated every time.

---

## Guardrails System

All limits are live-editable from the dashboard Settings tab at runtime without a server restart. They are stored in memory (not in the DB) and read at the time each agent makes a decision.

| Guardrail | Default | Enforced by |
|-----------|---------|------------|
| `max_upsell_discount_pct` | 30% | `upsellAgent.js` — blocks before Razorpay call |
| `max_auto_approve_inr` | ₹5,000 | `upsellAgent.js` — blocks high-value auto-approval |
| `max_reminders_per_order` | 3 | `campaignAgent.js` — skips order if cap reached |
| `retry_enabled` | true | `retryAgent.js` — global kill switch; returns error immediately if false |

**Guardrails are code-level blocks, not prompt instructions.** The LLM cannot reason around them.

---

## Audit Trail

Every agent action writes a row to `audit_log` **before** any Razorpay call:

| Field | What it contains |
|-------|-----------------|
| `agent` | `checkout_agent`, `buyer_agent`, `upsell_agent`, `campaign_agent`, `retry_agent`, `webhook`, `fraud_detector` |
| `action_type` | `checkout`, `catalog_buy`, `upsell`, `campaign`, `campaign_converted`, `payment_failed`, `payment_retry`, `merchant_alert`, `fraud_block` |
| `reason` | Human-readable explanation of why the agent took this action |
| `result` | `success`, `failed`, `pending`, `blocked`, `approved` |
| `metadata` | Full JSON blob: discount %, product name, payment link, AI-powered flag, Groq reasoning |

**API:** `GET /api/agent/audit` — filterable by agent, action_type, result; returns summary stats (total, success, failed, pending, total revenue in paise).

**UI:** `/audit` — 6-column sortable table, filter dropdowns, 12-per-page pagination, auto-syncs payment status every 10 seconds.

---

## Database Schema

```sql
products   (id, name, description, price_paise, category, stock)

customers  (id, name, email, phone, type)
           -- type: 'human' | 'bot'

orders     (id, customer_id, product_id, quantity, total_paise,
            status, razorpay_order_id, razorpay_payment_id,
            payment_link, created_at, updated_at)
           -- status: pending | paid | failed | cancelled | held

order_items (id, order_id, product_id, quantity, unit_paise, total_paise)
           -- line items for multi-product cart checkout

audit_log  (id, timestamp, agent, action_type, customer_id,
            order_id, amount_paise, reason, result, metadata)
           -- metadata: JSON blob with full agent reasoning
```

**15 seeded products** across 4 categories — Nutrition (Protein Powder ₹1,499 · BCAA ₹899 · Peanut Butter ₹499 · Mass Gainer ₹2,499), Accessories (Gym Gloves ₹399 · Shaker Bottle ₹299 · Wrist Wraps ₹249 · Gym Bag ₹799), Equipment (Resistance Bands ₹599 · Yoga Mat ₹349 · Adjustable Dumbbells ₹3,499 · Jump Rope ₹199), Subscriptions (Monthly ₹2,999 · Quarterly ₹4,999 · Annual ₹9,999).

**4 seeded customers** — 3 human buyers (Ravi Sharma, Meena Patel, Suresh Reddy) + 1 bot customer (HealthBox Bot, `type = 'bot'`) used exclusively by the Buyer Agent.

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | Next.js 14 · React 18 | 10 pages, pages-router, no SSR needed |
| Backend | Node.js · Express 4.18 | REST API, agent orchestration |
| Database | SQLite · sql.js WASM | Zero-config, sync reads, file persistence |
| AI — all agents | Groq SDK · llama-3.3-70b-versatile | Tool-use loops, campaign messages, upsell reasoning |
| Payments | Razorpay SDK v2.9 (test mode) | Payment Links, Orders, Webhooks |
| 3D Hero | Three.js | Animated particle sphere on the home page |

---

## Project Structure

```
razorpay2.0/
├── .env                              # API keys and feature flags
├── package.json                      # Root scripts (install:all, dev:backend, dev:frontend)
├── fitindia-arch.html                # Interactive architecture diagram (open in browser)
│
├── backend/
│   ├── server.js                     # Express entry point + route registration
│   ├── razorpayClient.js             # Razorpay SDK wrapper — real + mock mode
│   │
│   ├── agents/
│   │   ├── checkoutAgent.js          # Agent 1 — Conversational checkout (Groq tool-use)
│   │   ├── buyerAgent.js             # Agent 2 — Autonomous AI buyer (Groq agentic loop)
│   │   ├── upsellAgent.js            # Agent 3 — Upsell & cross-sell (Groq + guardrails)
│   │   ├── campaignAgent.js          # Agent 4 — Abandoned cart recovery (Groq AI)
│   │   └── retryAgent.js             # Agent 5 — Payment retry + merchant alert (rule-based)
│   │
│   ├── routes/
│   │   ├── agent.js                  # Agent triggers, audit, stats, guardrails, activity
│   │   ├── catalog.js                # /api/catalog — machine-readable + /api/buy
│   │   ├── razorpay.js               # Orders, payment links, sync, mock-pay
│   │   ├── webhook.js                # Razorpay webhook receiver (HMAC-verified)
│   │   ├── fraud.js                  # Fraud detection endpoints
│   │   └── config.js                 # Runtime mock flag toggle
│   │
│   ├── config/
│   │   ├── guardrails.js             # Live-editable agent limits
│   │   └── mockState.js              # Runtime mock flags (Razorpay / AI)
│   │
│   ├── db/
│   │   ├── database.js               # SQLite schema + getDB()
│   │   ├── seed.js                   # Seed products and test customers
│   │   └── fitindia.db               # SQLite database file
│   │
│   └── utils/
│       └── fraudScorer.js            # 5-signal rule-based fraud risk scorer
│
└── frontend/
    ├── pages/
    │   ├── index.js                  # Merchant dashboard — stats, alerts, activity feed
    │   ├── catalog.js                # Product store + cart + mock payment simulator
    │   ├── chat.js                   # Agent 1 — Conversational checkout UI
    │   ├── buyer.js                  # Agent 2 — AI buyer UI
    │   ├── customers.js              # Customer list + Agent 3 upsell trigger
    │   ├── campaign.js               # Agent 4 — Campaign orchestrator UI
    │   ├── failures.js               # Agent 5 — Failure simulation + retry UI
    │   ├── audit.js                  # Full audit trail (filterable, paginated)
    │   ├── fraud.js                  # Fraud detection dashboard
    │   └── demo.js                   # One-click guided demo — all 5 directions
    │
    └── components/
        ├── Nav.js                    # Navigation bar + mock mode toggle
        ├── ChatBox.js                # Conversational chat component
        ├── ProductCard.js            # Product card
        ├── AuditTable.js             # Audit log table
        └── ParticleSphere.jsx        # Three.js animated hero sphere
```

---

## API Reference

### Catalog & Buying

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/catalog` | Machine-readable catalog — includes `agent_instructions` field for AI buyers |
| GET | `/api/catalog/:id` | Single product |
| POST | `/api/buy` | Agent-facing buy — creates order + payment link |
| POST | `/api/razorpay/cart` | Multi-item cart checkout — one payment link for N products |
| POST | `/api/razorpay/payment-link` | Standalone payment link |
| GET | `/api/razorpay/orders` | All orders (last 50, with customer + product join) |
| POST | `/api/razorpay/sync-status` | Poll Razorpay; mark pending links as paid |
| POST | `/api/razorpay/mock-pay` | Resolve a mock order as success or failure |

### AI Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/chat` | Conversational checkout — Groq tool-use loop |
| POST | `/api/agent/buyer` | AI buyer bot — autonomous browse + purchase loop |
| POST | `/api/agent/upsell` | Upsell & cross-sell for a specific customer |
| POST | `/api/agent/campaign` | Abandoned cart recovery campaign |
| POST | `/api/agent/retry` | Retry failed payments |
| POST | `/api/agent/simulate-failure` | Simulate a payment failure (demo) |

### Dashboard & Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/stats` | Revenue, pending count, alert count, agent activity |
| GET | `/api/agent/activity` | Human-readable activity feed (last 30 events) |
| GET | `/api/agent/alerts` | Merchant alerts (manual intervention required) |
| GET | `/api/agent/audit` | Full audit trail — filterable by `agent`, `action_type`, `result` |
| GET | `/api/agent/customers` | Customer list with order summary stats |
| GET | `/api/agent/revenue-trend` | Monthly revenue data for chart |
| GET | `/api/agent/guardrails` | Current guardrail values |
| POST | `/api/agent/guardrails` | Update guardrail values at runtime |

### Webhooks

| Method | Endpoint | Events handled |
|--------|----------|----------------|
| POST | `/api/webhook` | `payment_link.paid`, `payment.captured`, `payment.failed`, `payment_link.expired`, `payment_link.cancelled` |

---

## Setup & Running

### Prerequisites

- Node.js 18+
- Razorpay test account — keys from [dashboard.razorpay.com](https://dashboard.razorpay.com)
- Groq API key (free) — from [console.groq.com](https://console.groq.com)

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure `.env`

```env
# Razorpay (test mode keys from dashboard — starts with rzp_test_)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_here
RAZORPAY_WEBHOOK_SECRET=          # optional — leave empty for local dev

# Groq — powers all five AI agents
GROQ_API_KEY=gsk_xxxxxxxxxxxx

# Mock flags — set both false to make real API calls
MOCK_RAZORPAY=false
MOCK_AI=false

# Campaign: min age (hours) before a pending order is targeted for recovery
# Set to 0 in dev to process all pending orders immediately
CAMPAIGN_MIN_AGE_HOURS=0

PORT=4000
FRONTEND_URL=http://localhost:3000
```

### 3. Seed the database

```bash
cd backend && node db/seed.js
```

### 4. Run

```bash
# Terminal 1 — backend
npm run dev:backend     # http://localhost:4000

# Terminal 2 — frontend
npm run dev:frontend    # http://localhost:3000
```

### Mock vs Live mode

Both `MOCK_RAZORPAY` and `MOCK_AI` can be toggled at runtime via `POST /api/config` or from the navigation sidebar — no server restart required for the Razorpay mock. The AI mock (`MOCK_AI`) is read at module load time, so a restart is needed when toggling it.

| Mode | Razorpay | AI | Use for |
|------|----------|----|---------|
| Both true | Mock responses, no API calls | Canned replies | Local dev, no keys needed |
| Both false | Real test-mode payment links | Real Groq LLM responses | Demo and evaluation |

---

## Testing Payments (MOCK_RAZORPAY=false)

| Method | Test credentials |
|--------|-----------------|
| UPI — success | `success@razorpay` |
| UPI — failure | `failure@razorpay` |
| Card | `4111 1111 1111 1111` · any future expiry · CVV `123` · OTP `1234` |

After paying, click **"I've Paid — Check Status"** on the catalog or buyer page to sync status from Razorpay without ngrok.

---

## Track Compliance Checklist

| Requirement | How FitIndia satisfies it |
|-------------|--------------------------|
| Agent grows merchant revenue | Campaign agent recovers abandoned carts with AI-personalized messages; upsell agent generates incremental orders; retry agent recovers failed payments |
| Merchant transactable by AI buyer end to end | Buyer agent autonomously browses catalog, reasons about purchase goal, places Razorpay order, logs reasoning — zero human steps |
| Agent-readable catalog | `GET /api/catalog` returns `agent_instructions` field and machine-readable product list for any external AI buyer |
| Every money action explainable | Every agent writes `reason` + full `metadata` JSON (Groq reasoning) to `audit_log` before any Razorpay call |
| Every money action bounded | `guardrails.js` enforces limits at the code layer — max discount %, max order value, max reminders, retry kill switch |
| Every money action gated | Guardrail violations return HTTP 400; no order or payment link is created; result logged as `failed` |
| Full audit trail | `audit_log` table + `GET /api/agent/audit` + `/audit` page — every entry includes timestamp, agent name, action, customer, amount, reasoning, and result |
| One failure handled gracefully | `retryAgent.js`: `payment_failed` → auto-retry with new payment link → if retry also fails → `merchant_alert` raised → dashboard banner for manual intervention |
| Merchant in control | Guardrails live-editable from dashboard; mock/live toggle; merchant alert banner surfaces any action needing human review |
