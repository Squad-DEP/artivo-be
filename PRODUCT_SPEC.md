# Artivo Platform - Product Specification

## Overview
Artivo is a marketplace platform connecting artisans with customers, featuring AI-powered onboarding, digital profiles, and integrated payment processing.

## Core Features

### 1. NLP-Powered Onboarding
- **Worker Onboarding**: Voice/text-based registration using AI (Gemini API)
- **Customer Onboarding**: Simplified registration with AI assistance
- **Data Collection**: Skills, experience, location, availability, preferences

### 2. Digital Profiles
- **Artisan Profiles**: Portfolio, skills, ratings, completion history
- **Customer Profiles**: Transaction history, preferences, saved artisans
- **Shareable Links**: Public profile URLs for marketing

### 3. Marketplace & Matching
- **Job Listings**: Customers post jobs, artisans browse/apply
- **AI Recommendation Engine**: Match artisans to jobs based on:
  - Skills and experience
  - Location proximity
  - Availability
  - Past performance
  - Customer preferences

### 4. Payment Integration (Squad)
- **Virtual Accounts**: Create accounts for users
- **Send/Receive**: Process payments between customers and artisans
- **Transaction History**: Retrieve and display transaction info
- **Escrow**: Hold payments until job completion

### 5. Reputation System
- **Rating System**: 1-5 stars after job completion
- **Reviews**: Text feedback from customers
- **Completion Rate**: Track job completion percentage
- **Credit Score**: Internal scoring based on:
  - Transaction history
  - Ratings received
  - Job completion rate
  - Response time
  - Dispute resolution

### 6. Credit Score API
- **External API**: Companies can check user credit scores
- **Authentication**: API key-based access
- **Rate Limiting**: Prevent abuse
- **Data Privacy**: Consent-based sharing

## Technical Architecture

### Voice Onboarding Flow
```
Audio Input → SpeechService → WhisperProvider → Text
                                                   ↓
Text → AIService → GeminiProvider/OpenAIProvider → Response
```

### Modular Design
- **Speech Layer**: Swappable STT providers (Whisper, Google, AssemblyAI)
- **AI Layer**: Swappable LLM providers (Gemini, OpenAI, Claude)
- **Easy to extend**: Implement interface, add to switch statement

### Backend Structure
```
/src
  /routes
    /auth          - Authentication endpoints
    /users         - User profile management
    /artisans      - Artisan-specific endpoints
    /jobs          - Job posting and management
    /payments      - Squad payment integration
    /ratings       - Rating and review system
    /ai            - AI engine communication layer
  /models
    User           - Base user model
    ArtisanProfile - Artisan-specific data
    Job            - Job postings
    Transaction    - Payment records
    Rating         - Reviews and ratings
  /services
    /ai            - AI service integrations (Gemini)
    /payment       - Squad payment service
    /matching      - Recommendation engine
  /middleware
    auth           - JWT authentication
    validation     - Input validation
    rateLimit      - API rate limiting
```

### Database Schema (Planned)

#### Users
- id, email, password, firstName, lastName
- userType (artisan/customer/both)
- phone, location
- emailVerified, phoneVerified
- createdAt, updatedAt

#### ArtisanProfiles
- userId, skills[], experience, hourlyRate
- availability, portfolio[]
- completionRate, averageRating
- creditScore

#### Jobs
- id, customerId, title, description
- budget, location, deadline
- status (open/assigned/completed/cancelled)
- assignedArtisanId

#### Transactions
- id, jobId, amount, status
- senderId, receiverId
- squadTransactionId, virtualAccountId

#### Ratings
- id, jobId, artisanId, customerId
- rating (1-5), review, response
- createdAt

## API Endpoints (Initial)

### Authentication
- `POST /api/v1/auth/sign-up` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/forgot` - Password reset request
- `POST /api/v1/auth/reset` - Reset password
- `GET /api/v1/_authcheck` - Verify token

### AI Onboarding
- `POST /api/v1/ai/onboard/voice` - Process voice data for onboarding
- `POST /api/v1/ai/onboard/text` - Process text input for onboarding
- `POST /api/v1/ai/chat` - General AI chat for assistance

### Users (Future)
- `GET /api/v1/user` - Get current user
- `PUT /api/v1/user` - Update profile
- `GET /api/v1/user/profile/:id` - Get public profile

### Artisans (Future)
- `POST /api/v1/artisans/profile` - Create/update artisan profile
- `GET /api/v1/artisans/search` - Search artisans
- `GET /api/v1/artisans/:id/ratings` - Get artisan ratings

### Jobs (Future)
- `POST /api/v1/jobs` - Create job posting
- `GET /api/v1/jobs` - List jobs
- `POST /api/v1/jobs/:id/apply` - Apply to job
- `PUT /api/v1/jobs/:id/assign` - Assign job to artisan

### Payments (Future)
- `POST /api/v1/payments/virtual-account` - Create virtual account
- `POST /api/v1/payments/send` - Send payment
- `GET /api/v1/payments/transactions` - Get transaction history

### Credit Score API (Future)
- `GET /api/v1/external/credit-score/:userId` - Get user credit score (API key required)

## Current Implementation Status

### ✅ Completed (Boilerplate)
- Basic Express server setup
- User authentication (JWT)
- Password reset flow
- Email verification
- Database migrations (Sequelize)
- Rate limiting
- Security headers (Helmet)

### 🚧 Next Steps
1. Remove group/team functionality (not needed)
2. Add AI service layer for Gemini integration
3. Create voice data endpoint for onboarding
4. Design artisan profile schema
5. Integrate Squad payment API
6. Build recommendation engine foundation

### 📋 Removed from Boilerplate
- Groups/Teams functionality
- Group invitations
- Multi-factor authentication (MFA) - can add later if needed
- Group-based permissions

## Environment Variables Required
```
# Database
DB_HOST=
DB_NAME=
DB_USER=
DB_PASS=

# Auth
JWT_SECRET=
FRONTEND_URL=
BACKEND_URL=

# AI Services
GEMINI_API_KEY=

# Payment (Squad)
SQUAD_API_KEY=
SQUAD_SECRET_KEY=
SQUAD_WEBHOOK_SECRET=

# Optional
H_CAPTCHA_SECRET=
```

## Development Priorities
1. **Phase 1**: Clean boilerplate, add AI voice endpoint
2. **Phase 2**: Artisan profile model and endpoints
3. **Phase 3**: Squad payment integration
4. **Phase 4**: Job posting and matching
5. **Phase 5**: Rating and reputation system
6. **Phase 6**: Credit score API for external companies
