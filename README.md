# Artivo API

**Connect Artisans to Real Opportunities**

Marketplace platform with AI-powered onboarding, digital profiles, and payment processing.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your config
npm run db:migrate
npm start
```

## Key Features

- **AI Onboarding**: Voice/text signup with swappable AI providers
- **Authentication**: JWT-based auth with email verification
- **Modular Architecture**: Easy to swap STT and AI providers

## API Endpoints

### Auth
- `POST /api/v1/auth/sign-up` - Register
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/forgot` - Password reset

### AI
- `POST /api/v1/ai/onboard/voice` - Voice onboarding (STT → AI)
- `POST /api/v1/ai/onboard/text` - Text onboarding
- `POST /api/v1/ai/chat` - General assistance

## Configuration

### AI Provider
Set `AI_PROVIDER` in `.env`:
- `gemini` - Google Gemini (default)
- `openai` - OpenAI GPT

### Speech Provider
Set `SPEECH_PROVIDER` in `.env`:
- `whisper` - OpenAI Whisper (default)
- Add more in `src/services/speech/`

## Architecture

```
services/
├── speech/          # STT providers (Whisper, Google, etc.)
│   ├── ISpeechProvider.ts
│   ├── WhisperProvider.ts
│   └── SpeechService.ts
└── ai/              # AI providers (Gemini, OpenAI, etc.)
    ├── IAIProvider.ts
    ├── GeminiProvider.ts
    ├── OpenAIProvider.ts
    └── AIService.ts
```

## Adding Providers

### New STT Provider
1. Implement `ISpeechProvider` interface
2. Add to `SpeechService.ts` switch statement
3. Set `SPEECH_PROVIDER` env variable

### New AI Provider
1. Implement `IAIProvider` interface
2. Add to `AIService.ts` switch statement
3. Set `AI_PROVIDER` env variable

## See Also
- `PRODUCT_SPEC.md` - Full product requirements
