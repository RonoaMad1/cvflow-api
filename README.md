# CVFlow API 🚀

Backend Node.js + Express pour la plateforme CVFlow.

## Endpoints

### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### CV
- GET /api/cv/me
- PUT /api/cv/me
- GET /api/cv/:username (public)

### Chat
- POST /api/chat/:username

### Jobs
- POST /api/jobs/analyze
- GET /api/jobs
- PUT /api/jobs/:id/status
- DELETE /api/jobs/:id

### PDF
- POST /api/pdf/generate

### Interview
- POST /api/interview/questions
- POST /api/interview/evaluate

## Stack
- Node.js + Express + TypeScript
- Prisma v7 + PostgreSQL
- JWT Authentication
- Ollama / Gemini / Claude API

## Variables d'environnement
```env
DATABASE_URL=postgresql://user:password@localhost:5432/cvflow
JWT_SECRET=votre-secret
OLLAMA_URL=http://localhost:11434
GEMINI_API_KEY=votre-cle-gemini
ANTHROPIC_API_KEY=votre-cle-anthropic
```

## Lancer en local
```bash
npm install
npm run dev
```

*CVFlow API — Votre carrière, propulsée par l'IA* 🚀
