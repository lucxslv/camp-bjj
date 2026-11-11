# Camp BJJ Backend — Guia para o Dev Frontend

> **Status:** Backend funcional (Tasks 1-8 completas)
> **Branch de trabalho:** `feat/backend-implementation` (worktree: `../camp-bjj-backend-feat`)
> **Último commit:** `66d1ff6` — private files + guardian consent
> **Data:** 11/11/2026

---

## O que está implementado

| Módulo | Status | Descrição |
|--------|--------|-----------|
| **Auth** | ✅ | Supabase JWT, perfil, guards (organizer, professor por competição) |
| **Competições** | ✅ | CRUD, divisões (Gi/No-Gi/Absoluto), categorias com algoritmo de elegibilidade |
| **Inscrições** | ✅ | State machine (`needs_review` → `confirmed`/`rejected`/`cancelled`), snapshots de regras, auditoria |
| **Pesagens** | ✅ | Idempotentes, invalidam categoria → volta para `needs_review` com `pendingCategory` |
| **Arquivos** | ✅ | Signed URLs (upload 15min, download 5min), bucket privado, validação MIME/tamanho |
| **Consentimento** | ✅ | Responsável legal, expiração, status (pending/approved/expired/rejected) |

---

## Como rodar localmente

```bash
# No worktree do backend
cd ../camp-bjj-backend-feat/apps/backend

# Instalar dependências
npm install

# Gerar Prisma Client
npx prisma generate

# Subir banco (precisa de PostgreSQL local ou Supabase local)
# Configure DATABASE_URL no .env
npx prisma migrate dev

# Rodar testes
npm run test:e2e

# Iniciar em dev
npm run start:dev
```

**Porta padrão:** `3000` (prefixo `/v1`)
**Swagger:** `http://localhost:3000/docs`

---

## Autenticação

- **Login:** Feito pelo frontend via **Supabase Auth SDK** (não pelo backend)
- **Token:** Access token JWT do Supabase → enviar no header `Authorization: Bearer <token>`
- **Backend valida:** JWT via JWKS do Supabase (chave pública)
- **Perfil interno:** `GET /v1/me` retorna perfil + permissões efetivas

```typescript
// Exemplo de uso no frontend
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token

const response = await fetch('/v1/me', {
  headers: { Authorization: `Bearer ${token}` }
})
```

---

## Endpoints Principais (prefixo `/v1`)

### Autenticação / Perfil
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/me` | ✅ | Perfil + permissões |
| PATCH | `/me/profile` | ✅ | Atualizar nome |
| POST | `/me/complete-profile` | ✅ | Completar perfil atleta (birthDate, beltRank, weightKg) |

### Competições (públicas)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/competitions` | Lista (filtros: status, upcoming) |
| GET | `/competitions/:id` | Detalhes + divisões + categorias |
| GET | `/competitions/slug/:slug` | Por slug |
| GET | `/competitions/:id/divisions` | Divisões ativas |
| GET | `/competitions/:id/categories` | Categorias publicadas |
| GET | `/division-types` | Catálogo (GI, NO_GI, ABSOLUTO) |

### Inscrições (atleta)
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/registrations` | ✅ | Criar inscrição em divisão |
| GET | `/registrations` | ✅ | Listar próprias (filtros: status, competitionId) |
| GET | `/registrations/:id` | ✅ | Detalhe (inclui pesagens, histórico, consentimento) |
| POST | `/registrations/:id/cancel` | ✅ | Cancelar (se dentro do prazo) |
| GET | `/registrations/:id/snapshot` | ✅ | Snapshot de regras no momento da inscrição |

### Ações de Professor (requer `CompetitionScopeGuard`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/professor/reviews` | Fila de revisões (competições atribuídas) |
| POST | `/registrations/:id/approve` | Aprovar (valida elegibilidade + consentimento) |
| POST | `/registrations/:id/reject` | Rejeitar (exige justificativa) |
| POST | `/registrations/:id/reopen` | Reabrir rejeição (exige justificativa) |
| POST | `/registrations/:id/weigh-ins` | Registrar pesagem (idempotent key) |
| GET | `/registrations/:id/weigh-ins` | Histórico de pesagens |

### Organizer / Admin
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/competitions` | Criar competição |
| PATCH | `/competitions/:id` | Atualizar |
| POST | `/competitions/:id/divisions` | Habilitar divisão |
| POST | `/competitions/:id/categories` | Criar categoria |
| POST | `/registrations/:id/resolve-exception` | Exceção pós-prazo (cancelled → needs_review) |
| GET | `/competitions/:id/audit` | Log de auditoria |

### Arquivos (signed URLs)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/files/signed-upload-url` | Gera signed PUT URL (body: competitionId, registrationId?, purpose, fileName, mimeType, sizeBytes) |
| POST | `/files/signed-download-url` | Gera signed GET URL (body: fileId) |
| POST | `/files/metadata` | Registrar metadados após upload do cliente |
| GET | `/files/registration/:registrationId` | Arquivos de uma inscrição |
| GET | `/files/competition/:competitionId` | Arquivos de competição (professor+) |

### Consentimento
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/consents` | Criar/atualizar consentimento (guardianName, guardianDocument, documentUrl, expiresAt) |
| GET | `/consents/athlete/:athleteId/competition/:competitionId` | Consultar |
| GET | `/consents` | Listar (filtros: status, competitionId) — professor/organizer |
| PATCH | `/consents/:id/status` | Atualizar status (organizer/admin) |

---

## Formato de Erros (padronizado)

```json
{
  "statusCode": 409,
  "code": "STATE_CONFLICT",
  "message": "Registration was modified by another operation. Please retry.",
  "details": { "path": "/v1/registrations/abc/approve", "method": "POST" }
}
```

| Código HTTP | Code | Quando |
|-------------|------|--------|
| 400 | `VALIDATION_ERROR` | DTO inválido |
| 401 | `UNAUTHENTICATED` | Token ausente/inválido/expirado |
| 403 | `FORBIDDEN` | Sem permissão (role ou escopo) |
| 404 | `NOT_FOUND` | Recurso não existe ou não acessível |
| 409 | `STATE_CONFLICT` | Concorrência (optimistic lock) / duplicidade |
| 422 | `BUSINESS_RULE_VIOLATION` | Regra de negócio (prazo, elegibilidade, consentimento) |
| 429 | `RATE_LIMITED` | Muitas requisições |
| 500 | `INTERNAL_ERROR` | Erro inesperado (sem stack trace) |

---

## Convenções Importantes

### Inscrição → Categoria
- **NÃO** decida categoria no frontend — mostre sugestão do backend (`suggestedCategory` no eligibility)
- Inscrição cria em `needs_review`; professor aprova/rejeita
- Após pesagem inválida: status volta para `needs_review`, `pendingCategoryId` = categoria anterior, `pendingReason` = `WEIGHT_OUT_OF_CATEGORY`
- Nova pesagem oficial necessária para confirmar nova categoria

### Unicidade
- Um atleta pode ter **múltiplas inscrições em divisões diferentes** da mesma competição
- **Não pode** ter duas inscrições ativas na mesma divisão (unique constraint em `athleteId + eventDivisionId` onde status ≠ cancelled/rejected)
- Após rejeição: **pode reinscrever** (soft delete na prática)

### Arquivos
- **Nunca** exponha URLs públicas permanentes
- Cliente faz upload direto no Supabase Storage via signed URL (backend só autoriza)
- Validação: MIME ∈ `{application/pdf, image/jpeg, image/png}`, max 10MB
- Bucket: `camp-bjj-private` (políticas RLS + NestJS guards)

### Consentimento (menores)
- Obrigatório para confirmação se atleta < 18 anos (verificar na regra da competição)
- Schema: `guardianName`, `guardianDocument`, `documentUrl` (signed URL), `expiresAt`
- Status: `PENDING` → `APPROVED` (por organizer/admin) → `EXPIRED` (auto) / `REJECTED`

---

## Gerar Tipos TypeScript (OpenAPI)

```bash
# No backend
cd ../camp-bjj-backend-feat/apps/backend

# Gerar spec OpenAPI (já exposto em /v1/docs-json)
# Depois use orval/openapi-typescript-codegen no frontend:
npx orval --config orval.config.ts
```

**Configuração sugerida (frontend):**
```typescript
// orval.config.ts
import { defineConfig } from 'orval'

export default defineConfig({
  campBjj: {
    input: 'http://localhost:3000/v1/docs-json', // ou arquivo local
    output: {
      target: './src/api/generated.ts',
      client: 'fetch',
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
})
```

---

## Variáveis de Ambiente (Frontend)

```env
# .env.local (frontend)
VITE_API_BASE_URL=http://localhost:3000/v1
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

---

## Checklist de Integração

- [ ] Configurar Supabase Auth no frontend (login, logout, session refresh)
- [ ] Interceptador HTTP para injetar `Authorization: Bearer <token>`
- [ ] Tratamento de erros 401 → tentar refresh → se falhar, logout
- [ ] Tratamento de 403 → mostrar "Acesso negado" (não tentar contornar)
- [ ] Tratamento de 409 → re-fetch dados e retry (concorrência)
- [ ] Invalidar queries TanStack Query após mutações (registrations, weigh-ins, files)
- [ ] Gerar tipos com orval e usar em todo lugar
- [ ] Testar fluxo completo: login → completar perfil → inscrição → pesagem → aprovação

---

## Dúvidas / Contato

- **Backend:** Lucas (este repo, branch `feat/backend-implementation`)
- **Spec completo:** `docs/superpowers/specs/2026-11-11-camp-bjj-backend-design.md`
- **Plano de implementação:** `docs/superpowers/plans/2026-11-11-camp-bjj-backend.md`

> **Importante:** O backend é a autoridade de segurança e regras de negócio. O frontend **nunca** deve impor validações de autorização ou elegibilidade — apenas mostrar o que a API retorna.