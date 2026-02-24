# Análise Arquitetural — Labrego CRM

> **Gerado por:** @architect (Aria) | **Data:** 2026-02-17
> **Status:** Brownfield Discovery — Mapeamento Inicial

---

## 1. Resumo da Arquitetura

| Aspecto | Tecnologia |
|---------|-----------|
| **Framework** | Next.js 15.5.9 (App Router) |
| **Linguagem** | TypeScript 5.9.3 |
| **UI** | React 18 + Tailwind CSS 3.4 + Tiptap (rich text) |
| **Database** | Firebase Firestore (NoSQL, real-time) |
| **Auth** | Firebase Auth (email/password + OAuth Google) |
| **Storage** | Firebase Storage |
| **Push** | Firebase Cloud Messaging (FCM) |
| **Voice/AI** | VAPI + OpenAI GPT-4o-mini + Google Calendar |
| **Email** | Nodemailer (Gmail SMTP) + React Email |
| **Automação** | N8N (webhooks), Meta (LeadGen Ads) |
| **Deploy** | Vercel-ready (Next.js), Docker (prospeccao-ativa) |

**Padrão arquitetural:** Monolito modular full-stack, multi-tenant SaaS com 3 planos (Basic R$97, Standard R$197, Pro R$497). Firebase é o backend-as-a-service central — não há banco relacional.

---

## 2. Módulos / Features Identificados

### Módulos Core

| # | Módulo | Rota | Arquivos-Chave | Complexidade |
|---|--------|------|----------------|-------------|
| 1 | **Contatos/CRM** | `/contatos` | `contatos/page.tsx`, `contatos/[id]/page.tsx`, `useClientCrmDocuments.ts` | Alta |
| 2 | **Funil de Vendas** | `/funil` | `funil/page.tsx`, `funil/components.tsx`, `funnels.ts`, `types/funnel.ts` | Alta |
| 3 | **Propostas** | `/contatos/[id]/proposta` | `ProposalPdf.tsx` (37.7 KB!), jsPDF | Média |
| 4 | **Cadência** | `/cadencia` | `cadencia/page.tsx` | Média |
| 5 | **Conversão/Analytics** | `/conversao` | `conversao/page.tsx`, Recharts | Média |
| 6 | **Ligações/Voice Agent** | `/ligacoes` | `callRouting.ts` (40.4 KB), `callQueue.ts` (14.9 KB) | **Muito Alta** |
| 7 | **Produtividade** | `/funil/produtividade` | Métricas de vendas | Baixa |

### Módulos de Infraestrutura

| # | Módulo | Arquivos-Chave |
|---|--------|----------------|
| 8 | **Auth & Multi-Tenancy** | `CrmUserContext.tsx`, `orgResolver.ts`, `organization.ts`, `orgMembers.ts` |
| 9 | **Permissões (RBAC)** | `usePermissions.ts`, `PermissionGate.tsx`, `PlanGate.tsx`, `featureGate.ts` |
| 10 | **Sistema de Créditos** | `credits.ts`, `types/credits.ts`, `admin/creditos/` |
| 11 | **Notificações** | `firebaseMessaging.ts`, `serverNotifications.ts`, `sendNotification.ts` |
| 12 | **Email** | `email.ts`, React Email templates |

### Módulos Satélites (fora do monolito)

| # | Módulo | Diretório | Stack |
|---|--------|-----------|-------|
| 13 | **Chrome Extension** | `chrome-extension/` | Manifest v3, content scripts |
| 14 | **Prospecção Ativa** | `prospeccao-ativa/` | Node.js standalone, Docker |

### Integrações Externas (Webhooks/APIs)

| # | Integração | Endpoints | Protocolo |
|---|-----------|-----------|-----------|
| 15 | **VAPI** (Voice AI) | 4 rotas `/api/vapi/*` | REST + Webhooks |
| 16 | **Meta/Facebook** | `/api/meta/webhooks` | Webhooks (HMAC-SHA256) |
| 17 | **N8N** | 3 rotas `/api/n8n/*` | Webhooks (HMAC-SHA256) |
| 18 | **Google Calendar** | Integrado em `callRouting.ts` | googleapis SDK |
| 19 | **Twilio** (WhatsApp) | Integrado em prospecção | REST API |
| 20 | **OpenAI** | Classificação de chamadas | REST API |

---

## 3. Dependências Críticas

### Firebase — Dependência Central (Risco Máximo)

```
Firebase Auth      ←→ TODA autenticação
Firebase Firestore ←→ TODA persistência de dados
Firebase Storage   ←→ Imagens e arquivos
Firebase FCM       ←→ Push notifications
Firebase Admin SDK ←→ TODAS as APIs server-side
```

**Impacto:** Firebase é o coração do sistema. Migrar para outro backend (ex: Supabase, PostgreSQL) exigiria reescrever **praticamente toda a camada de dados e auth**.

### Acoplamento direto ao Firestore por toda a aplicação

O Firestore é acessado diretamente em:
- 27 arquivos em `src/lib/` (queries diretas com `collection()`, `doc()`, `onSnapshot()`)
- 26+ API routes (cada uma faz queries Firestore diretamente)
- Componentes de página (via `onSnapshot` listeners)

**Não existe camada de abstração (repository pattern).** Cada arquivo importa `firebaseAdmin` ou `firebaseClient` e faz queries diretamente.

### Dependências de Produção Críticas

| Pacote | Risco se Removido |
|--------|-------------------|
| `firebase` + `firebase-admin` | **Sistema inteiro para** |
| `next` | Framework base |
| `googleapis` | Voice scheduling quebra |
| `nodemailer` | Emails param |
| `@hello-pangea/dnd` | Kanban quebra |
| `jspdf` + `jspdf-autotable` | Propostas PDF param |
| `@tiptap/*` | Editor rich text quebra |
| `recharts` | Analytics/gráficos param |

### Dependências de Produção (Todas)

| Pacote | Versão | Função |
|--------|--------|--------|
| `@hello-pangea/dnd` | ^18.0.1 | Drag & drop (Kanban) |
| `@heroicons/react` | ^2.2.0 | Ícones |
| `@radix-ui/react-icons` | ^1.3.2 | Ícones adicionais |
| `@react-email/components` | ^1.0.7 | Templates de email |
| `@react-email/render` | ^2.0.4 | Renderização de email |
| `@tailwindcss/typography` | ^0.5.16 | Prose styling |
| `@tiptap/starter-kit` | ^3.15.3 | Editor rich text base |
| `@tiptap/react` | ^3.15.3 | Integração React Tiptap |
| `@tiptap/extension-*` | ^3.15.3 | Extensões Tiptap (bubble-menu, color, dropcursor, highlight, image, link, placeholder, text-style, underline) |
| `date-fns` | ^3.6.0 | Utilitários de data |
| `firebase` | ^12.2.1 | Firebase client SDK |
| `firebase-admin` | ^13.4.0 | Firebase admin SDK |
| `googleapis` | ^132.0.0 | Google APIs (Calendar) |
| `html2canvas-pro` | ^1.6.7 | HTML para canvas |
| `jspdf` | ^3.0.2 | Geração de PDF |
| `jspdf-autotable` | ^5.0.2 | Tabelas em PDF |
| `lucide-react` | ^0.540.0 | Ícones modernos |
| `next` | ^15.5.9 | Framework React |
| `nodemailer` | ^7.0.5 | Envio de email |
| `react` | ^18.3.1 | Biblioteca core |
| `react-dom` | ^18.3.1 | Renderização DOM |
| `react-hook-form` | ^7.57.0 | Gerenciamento de forms |
| `recharts` | ^2.15.3 | Visualização de dados |
| `server-only` | ^0.0.1 | Enforcement server-side |
| `sonner` | ^2.0.7 | Toast notifications |
| `xlsx` | ^0.18.5 | Import/export Excel |

---

## 4. Pontos de Acoplamento Forte

### 4.1 `callRouting.ts` — God File (40.4 KB)

Este arquivo concentra **toda** a lógica de:
- Chamadas VAPI (iniciar, configurar, webhook)
- Google Calendar (disponibilidade, agendamento)
- OpenAI (classificação de resultados)
- Twilio (WhatsApp)
- Firestore (config, scripts, outcomes, queue)

**Risco:** Qualquer mudança em voz/calendário/IA toca este arquivo. É o maior risco de regressão do projeto.

### 4.2 `CrmUserContext.tsx` — Single Point of Failure para Auth

Todas as páginas dependem deste contexto. Ele resolve:
- Usuário autenticado (Firebase Auth)
- Organização (multi-tenant)
- Membro e permissões
- Plano ativo

Se este contexto falha, **toda a aplicação fica inacessível**.

### 4.3 `layout.tsx` (Root) — Monolítico

O layout raiz contém:
- Auth guard
- Sidebar
- Context providers
- Lógica de redirecionamento

### 4.4 Acoplamento Firestore → Lógica de Negócio

Não há separação entre:
- Camada de acesso a dados (repository)
- Camada de serviço (business logic)
- Camada de apresentação (componentes)

Páginas e APIs fazem queries Firestore + lógica de negócio + formatação no mesmo arquivo.

### 4.5 `ProposalPdf.tsx` (37.7 KB) — Componente Gigante

Gera PDFs completos com toda a lógica de layout, cálculo e formatação inline. Difícil de testar ou reutilizar.

---

## 5. Riscos para Extração de Módulo

| Risco | Severidade | Motivo |
|-------|-----------|--------|
| **Firebase lock-in** | CRITICAL | Firestore queries espalhadas por 50+ arquivos, sem abstração |
| **callRouting god file** | CRITICAL | 40 KB com 5 integrações externas misturadas |
| **Sem testes unitários** | CRITICAL | Nenhum teste encontrado — refatoração sem rede de segurança |
| **Multi-tenancy acoplada** | HIGH | `orgId` resolvido de formas diferentes em cada endpoint |
| **Context monolítico** | HIGH | CrmUserContext concentra auth + org + permissions + plan |
| **Tipos incompletos** | HIGH | Contatos/Clients não tem tipo definido em `types/` — usa `any` |
| **ProposalPdf monolítico** | MEDIUM | 37 KB, impossível extrair sem refatorar |
| **Chrome Extension acoplada** | MEDIUM | 8 endpoints `/api/extension/*` com auth própria |
| **Sem API versioning** | MEDIUM | Breaking changes afetam extension e N8N simultaneamente |

---

## 6. Sugestões para Modularização Futura

### Fase 1 — Fundações (Pré-requisito para tudo)

1. **Criar camada de Repository/Service**
   - Abstrair Firestore em `repositories/` (ex: `ContactRepository`, `FunnelRepository`, `OrgRepository`)
   - Centralizar queries, eliminar acesso direto ao Firestore em APIs e páginas
   - **Impacto:** Habilita troca de DB no futuro e facilita testes

2. **Definir tipo `Contact/Client`** em `types/`
   - Entidade mais usada do sistema não tem tipo formal
   - Reduz `any` e melhora DX

3. **Adicionar testes unitários mínimos**
   - Cobrir `callRouting.ts`, `credits.ts`, `funnels.ts`, `organization.ts`
   - Setup: Vitest + mock do Firebase

### Fase 2 — Desacoplamento de Módulos

4. **Quebrar `callRouting.ts` em módulos**
   ```
   lib/voice/
   ├── vapi-client.ts      # API calls ao VAPI
   ├── calendar-service.ts  # Google Calendar
   ├── call-classifier.ts   # OpenAI classification
   ├── whatsapp-client.ts   # Twilio WhatsApp
   ├── call-config.ts       # Firestore config
   └── index.ts             # Re-exports
   ```

5. **Decompor `CrmUserContext`**
   ```
   contexts/
   ├── AuthContext.tsx        # Firebase Auth only
   ├── OrganizationContext.tsx # Org data
   ├── PermissionsContext.tsx  # RBAC
   └── PlanContext.tsx         # Feature gates
   ```

6. **Extrair ProposalPdf** em módulo com template engine

### Fase 3 — Preparação para Microserviços (se necessário)

7. **Extrair Voice/Call como serviço independente**
   - `prospeccao-ativa/` já é um serviço separado — consolidar toda lógica de voz nele
   - API gateway via `/api/voice/*` proxy

8. **Extrair Notifications como serviço**
   - Email + FCM + WhatsApp em um serviço unificado

9. **API versioning** (`/api/v1/`) para proteger integrações externas

---

## 7. Estrutura de Diretórios

```
/Users/lucassantos/labrego-crm/
├── .aios-core/              # Synkra AIOS framework
├── .claude/                 # Claude Code configuration
├── chrome-extension/        # Chrome browser extension (Manifest v3)
├── docs/
│   ├── architecture/        # Documentação de arquitetura (este arquivo)
│   └── prd/                 # Product requirement documents
├── prospeccao-ativa/        # Serviço de prospecção (Docker, Node.js)
├── public/                  # Assets estáticos + PWA manifest + FCM service worker
├── scripts/                 # Scripts de migração e seed
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── admin/           # Páginas admin (usuarios, creditos, plano)
│   │   ├── api/             # 26 API routes
│   │   │   ├── call-routing/  # 6 endpoints de roteamento de chamadas
│   │   │   ├── extension/     # 8 endpoints para Chrome Extension
│   │   │   ├── vapi/          # 4 endpoints VAPI (voice AI)
│   │   │   ├── meta/          # Webhook Meta/Facebook
│   │   │   ├── n8n/           # 3 endpoints N8N
│   │   │   ├── crm/           # Client management
│   │   │   ├── super-admin/   # 2 endpoints super-admin
│   │   │   ├── fcm-token/     # FCM token registration
│   │   │   └── send-notification/ # Push notifications
│   │   ├── cadencia/        # Cadência de vendas
│   │   ├── contatos/        # CRM de contatos + propostas
│   │   ├── conversao/       # Analytics de conversão
│   │   ├── funil/           # Funil de vendas (Kanban)
│   │   ├── ligacoes/        # Gerenciamento de ligações
│   │   ├── login/           # Autenticação
│   │   └── super-admin/     # Super admin
│   ├── components/          # 15 componentes React
│   ├── contexts/            # CrmUserContext (auth + org + plan)
│   ├── hooks/               # 5 custom hooks
│   ├── lib/                 # 27 módulos utilitários
│   └── types/               # 6 arquivos de tipos TypeScript
├── middleware.ts            # Security headers + auth bypass
├── next.config.ts           # Image domains (Firebase, Google)
├── tailwind.config.js       # Theme customizado (Poppins, cores Indigo)
└── package.json             # 14 deps prod + 13 dev deps
```

---

## 8. Collections Firestore (Modelo de Dados)

| Collection | Escopo | Campos Principais |
|-----------|--------|-------------------|
| `organizations` | Global | id, name, slug, plan, settings, limits, status |
| `organizationMembers` | Per-org | email, role, permissions, orgId |
| `clients` | Per-org | name, phone, email, company, funnelStage, leadSource, orgId |
| `clients/{id}/calls` | Per-client | Registros de chamadas |
| `clients/{id}/followups` | Per-client | Follow-ups agendados |
| `clients/{id}/logs` | Per-client | Logs de atividade |
| `funnelStages` | Per-org | Estágios do funil |
| `callRoutingConfig` | Per-org | Configuração de roteamento |
| `callScripts` | Per-org | Scripts de vendas |
| `callOutcomes` | Per-org | Classificação de resultados |
| `fcmTokens` | Global | Tokens de push notification |
| `userRoles` | Global | Roles por email (legado) |
| `serverNotificationLogs` | Global | Logs de notificação |
| `notificationPreferences` | Per-user | Preferências de notificação |
| `emailLogs` | Global | Logs de emails enviados |

---

## 9. Sistema de Planos

| Plano | Preço | Usuários | Funis | Contatos | Créditos | Features Exclusivas |
|-------|-------|----------|-------|----------|----------|-------------------|
| Basic | R$97 | 3 | 1 | 500 | 0 min | funnel, contacts, proposals |
| Standard | R$197 | 10 | 3 | 2.000 | 60 min | + cadence, productivity, whatsapp |
| Pro | R$497 | 50 | 10 | 10.000 | 300 min | + email, crm automation, voice, ai reports |

---

## 10. Diagrama de Dependências (Alto Nível)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser    │────▶│  Next.js App │────▶│  Firebase   │
│  (React 18)  │     │  (App Router)│     │  Firestore  │
└─────────────┘     └──────┬───────┘     │  Auth       │
                           │             │  Storage    │
┌─────────────┐            │             │  FCM        │
│  Chrome Ext  │───▶ /api/extension/*    └─────────────┘
└─────────────┘            │
                           ├──▶ VAPI (Voice AI)
┌─────────────┐            ├──▶ Google Calendar
│  Meta/FB     │───▶ /api/meta/*
└─────────────┘            ├──▶ OpenAI (Classification)
                           ├──▶ Twilio (WhatsApp)
┌─────────────┐            ├──▶ Gmail (Nodemailer)
│  N8N         │───▶ /api/n8n/*
└─────────────┘            │
                    ┌──────┴───────┐
                    │ prospeccao-  │
                    │ ativa/       │
                    │ (Docker)     │
                    └──────────────┘
```

---

## 11. Variáveis de Ambiente

### Firebase
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Web Push)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (Admin)

### Voice & Telephony
- `VAPI_API_KEY`
- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`

### Email
- `GMAIL_USER`, `GMAIL_PASS`

### Meta Integration
- `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`

### N8N Integration
- `N8N_CRM_WEBHOOK_SECRET`, `N8N_WEBHOOK_LEAD_CREATED`

### Application
- `NEXT_PUBLIC_APP_URL`, `DEFAULT_ORG_ID`, `FORM_SECRET`

---

## 12. Conclusão

O **Labrego CRM** é um produto funcional e bem resolvido para seu estágio, mas apresenta dívida técnica típica de crescimento rápido:

- **Forte:** Multi-tenancy implementada, RBAC granular, feature gating por plano, integrações reais funcionando
- **Fraco:** Firebase lock-in sem abstração, god files (callRouting 40KB, ProposalPdf 37KB), zero testes, tipos incompletos

A prioridade #1 para modularização é a **camada de Repository** — sem ela, qualquer extração de módulo será frágil e arriscada.

---

*Gerado por @architect (Aria) — Synkra AIOS*
