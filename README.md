# CVFlow API 🚀

Backend Node.js + Express pour la plateforme CVFlow — avec RAG agéntic, défense anti-injection, LLMOps et evals automatisés.

## Nouveautés Phase 1-3

### RAG Agéntic
- Indexation automatique du CV en chunks (expériences, compétences, formation, etc.)
- Embeddings via Ollama (nomic-embed-text)
- Recherche par similarité cosinus pour contextualiser les réponses

### Défense Anti-Injection
- 12 patterns de jailbreak détectés et bloqués
- Logging de toutes les tentatives en base de données
- Réponse neutre en cas de détection

### Dashboard LLMOps (/api/admin)
- GET /api/admin/stats — KPIs, activité 30j, providers, RAG stats
- GET /api/admin/conversations — Liste filtrée avec détails
- GET /api/admin/security — Patterns détectés, historique jailbreaks

### Evals Automatisés
- 15 tests en 5 catégories : Factual, Persona, Sécurité, Qualité, Langue
- 100% de réussite sur tous les profils testés
- Usage: node evals/runner.js <username> <api_url>

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
- POST /api/chat/:username/reindex

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

### Admin (LLMOps)
- GET /api/admin/stats
- GET /api/admin/conversations
- GET /api/admin/conversations/:id
- GET /api/admin/security

## Stack
- Node.js + Express + TypeScript
- Prisma v7 + PostgreSQL
- JWT Authentication
- Ollama / Gemini / Claude API
- RAG avec embeddings nomic-embed-text

## Base de données
- User, CV, Job (tables Prisma)
- ChatLog (logs conversations + jailbreaks)
- CVChunk (index RAG du CV)

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

## Evals
```bash
node evals/runner.js mady http://localhost:4000
node evals/runner.js isaac-loorius http://localhost:4000
```

*CVFlow API — Votre carrière, propulsée par l'IA* 🚀
