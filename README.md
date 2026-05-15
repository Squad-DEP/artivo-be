# Artivo — Backend API

> AI-powered marketplace connecting informal artisans with customers across Nigeria.
> Built for the **Squad Hackathon** — *"Design an intelligent economic system that connects informal traders, job seekers, and financial services in one ecosystem."*

---

## What Artivo Does

Most skilled workers in Nigeria — plumbers, electricians, tailors, barbers, mechanics — have no digital presence, no payment rails, and no financial history. Banks can't lend to them. Customers can't find them reliably. Artivo fixes both sides of that problem at once.

A worker speaks for 30 seconds. AI builds their profile. They start receiving job leads, getting paid through escrow, and accumulating a credit score based on their work history — not a bank statement. A customer describes what they need, also by voice, and AI matches them to the right person in seconds.

Squad is the financial spine that makes real money movement possible throughout.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | PostgreSQL via Supabase |
| ORM | Sequelize |
| Auth | Passport.js (JWT) |
| AI — Primary | Google Gemini 2.5 Flash |
| AI — Fallback | Groq (Whisper + Llama 3.3) |
| Payments | Squad API |
| File Storage | AWS S3 / Cloudflare R2 |

---

## Getting Started

```bash
git clone <repo>
cd artivo-be
npm install
cp .env.example .env
# Fill in env values (see below)
npm run dev
```

### Environment Variables

```env
# Database
DB_HOST=
DB_PORT=5432
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=

# Auth
JWT_SECRET=
JWT_REFRESH_SECRET=

# AI
GEMINI_API_KEY=
GROQ_API_KEY=

# Squad
SQUAD_SECRET_KEY=
SQUAD_BASE_URL=https://sandbox-api-d.squadco.com
SQUAD_WEBHOOK_SECRET=

# Institutional credit score access
EXTERNAL_API_KEY=
```

### Migrations

```bash
npx sequelize-cli db:migrate
```

---

## How the System Works

### 1. Onboarding — Voice or Text

Workers and customers describe themselves in a voice message or a short paragraph. The AI extracts structured profile data — no forms to fill.

```
POST /api/v1/ai/onboard/voice   →  multipart audio  →  transcribe  →  extract profile fields
POST /api/v1/ai/onboard/text    →  plain text        →  extract profile fields
POST /api/v1/ai/onboard/save    →  confirmed fields  →  write user + worker profile to DB
```

A worker saying *"I'm Chidi, a plumber with 8 years in Lagos, I charge around ₦15,000 per job"* becomes a complete profile: name, trade, location, rate — ready to receive job leads.

**AI fallback chain:** Gemini is tried first. If it hits a rate limit or fails, Groq takes over silently (Whisper for transcription, Llama 3.3 for extraction). The user never sees a provider error.

**Audio:** Uploaded as binary multipart (Opus codec where supported, mp4 on Safari). The MIME type from the upload is passed through the AI pipeline so Whisper always receives the file with the correct extension.

---

### 2. Job Posting — Voice or Text

Customers describe what they need the same way.

```
POST /api/v1/ai/extract-job/voice   →  audio  →  structured job post
POST /api/v1/ai/extract-job/text    →  text   →  structured job post
POST /api/v1/customer/request-job   →  confirmed fields  →  job goes live
```

*"I need someone to fix my leaking pipes in Lekki, budget around ₦20,000"* becomes a complete job post with title, description, category, location, and budget — instantly visible to subscribed artisans.

---

### 3. AI Worker Matching

When a customer opens their job's proposals, the system scores every subscribed artisan against that specific job through a two-layer engine:

**Layer 1 — Traditional Scorer (70% weight)**
- Skills alignment
- Location proximity
- Reputation score (completion rate + ratings + credit score)

**Layer 2 — AI Semantic Scorer (30% weight)**
- Gemini reads the artisan's bio and the job description and produces a contextual match score with a plain-English explanation

```
GET /api/v1/jobs/:jobId/matches?limit=5
```

```json
{
  "matches": [
    {
      "worker_name": "Chidi Okafor",
      "match_score": 82.5,
      "share_slug": "chidi-okafor",
      "explanation": "Chidi is a licensed plumber with 8 years in Lagos. His skills and location align directly with this job.",
      "score_breakdown": {
        "skills_match": 90,
        "location_match": 85,
        "reputation": 78,
        "ai_semantic": 80
      }
    }
  ]
}
```

---

### 4. Squad — The Financial Spine

Squad handles every naira that moves through Artivo. It is not a feature — it is the infrastructure.

#### Customer: Virtual Account on Signup

The moment a customer completes onboarding, Artivo calls Squad to create a dedicated virtual account for them:

```
POST /virtual-account  →  customer gets a real Nigerian bank account number
```

This account number belongs to the customer. They fund their Artivo wallet by transferring to it from any bank. Squad fires a webhook when the transfer arrives, and the wallet is credited in real time.

```
GET /customer/transactions  →  full deposit history pulled live from Squad
```

#### Worker: Bank Account Registration

Workers register the bank account where they want to receive payment. Before saving it, Artivo verifies it with Squad to catch wrong account numbers before any real money moves:

```
POST /payout/account/lookup  →  resolves account name for the worker to confirm
POST /api/v1/worker/bank-account  →  saves verified account to worker profile
```

In production, every escrow release and advance payout hits this account immediately. *(In Squad sandbox, outbound transfers to real bank accounts are not processed — the API accepts the call but no actual credit is made. The full transfer flow is wired and works end-to-end; it's a sandbox environment restriction.)*

#### Wallet Top-Up via Inbound Webhook

```
POST /api/v1/squad/webhook
```

When a customer transfers money to their virtual account, Squad sends a signed webhook. The handler:
1. Verifies Squad's HMAC signature — rejects anything that doesn't match
2. Checks for duplicate event IDs — safe to replay, never double-credits
3. Credits the customer's wallet balance
4. Marks the webhook as processed

If a webhook was missed (server restart, network blip), the recovery endpoint catches it:

```
GET /webhook/logs  →  replay any deposits that didn't trigger a live webhook
```

#### Hiring — Escrow

```
POST /api/v1/customer/hire
```

One database transaction:
1. Wallet balance check
2. Deduct hire amount from customer balance
3. Create escrow entry in `FUNDED` status
4. Create job record in `in_progress`
5. Mark worker's proposal as `accepted`

Funds are locked until both parties confirm completion.

#### Job Completion — Automatic Payout

```
POST /api/v1/customer/complete-job/:id   →  customer marks done
POST /api/v1/worker/complete-job/:id     →  worker marks done
```

When **both** confirm, escrow releases and Squad immediately transfers the amount to the worker's registered bank account:

```
POST /payout/transfer  →  worker receives payment directly
POST /payout/requery   →  called if transfer status is ambiguous — no transfer is ever lost to silence
```

#### Advance Payments (Mid-Job)

Workers can request a partial release from escrow during a job — to buy materials, for example.

```
POST /api/v1/worker/advance-request        →  worker requests ₦X
POST /api/v1/customer/approve-advance/:id  →  customer approves
→  Squad payout fires immediately on approval
```

---

### 5. Reputation & Credit Score

Every completed job updates the worker's scores:
- **Completion rate** — jobs finished vs started
- **Average rating** — customer star ratings after completion
- **Credit score** — composite used for financial product eligibility

The credit score is exposed via an API-key-protected public endpoint so banks and lending institutions can query it directly:

```
GET /api/v1/public/credit-score/:user_id
X-API-Key: <institution_key>
```

This is the bridge to formal financial services. A worker builds a financial identity through their job history — not a bank account or paper documents.

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Email + password login |
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/refresh` | Refresh access token |

### AI
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/ai/onboard/voice` | Voice onboarding (multipart audio) |
| POST | `/api/v1/ai/onboard/text` | Text onboarding |
| POST | `/api/v1/ai/onboard/save` | Save confirmed profile fields |
| POST | `/api/v1/ai/extract-job/voice` | Extract structured job from voice |
| POST | `/api/v1/ai/extract-job/text` | Extract structured job from text |

### Customer
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/customer/feed` | Discover artisans (AI-ranked when query provided) |
| POST | `/api/v1/customer/request-job` | Post a new job |
| GET | `/api/v1/customer/my-job-requests` | My job posts with proposal counts |
| GET | `/api/v1/customer/job-requests/:id/proposals` | Proposals for a specific job |
| POST | `/api/v1/customer/hire` | Hire an artisan (triggers escrow) |
| POST | `/api/v1/customer/complete-job/:id` | Mark job as complete |
| POST | `/api/v1/customer/approve-advance/:id` | Approve worker's advance request |
| POST | `/api/v1/customer/rate` | Rate a worker after completion |
| GET | `/api/v1/jobs/stats/customer` | Dashboard stats |

### Worker
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/worker/jobs` | Available jobs matching subscriptions |
| POST | `/api/v1/worker/jobs/:id/apply` | Submit proposal with price range |
| POST | `/api/v1/worker/complete-job/:id` | Mark job as complete |
| GET | `/api/v1/worker/earnings` | Earnings history with payout records |
| POST | `/api/v1/worker/bank-account` | Register verified bank account for payouts |
| POST | `/api/v1/worker/advance-request` | Request advance from escrow |
| GET | `/api/v1/jobs/stats/worker` | Dashboard stats |

### Matching
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/jobs/:jobId/matches` | AI-ranked artisans for a specific job |
| GET | `/api/v1/matching/job-types` | All available job categories |

### Payments & Account
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/squad/webhook` | Inbound Squad payment events (HMAC verified) |
| GET | `/api/v1/account/virtual-account` | Customer's virtual account details + balance |
| GET | `/api/v1/account/transactions` | Live transaction history from Squad |

### Public
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/public/profile/:slug` | Public artisan profile page |
| GET | `/api/v1/public/credit-score/:user_id` | Credit score for financial institutions |

---

## Project Structure

```
src/
├── app.ts                        # Express setup, middleware, route mounting
├── routes/                       # One file per domain
│   ├── AI.ts                     # Voice/text AI endpoints
│   ├── Customer.ts               # Customer marketplace flows
│   ├── Worker.ts                 # Worker job management
│   ├── Matching.ts               # AI matching engine
│   ├── Squad.ts                  # Inbound Squad webhooks
│   ├── Account.ts                # Virtual account + transactions
│   └── Public.ts                 # Public profiles + credit scores
├── controllers/                  # Request/response handling per domain
├── services/
│   ├── ai/
│   │   ├── AIService.ts          # Orchestrates providers with fallback
│   │   ├── prompts.ts            # All AI prompts in one place
│   │   ├── GeminiProvider.ts     # Gemini 2.5 Flash implementation
│   │   └── GroqProvider.ts       # Whisper transcription + Llama 3.3
│   ├── matching/
│   │   ├── MatchingService.ts    # Scoring pipeline orchestrator
│   │   └── scorers/
│   │       ├── TraditionalScorer.ts  # Skills, location, reputation
│   │       └── AIScorer.ts           # Gemini semantic scoring
│   └── marketplace/
│       ├── HireService.ts        # Atomic hire transaction
│       ├── EscrowService.ts      # Escrow lifecycle
│       ├── PayoutService.ts      # Squad payouts + requery
│       └── JobRequestService.ts  # Job post management
├── repositories/                 # All DB queries (repository pattern)
├── models/                       # Sequelize models + relationships
└── providers/
    ├── db.ts                     # Database connection
    └── Passport.ts               # JWT auth strategy
```

---

## Addressing the Problem Statement

| Requirement | How Artivo Solves It |
|---|---|
| Digitally onboard informal workers | Voice/text AI onboarding — no forms, works in any Nigerian language |
| Match workers to opportunities using AI | Two-layer scoring: skills/location/reputation (70%) + Gemini semantic (30%) |
| Connect workers to financial services | Credit score built from job history, exposed to institutions via API |
| Use alternative data instead of credit history | Completion rate, ratings, and job volume replace bank statements |
| Squad API as the transactional layer | Virtual accounts, inbound webhooks, escrow, payouts, advance payments — all Squad |
| Recover from missed events | Webhook log requery catches any deposits that didn't fire in real time |
