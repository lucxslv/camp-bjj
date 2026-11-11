# Camp BJJ

Plataforma de gestão de competições de BJJ (Brazilian Jiu-Jitsu). Transforma a burocracia de campeonatos — inscrições, categorias, pesagens, consentimentos — em fluxos claros e auditáveis.

## Visão

Campeonatos de BJJ hoje rodam no papel, planilhas ou sistemas genéricos que não entendem o esporte. Resultado: atletas na categoria errada, professores sem visibilidade, organizadores apagando incêndio.

O Camp BJJ centraliza tudo:

- **Atleta** se inscreve, vê sua categoria sugerida, acompanha status e pendências
- **Professor** revisa inscrições das competições dele, aprova/rejeita, registra pesagem
- **Organizador** cria o campeonato, define divisões/categorias/prazos, vê auditoria completa
- **Backend** é a autoridade — regras de negócio, transições de estado, arquivos privados, consentimento de menor

## Stack (Monorepo)

```
camp-bjj/
├── apps/
│   ├── backend/          # NestJS + Prisma + Supabase (implementado)
│   └── frontend/         # React + Vite + TypeScript (a fazer)
├── packages/
│   └── shared/           # Tipos TypeScript gerados do OpenAPI (a fazer)
└── docs/                 # Specs, planos, decisões
```

| Camada | Tech |
|--------|------|
| Backend | Node 20, NestJS 10, Prisma, Supabase (Auth + Postgres + Storage) |
| Frontend | React 19, Vite, TypeScript, TanStack Query, Tailwind, React Hook Form + Zod |
| Shared | Tipos gerados via `openapi-typescript-codegen` / `orval` |
| Docs | Swagger/OpenAPI em `/docs` |
| Testes | Jest + Supertest (TDD no backend) |

## Status Atual

| Módulo | Status |
|--------|--------|
| **Backend** | ✅ Tasks 1-9 completas, Task 10 parcial |
| Auth (Supabase JWT + guards) | ✅ |
| Competições + Divisões + Categorias | ✅ |
| Algoritmo de elegibilidade + Snapshots | ✅ |
| State Machine inscrições + Auditoria | ✅ |
| Pesagens (idempotent, invalida categoria) | ✅ |
| Arquivos privados (signed URLs) + Consentimento menor | ✅ |
| Swagger/OpenAPI + geração de tipos | ✅ |
| Frontend | 🚧 Não iniciado |
| Testes integração completos | 🚧 Parcial (unit + health check) |

## Rodar o Backend Local

```bash
cd apps/backend
npm install
npx prisma generate
# Configure DATABASE_URL no .env (PostgreSQL local ou Supabase local)
npx prisma migrate dev
npm run test        # unitários
npm run test:e2e    # e2e
npm run start:dev   # http://localhost:3000/v1
```

**Swagger:** `http://localhost:3000/docs`  
**OpenAPI JSON:** `http://localhost:3000/v1/docs-json`

## Próximos Passos (Roadmap)

### Frontend (próximo)
1. Scaffold React + Vite + TypeScript + Tailwind
2. Supabase Auth SDK (login, session, refresh)
3. Cliente HTTP tipado (gerado do OpenAPI)
4. Páginas: competições públicas, login, perfil atleta, inscrições
5. Área professor: fila de revisão, pesagem
6. Área organizer: CRUD competições, divisões, categorias

### Backend (pendências)
- Testes de integração completos (5 Review Focus + 10 critérios de aceite)
- Rate limiting nas rotas de auth
- Soft delete / archive de competições
- Notificações (email/push) para mudanças de status

## Decisões de Arquitetura (Resumo)

- **Backend = autoridade** — frontend nunca valida regra de negócio ou autorização
- **Supabase Auth = identidade** — backend só valida JWT via JWKS; perfil interno em tabela `users`
- **Prisma schema-first** — migrations versionadas, tipo-seguro
- **RLS + NestJS guards** — defesa em profundidade
- **State machine explícita** — transições auditadas, optimistic lock, idempotência
- **Signed URLs** — upload direto no Storage, bucket privado, TTL curto
- **Monorepo** — tipos compartilhados, CI único, deploy coordenado

## Documentação

- **Spec completo:** `docs/superpowers/specs/2026-11-11-camp-bjj-backend-design.md`
- **Plano implementação:** `docs/superpowers/plans/2026-11-11-camp-bjj-backend.md`
- **Guia integração frontend:** `FRONTEND_INTEGRATION_GUIDE.md` (no worktree, não commitado)

## Convenção de Commits

```
feat: nova funcionalidade
fix: correção de bug
chore: manutenção (deps, configs, scripts)
docs: documentação
test: testes
refactor: refatoração sem mudança de comportamento
```

## Licença

Projeto privado — Camp BJJ Team.