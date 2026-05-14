# Artivo API

Marketplace platform connecting artisans to customers with AI-powered matching, Squad payments, and S3 file storage.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your credentials

npm run db:reset
npm start
```

## Docker

```bash
docker-compose up -d
docker-compose logs -f api
```

## What It Does

**For Customers:**
- Browse artisan profiles with AI-powered ranking
- Post job requests
- Hire artisans and track jobs
- Make payments via Squad virtual accounts
- Upload documents (certificates, photos)
- Rate artisans after job completion

**For Artisans:**
- Create shareable profiles with photos and certificates
- Subscribe to job types for notifications
- Get real-time job alerts (Server-Sent Events)
- Accept jobs and manage work
- Rate customers
- Build reputation score automatically
- Receive payments to Squad virtual accounts

## Key Features

- **AI Matching**: Hybrid algorithm (70% traditional + 30% AI semantic) ranks artisans
- **Squad Payments**: Virtual account creation, webhook handling, payment tracking
- **S3 Storage**: Document uploads (profile photos, certificates, business cards)
- **Bidirectional Ratings**: Both customers and artisans rate each other
- **Real-time Notifications**: SSE stream for instant job alerts
- **Automatic Reputation**: Credit score from ratings and job completion
- **Migration Tracking**: Idempotent migrations with schema_migrations table

## Database Commands

```bash
npm run db:reset   # Drop, recreate, seed
npm run db:up      # Run new migrations only
npm run db:down    # Drop all tables
```

## API Documentation

- [API.md](./API.md) - Core marketplace APIs
- [STORAGE_API.md](./STORAGE_API.md) - Document upload APIs
- [SQUAD_INTEGRATION.md](./SQUAD_INTEGRATION.md) - Payment integration

## Architecture

```
Routes → Controllers → Services → Models → Database
```

Services are provider-agnostic:
- **AI**: Gemini or OpenAI (swappable via env)
- **Storage**: Any S3-compatible (R2, AWS S3, MinIO)
- **Payments**: Squad (production-grade error handling)

## Environment Variables

```env
# Database (Supabase PostgreSQL)
DB_HOST=aws-0-eu-west-1.pooler.supabase.com
DB_PORT=5432
DB_USERNAME=postgres.PROJECT_REF
DB_PASSWORD=your_password
DB_DATABASE=postgres
DB_DIALECT=postgres

# Auth
JWT_SECRET=your-secret-key

# Squad Payments
SQUAD_BASE_URL=https://sandbox-api-d.squadco.com
SQUAD_SECRET_KEY=your_key

# Storage (S3-compatible)
STORAGE_ACCESS_KEY_ID=your_key
STORAGE_SECRET_ACCESS_KEY=your_secret
STORAGE_BUCKET_NAME=your_bucket
STORAGE_ENDPOINT=https://account.r2.cloudflarestorage.com
STORAGE_REGION=auto

# Optional: AI providers
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key
```

## Tech Stack

- Node.js + Express + TypeScript
- PostgreSQL (Supabase)
- Sequelize ORM
- JWT + bcrypt
- Squad payments
- S3-compatible storage
- AI: Gemini/OpenAI

## Project Structure

```
src/
├── controllers/       # Request handlers
├── services/
│   ├── marketplace/  # Core marketplace
│   ├── matching/     # AI matching
│   ├── squad/        # Payment integration
│   ├── storage/      # S3 file uploads
│   └── ai/          # AI providers
├── models/          # Database models
├── routes/          # API endpoints
├── config/          # Service configs
└── database/
    └── migrations/  # Tracked SQL migrations
```

## License

MIT
