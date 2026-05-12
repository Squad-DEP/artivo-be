# Artivo API

Marketplace platform connecting artisans to customers with AI-powered matching, digital profiles, and payment processing.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your database credentials

# Setup database
npm run db:reset

# Start server
npm start

# Test everything
./test-marketplace-api.sh
```

## What It Does

**For Customers:**
- Browse artisan profiles with AI-powered ranking
- Post job requests
- Hire artisans and track jobs
- Make payments via Squad
- Rate artisans after job completion

**For Artisans:**
- Subscribe to job types for notifications
- Get real-time job alerts (Server-Sent Events)
- Accept jobs and manage work
- Rate customers
- Build reputation score automatically

## Key Features

- **AI Matching**: Hybrid algorithm (70% traditional + 30% AI semantic) ranks artisans based on skills, location, and reputation
- **Bidirectional Ratings**: Both customers and artisans can rate each other
- **Real-time Notifications**: SSE stream for instant job alerts
- **Automatic Reputation**: Credit score calculated from ratings and job completion
- **Clean Architecture**: Dependency injection, SOLID principles, proper error handling

## Database Commands

```bash
npm run db:reset   # Drop all tables, recreate schema, and seed data
npm run db:up      # Run migrations only
npm run db:down    # Drop all tables
```

## API Documentation

See [MARKETPLACE_API.md](./MARKETPLACE_API.md) for complete API reference.

## Architecture

```
Routes → Controllers → Services → Models → Database
```

- **Routes**: HTTP endpoints with validation (express-validator)
- **Controllers**: Request/response handling
- **Services**: Business logic with dependency injection
- **Models**: Sequelize ORM models

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

# Optional: AI providers for matching
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key
```

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Supabase)
- **ORM**: Sequelize
- **Auth**: JWT + bcrypt
- **Validation**: express-validator
- **AI**: Google Gemini / OpenAI (swappable)

## Testing

The test script covers the complete workflow:
1. Customer and artisan signup
2. Artisan subscribes to job types
3. Customer browses artisan feed
4. Customer posts job request
5. Artisan views and accepts job
6. Customer logs payment
7. Both parties mark job complete
8. Bidirectional ratings
9. Reputation score updates

All tests pass ✅

## Project Structure

```
src/
├── controllers/       # Request handlers
├── services/         # Business logic
│   ├── marketplace/  # Core marketplace services
│   ├── matching/     # AI matching algorithm
│   ├── ai/          # AI providers (Gemini, OpenAI)
│   └── speech/      # Speech-to-text providers
├── models/          # Database models
├── routes/          # API endpoints
├── providers/       # Utilities (DB, Auth, Errors)
└── database/
    └── migrations/  # SQL migrations
```

## License

MIT
