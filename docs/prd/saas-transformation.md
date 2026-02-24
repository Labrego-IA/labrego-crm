# PRD: Transformacao SaaS — Labrego CRM

## Visao Geral

Transformar o Labrego CRM de single-tenant para multi-tenant SaaS com:
- Empresas (organizacoes) como unidade principal
- Usuarios vinculados a empresas com roles granulares
- Multiplos funis por empresa
- Sistema de permissoes por pagina/funcao
- Creditos para ligacoes (consumo por minuto)
- 3 planos: Basic, Standard, Pro

---

## Modelo de Planos

| Funcionalidade | Basic | Standard | Pro |
|---|:---:|:---:|:---:|
| Funil de vendas | X | X | X |
| Dados detalhados dos clientes | X | X | X |
| Geracao de propostas comerciais | X | X | X |
| Estrategia comercial (cadencia) | - | X | X |
| Gestao de produtividade | - | X | X |
| Plugin WhatsApp | - | X | X |
| Envio automatico de e-mails | - | - | X |
| Automacao CRM / nutricao de leads | - | - | X |
| Agente prospeccao ativa WhatsApp | - | - | X |
| Agente prospeccao ativa voz | - | - | X |
| Relatorios IA | - | - | X |

---

## Arquitetura de Dados (Firestore)

### Novas Collections

```
organizations/{orgId}
  name, slug, plan, logoUrl, createdAt, updatedAt
  settings: { defaultFunnelId, timezone, currency }
  limits: { maxUsers, maxFunnels, maxContacts }

organizations/{orgId}/members/{memberId}
  userId, email, role, displayName, photoUrl
  permissions: { pages: string[], actions: Record<string, boolean> }
  status: 'active' | 'invited' | 'suspended'
  joinedAt, invitedBy

organizations/{orgId}/funnels/{funnelId}
  name, description, color, isDefault, order, createdAt
  visibleTo: string[] (memberIds — vazio = todos)

organizations/{orgId}/funnels/{funnelId}/columns/{columnId}
  name, order, color, probability, maxDays
  countsForMetrics, conversionType, macroStageId

organizations/{orgId}/credits
  balance: number (minutos disponiveis)
  totalPurchased: number
  totalConsumed: number
  lastRechargeAt, lastConsumedAt

organizations/{orgId}/creditTransactions/{txId}
  type: 'purchase' | 'consumption' | 'adjustment' | 'bonus'
  amount: number (positivo ou negativo)
  description, callId?, adminEmail?, createdAt

plans/{planId}
  name: 'basic' | 'standard' | 'pro'
  displayName, price, features: string[]
  limits: { maxUsers, maxFunnels, maxContacts, monthlyCredits }

superAdmins/{email}
  role: 'super_admin'
  createdAt
```

### Collections Existentes — Alteracoes

```
clients/{clientId}
  + orgId: string (REQUIRED — tenant isolation)
  + ownerId: string (membro responsavel)
  + funnelId: string (qual funil)
  funnelStage → columnId (renomear para clareza)

funnelStages → DEPRECADA (migrada para organizations/{orgId}/funnels/{funnelId}/columns)

userRoles → DEPRECADA (migrada para organizations/{orgId}/members)

roleConfigs → DEPRECADA (migrada para permissoes inline em members)

callRoutingConfig → organizations/{orgId}/callRoutingConfig (singleton)
callScripts → organizations/{orgId}/callScripts/{scriptId}
callOutcomes → organizations/{orgId}/callOutcomes/{outcomeId}
```

---

## Epics e Stories

---

### EPIC 1: Fundacao Multi-Tenant

**Objetivo**: Criar a infraestrutura base de organizacoes e isolamento de dados.

#### Story 1.1: Criar collection organizations e modelo de dados
**Como** admin do sistema
**Quero** cadastrar empresas no Firestore
**Para** cada empresa ter seu espaco isolado de dados

**AC**:
- [ ] Collection `organizations` criada com schema validado
- [ ] Campos: name, slug (unico), plan, logoUrl, settings, limits, createdAt, updatedAt
- [ ] Tipo TypeScript `Organization` em `src/types/organization.ts`
- [ ] Helper `getOrgRef(orgId)` em `src/lib/organization.ts`
- [ ] Funcao `createOrganization(data)` com validacao

**Arquivos**: `src/types/organization.ts`, `src/lib/organization.ts`

---

#### Story 1.2: Criar sistema de membros (org members)
**Como** admin de uma empresa
**Quero** vincular usuarios a minha organizacao
**Para** controlar quem tem acesso ao CRM

**AC**:
- [ ] Subcollection `organizations/{orgId}/members` com schema
- [ ] Campos: userId, email, role (admin/manager/user), displayName, permissions, status
- [ ] Tipo TypeScript `OrgMember`
- [ ] CRUD helpers: `addMember()`, `updateMember()`, `removeMember()`, `getMembers()`
- [ ] Convite por email com status 'invited' → 'active' no primeiro login

**Arquivos**: `src/types/organization.ts`, `src/lib/orgMembers.ts`

---

#### Story 1.3: Resolver orgId do usuario autenticado
**Como** sistema
**Quero** determinar a organizacao do usuario logado
**Para** filtrar todos os dados pelo tenant correto

**AC**:
- [ ] Hook `useOrganization()` que retorna `{ orgId, org, member, loading }`
- [ ] No login, buscar qual org o email pertence
- [ ] Armazenar orgId no context (CrmUserContext expandido)
- [ ] Se usuario pertence a multiplas orgs, mostrar seletor
- [ ] API middleware helper `getOrgFromRequest(req)` para routes server-side

**Arquivos**: `src/contexts/CrmUserContext.tsx`, `src/lib/orgResolver.ts`, `src/hooks/useOrganization.ts`

---

#### Story 1.4: Adicionar orgId em clients e queries
**Como** sistema
**Quero** que toda query de clients seja filtrada por orgId
**Para** isolamento total de dados entre empresas

**AC**:
- [ ] Campo `orgId` adicionado a novos clients automaticamente
- [ ] Todas as queries `collection('clients')` recebem `.where('orgId', '==', orgId)`
- [ ] Pagina /contatos filtra por orgId
- [ ] Pagina /funil filtra por orgId
- [ ] API routes da extension filtram por orgId
- [ ] Nenhum usuario ve dados de outra organizacao

**Arquivos**: Todos os arquivos que fazem query em `clients` (~15 arquivos)

---

#### Story 1.5: Migrar dados existentes para org padrao
**Como** admin do sistema
**Quero** migrar os dados atuais para uma organizacao padrao
**Para** nao perder dados existentes na transicao

**AC**:
- [ ] Script de migracao: cria org "Labrego IA" com os dados atuais
- [ ] Todos os clients existentes recebem `orgId` da org padrao
- [ ] userRoles migrados para members da org padrao
- [ ] funnelStages migrados para funnel default da org padrao
- [ ] callRoutingConfig migrado para org padrao
- [ ] Script eh idempotente (pode rodar multiplas vezes)

**Arquivos**: `scripts/migrate-to-multitenant.ts`

---

### EPIC 2: Multiplos Funis

**Objetivo**: Permitir que cada empresa crie e gerencie multiplos funis de vendas.

#### Story 2.1: Criar modelo de funis por organizacao
**Como** admin de empresa
**Quero** criar multiplos funis de vendas
**Para** separar diferentes processos comerciais

**AC**:
- [ ] Subcollection `organizations/{orgId}/funnels/{funnelId}`
- [ ] Cada funil tem: name, description, color, isDefault, order
- [ ] Subcollection de colunas: `funnels/{funnelId}/columns/{columnId}`
- [ ] Coluna tem: name, order, color, probability, maxDays, conversionType
- [ ] CRUD completo para funis e colunas
- [ ] Tipo TypeScript `Funnel` e `FunnelColumn`
- [ ] Pelo menos 1 funil obrigatorio (default)

**Arquivos**: `src/types/funnel.ts`, `src/lib/funnels.ts`

---

#### Story 2.2: Seletor de funil no Kanban
**Como** usuario do CRM
**Quero** escolher qual funil visualizar no Kanban
**Para** ver cada processo comercial separadamente

**AC**:
- [ ] Dropdown/tabs no topo da pagina /funil para selecionar funil
- [ ] Kanban carrega apenas colunas do funil selecionado
- [ ] Cards mostram apenas clients do funil selecionado
- [ ] Drag & drop funciona dentro do funil selecionado
- [ ] Persistir ultimo funil selecionado no localStorage
- [ ] Funil default pre-selecionado

**Arquivos**: `src/app/funil/page.tsx`, `src/app/funil/components.tsx`

---

#### Story 2.3: Visibilidade de funis por usuario
**Como** admin de empresa
**Quero** definir quais usuarios veem quais funis
**Para** controlar acesso a processos comerciais sensiveis

**AC**:
- [ ] Campo `visibleTo: string[]` no funil (lista de memberIds)
- [ ] Se vazio, todos os membros veem
- [ ] Se preenchido, apenas membros listados
- [ ] UI no admin para configurar visibilidade
- [ ] Hook `useVisibleFunnels()` que filtra funis do usuario
- [ ] Seletor de funil mostra apenas funis visiveis

**Arquivos**: `src/lib/funnels.ts`, `src/hooks/useVisibleFunnels.ts`, `src/app/admin/funil/page.tsx`

---

#### Story 2.4: Mover client entre funis
**Como** usuario do CRM
**Quero** mover um contato de um funil para outro
**Para** transferir leads entre processos comerciais

**AC**:
- [ ] Botao "Mover para funil" no detalhe do contato
- [ ] Modal com seletor de funil destino + coluna destino
- [ ] Atualiza `funnelId` e `columnId` do client
- [ ] Log registrado na timeline do contato
- [ ] Funciona tambem no admin

**Arquivos**: `src/app/contatos/[id]/page.tsx`

---

#### Story 2.5: Admin de funis (CRUD completo)
**Como** admin de empresa
**Quero** criar, editar e excluir funis e colunas
**Para** customizar meus processos comerciais

**AC**:
- [ ] Pagina /admin/funil adaptada para multiplos funis
- [ ] Tabs/seletor para navegar entre funis
- [ ] Criar novo funil com wizard (nome, cor, colunas iniciais)
- [ ] Editar nome, cor, descricao de funil existente
- [ ] Adicionar/remover/reordenar colunas dentro de um funil
- [ ] Excluir funil (com confirmacao e opcao de mover clients)
- [ ] Definir funil padrao

**Arquivos**: `src/app/admin/funil/page.tsx`

---

### EPIC 3: Sistema de Permissoes

**Objetivo**: Controle granular de acesso por pagina e funcao para cada usuario.

#### Story 3.1: Definir modelo de permissoes
**Como** admin de empresa
**Quero** um modelo flexivel de permissoes
**Para** controlar exatamente o que cada usuario pode fazer

**AC**:
- [ ] Tipo `MemberPermissions`:
  ```
  pages: string[] (rotas permitidas)
  actions: {
    canCreateContacts: boolean
    canEditContacts: boolean
    canDeleteContacts: boolean
    canCreateProposals: boolean
    canExportData: boolean
    canManageFunnels: boolean
    canManageUsers: boolean
    canTriggerCalls: boolean
    canViewReports: boolean
    canManageSettings: boolean
  }
  viewScope: 'own' | 'team' | 'all'
  ```
- [ ] Roles pre-definidos com permissoes default:
  - admin: tudo liberado
  - manager: tudo exceto gerenciar usuarios
  - seller: contatos, funil, propostas (viewScope: own)
  - viewer: somente leitura
- [ ] Tipo TypeScript em `src/types/permissions.ts`

**Arquivos**: `src/types/permissions.ts`, `src/lib/permissions.ts`

---

#### Story 3.2: Hook usePermissions e gate de acesso
**Como** sistema
**Quero** verificar permissoes em tempo real
**Para** bloquear acesso a paginas/funcoes nao autorizadas

**AC**:
- [ ] Hook `usePermissions()` retorna permissoes do membro atual
- [ ] Helper `canAccess(page)` verifica se membro pode ver pagina
- [ ] Helper `canAction(action)` verifica se membro pode executar acao
- [ ] Componente `<PermissionGate action="canDeleteContacts">` que renderiza children condicionalmente
- [ ] Sidebar filtra itens por permissoes do usuario
- [ ] Middleware server-side verifica permissoes em API routes

**Arquivos**: `src/hooks/usePermissions.ts`, `src/components/PermissionGate.tsx`, `src/components/CrmSidebar.tsx`

---

#### Story 3.3: Tela de configuracao de permissoes
**Como** admin de empresa
**Quero** uma tela para definir permissoes de cada usuario
**Para** controlar acessos de forma visual

**AC**:
- [ ] Pagina /admin/permissoes (ou /admin/usuarios)
- [ ] Lista de membros da organizacao
- [ ] Ao clicar num membro, abrir painel de permissoes
- [ ] Checkboxes para cada pagina (toggle on/off)
- [ ] Checkboxes para cada acao (CRUD contacts, proposals, etc)
- [ ] Seletor de viewScope (own/team/all)
- [ ] Templates de role pre-definidos (admin/manager/seller/viewer)
- [ ] Salvar permissoes em tempo real

**Arquivos**: `src/app/admin/usuarios/page.tsx`

---

#### Story 3.4: Filtro de dados por viewScope
**Como** vendedor
**Quero** ver apenas meus contatos
**Para** focar no meu pipeline sem distracao

**AC**:
- [ ] viewScope 'own': query filtra por `ownerId == memberId`
- [ ] viewScope 'team': query filtra por `orgId` (todos da org)
- [ ] viewScope 'all': sem filtro adicional (super admin)
- [ ] /contatos respeita viewScope
- [ ] /funil respeita viewScope
- [ ] Metricas de produtividade respeitam viewScope
- [ ] Admin sempre ve tudo

**Arquivos**: `src/app/contatos/page.tsx`, `src/app/funil/page.tsx`

---

### EPIC 4: Sistema de Creditos

**Objetivo**: Controlar uso de ligacoes por creditos (minutos).

#### Story 4.1: Modelo de creditos por organizacao
**Como** admin do sistema
**Quero** que cada organizacao tenha um saldo de creditos
**Para** cobrar por uso de ligacoes

**AC**:
- [ ] Document `organizations/{orgId}/credits` com balance, totalPurchased, totalConsumed
- [ ] Subcollection `creditTransactions` com historico
- [ ] Tipos: purchase, consumption, adjustment, bonus
- [ ] Tipo TypeScript `CreditBalance` e `CreditTransaction`
- [ ] Helper `getCredits(orgId)`, `deductCredits(orgId, minutes)`, `addCredits(orgId, amount, type)`
- [ ] Transacao atomica (FieldValue.increment) para evitar race conditions

**Arquivos**: `src/types/credits.ts`, `src/lib/credits.ts`

---

#### Story 4.2: Verificar creditos antes de ligar
**Como** sistema
**Quero** bloquear ligacoes quando creditos acabam
**Para** evitar uso sem pagamento

**AC**:
- [ ] Antes de `makeVapiCall()`, verificar `credits.balance > 0`
- [ ] Se sem creditos, retornar erro amigavel
- [ ] UI no /ligacoes mostra saldo atual de creditos
- [ ] Barra de creditos: verde (>60min), amarelo (15-60min), vermelho (<15min)
- [ ] Toast quando creditos estao acabando (<15min)
- [ ] Bloquear botao de trigger batch quando sem creditos

**Arquivos**: `src/app/ligacoes/page.tsx`, `src/app/api/call-routing/trigger/route.ts`, `src/lib/callRouting.ts`

---

#### Story 4.3: Consumir creditos apos ligacao
**Como** sistema
**Quero** debitar creditos baseado na duracao da ligacao
**Para** cobrar proporcionalmente ao uso

**AC**:
- [ ] Webhook vapi recebe duracao da ligacao
- [ ] Calcular minutos (arredondar para cima)
- [ ] Debitar creditos: `deductCredits(orgId, ceilMinutes)`
- [ ] Registrar transacao com callId e detalhes
- [ ] Se ligacao < 30s, nao cobrar (chamada nao atendida)
- [ ] Se orgId nao encontrado, logar erro mas nao bloquear

**Arquivos**: `src/app/api/vapi/webhook/route.ts`, `src/lib/credits.ts`

---

#### Story 4.4: Tela de historico de creditos
**Como** admin de empresa
**Quero** ver o historico de consumo de creditos
**Para** controlar gastos e planejar recargas

**AC**:
- [ ] Pagina /admin/creditos
- [ ] Saldo atual em destaque
- [ ] Grafico de consumo ultimos 30 dias
- [ ] Tabela de transacoes (data, tipo, valor, descricao)
- [ ] Filtros por periodo e tipo
- [ ] Exportar historico em Excel

**Arquivos**: `src/app/admin/creditos/page.tsx`

---

### EPIC 5: Planos e Feature Gating

**Objetivo**: Implementar os 3 planos e restringir funcionalidades por plano.

#### Story 5.1: Criar collection de planos
**Como** super admin
**Quero** definir os planos disponiveis
**Para** controlar features por nivel de assinatura

**AC**:
- [ ] Collection `plans` com 3 documentos (basic, standard, pro)
- [ ] Cada plano tem: name, displayName, price, features[], limits
- [ ] Features como strings mapeadas: 'funnel', 'contacts', 'proposals', 'cadence', 'productivity', 'whatsapp_plugin', 'email_automation', 'crm_automation', 'voice_agent', 'whatsapp_agent', 'ai_reports'
- [ ] Limits: maxUsers, maxFunnels, maxContacts, monthlyCredits
- [ ] Tipo TypeScript `Plan`

**Arquivos**: `src/types/plan.ts`, `src/lib/plans.ts`, `scripts/seed-plans.ts`

---

#### Story 5.2: Feature gate no frontend
**Como** sistema
**Quero** esconder/bloquear funcionalidades do plano
**Para** incentivar upgrade

**AC**:
- [ ] Hook `usePlan()` retorna plano atual da org e features
- [ ] Helper `hasFeature(feature)` verifica se plano inclui feature
- [ ] Componente `<PlanGate feature="voice_agent">` renderiza children ou upsell
- [ ] Sidebar esconde itens nao incluidos no plano
- [ ] Paginas bloqueadas mostram tela de upsell com botao "Fazer upgrade"
- [ ] Badge "PRO" nos itens exclusivos do plano Pro

**Arquivos**: `src/hooks/usePlan.ts`, `src/components/PlanGate.tsx`, `src/components/UpgradePrompt.tsx`

---

#### Story 5.3: Feature gate no backend
**Como** sistema
**Quero** bloquear API calls de features nao incluidas
**Para** seguranca server-side

**AC**:
- [ ] Middleware `requireFeature(feature)` para API routes
- [ ] Verifica plano da org via orgId no request
- [ ] Retorna 403 com mensagem "Feature nao disponivel no plano atual"
- [ ] Aplicar em:
  - /api/call-routing/* → feature 'voice_agent'
  - /api/send-notification → feature 'email_automation'
  - /api/extension/* → feature 'whatsapp_plugin'
- [ ] Limites de contacts e funnels verificados no create

**Arquivos**: `src/lib/featureGate.ts`, API routes relevantes

---

#### Story 5.4: Tela de upgrade de plano
**Como** admin de empresa
**Quero** ver meu plano atual e opcoes de upgrade
**Para** desbloquear mais funcionalidades

**AC**:
- [ ] Pagina /admin/plano
- [ ] Card do plano atual com features ativas
- [ ] Comparativo dos 3 planos lado a lado
- [ ] Checkmarks verde/cinza para cada feature
- [ ] Botao "Fazer upgrade" (por enquanto envia para WhatsApp do suporte)
- [ ] Indicador de uso (contatos, funis, usuarios) vs limites do plano

**Arquivos**: `src/app/admin/plano/page.tsx`

---

### EPIC 6: Painel Super Admin (Global)

**Objetivo**: Tela para gerenciar todas as organizacoes, usuarios, creditos e planos.

#### Story 6.1: Autenticacao de super admin
**Como** super admin
**Quero** acessar um painel global separado
**Para** gerenciar todo o SaaS

**AC**:
- [ ] Collection `superAdmins` com emails autorizados
- [ ] Rota /super-admin/* protegida por middleware
- [ ] Verificacao: email do usuario esta em `superAdmins`
- [ ] Layout proprio para super admin (diferente do CRM)
- [ ] Redirect para /super-admin/organizacoes apos login

**Arquivos**: `src/app/super-admin/layout.tsx`, `src/lib/superAdmin.ts`, `middleware.ts`

---

#### Story 6.2: Gerenciar organizacoes
**Como** super admin
**Quero** listar, criar, editar e suspender organizacoes
**Para** controlar o SaaS

**AC**:
- [ ] Pagina /super-admin/organizacoes
- [ ] Tabela com: nome, slug, plano, membros, creditos, status, criacao
- [ ] Criar nova organizacao com wizard
- [ ] Editar plano, limites, status
- [ ] Suspender/reativar organizacao
- [ ] Ver detalhes (membros, uso, creditos)

**Arquivos**: `src/app/super-admin/organizacoes/page.tsx`

---

#### Story 6.3: Gerenciar creditos globalmente
**Como** super admin
**Quero** adicionar/remover creditos de qualquer organizacao
**Para** controlar o faturamento

**AC**:
- [ ] Pagina /super-admin/creditos
- [ ] Seletor de organizacao
- [ ] Formulario: adicionar X minutos (tipo: purchase/bonus/adjustment)
- [ ] Historico de transacoes filtrado por org
- [ ] Dashboard com total de creditos no sistema, consumo medio, orgs sem credito
- [ ] Alerta para orgs com credito < 15min

**Arquivos**: `src/app/super-admin/creditos/page.tsx`

---

#### Story 6.4: Gerenciar planos e limites
**Como** super admin
**Quero** editar os planos disponiveis
**Para** ajustar precos e features

**AC**:
- [ ] Pagina /super-admin/planos
- [ ] Editar cada plano: nome, preco, features, limites
- [ ] Preview de como ficara a tela de upgrade
- [ ] Alterar plano de uma org especifica
- [ ] Historico de mudancas de plano

**Arquivos**: `src/app/super-admin/planos/page.tsx`

---

#### Story 6.5: Dashboard global do SaaS
**Como** super admin
**Quero** um dashboard com metricas do SaaS
**Para** acompanhar a saude do negocio

**AC**:
- [ ] Pagina /super-admin (dashboard)
- [ ] KPIs: total orgs, total usuarios, total contatos, creditos consumidos
- [ ] Grafico: novos orgs por mes
- [ ] Grafico: consumo de creditos por mes
- [ ] Grafico: distribuicao por plano (pie chart)
- [ ] Lista: orgs mais ativas (por contatos criados)
- [ ] Lista: orgs com credito baixo

**Arquivos**: `src/app/super-admin/page.tsx`

---

### EPIC 7: Migracao e Adaptacao

**Objetivo**: Migrar o sistema existente e adaptar todas as telas.

#### Story 7.1: Adaptar layout para contexto de org
**Como** usuario
**Quero** ver o nome/logo da minha empresa no CRM
**Para** ter uma experiencia personalizada

**AC**:
- [ ] Header mostra nome da organizacao
- [ ] Logo da org no sidebar (se configurado)
- [ ] Favicon dinamico (futuro)
- [ ] Titulo da pagina inclui nome da org

**Arquivos**: `src/app/layout.tsx`, `src/components/CrmSidebar.tsx`

---

#### Story 7.2: Adaptar /contatos para multi-tenant
**Como** usuario
**Quero** ver apenas contatos da minha organizacao
**Para** isolamento de dados

**AC**:
- [ ] Query filtrada por orgId
- [ ] Novos contatos criados com orgId e ownerId
- [ ] Campo "Responsavel" visivel na tabela
- [ ] Filtro por responsavel
- [ ] viewScope aplicado (own/team/all)

**Arquivos**: `src/app/contatos/page.tsx`

---

#### Story 7.3: Adaptar /funil para multi-funnel + multi-tenant
**Como** usuario
**Quero** ver o Kanban filtrado por funil e organizacao
**Para** foco no processo correto

**AC**:
- [ ] Seletor de funil no topo
- [ ] Colunas carregadas do funil selecionado
- [ ] Cards filtrados por orgId + funnelId
- [ ] Drag & drop dentro do funil
- [ ] Metricas por funil (contagem, valor, tempo medio)

**Arquivos**: `src/app/funil/page.tsx`, `src/app/funil/components.tsx`

---

#### Story 7.4: Adaptar API routes para multi-tenant
**Como** sistema
**Quero** todas as APIs protegidas por orgId
**Para** seguranca de dados

**AC**:
- [ ] Helper `getOrgFromRequest(req)` usado em todas as routes
- [ ] Extension routes recebem orgId do token
- [ ] N8N routes recebem orgId como parametro
- [ ] Vapi webhook resolve orgId pelo clientId
- [ ] Nenhuma API retorna dados de outra org

**Arquivos**: Todos os 24 API routes

---

#### Story 7.5: Adaptar Chrome Extension para multi-tenant
**Como** usuario da extension
**Quero** que meus dados vao para a org correta
**Para** nao misturar dados entre empresas

**AC**:
- [ ] Login da extension retorna orgId
- [ ] Todas as chamadas de API incluem orgId
- [ ] Sidebar da extension mostra nome da org
- [ ] Busca de contato filtrada por org

**Arquivos**: `chrome-extension/background/background.js`, `chrome-extension/content/content.js`

---

#### Story 7.6: Script de seed para ambiente de demonstracao
**Como** desenvolvedor
**Quero** popular o banco com dados de exemplo
**Para** testar e demonstrar o SaaS

**AC**:
- [ ] Script cria 2 organizacoes de exemplo
- [ ] Org 1: plano Pro, 3 usuarios, 2 funis, 50 contatos, 100 creditos
- [ ] Org 2: plano Basic, 1 usuario, 1 funil, 10 contatos, 0 creditos
- [ ] Planos basic, standard, pro criados
- [ ] Super admin criado

**Arquivos**: `scripts/seed-demo.ts`

---

## Ordem de Execucao Recomendada

```
EPIC 1 (Fundacao)          ██████████ Semana 1-2
  1.1 Organizations
  1.2 Members
  1.3 Org Resolver
  1.4 orgId em clients
  1.5 Migracao

EPIC 5 (Planos)            ████████ Semana 2-3
  5.1 Collection planos
  5.2 Feature gate frontend
  5.3 Feature gate backend
  5.4 Tela upgrade

EPIC 3 (Permissoes)        ████████ Semana 3-4
  3.1 Modelo permissoes
  3.2 Hook + gate
  3.3 Tela configuracao
  3.4 viewScope

EPIC 2 (Multi-Funis)       ████████ Semana 4-5
  2.1 Modelo funis
  2.2 Seletor Kanban
  2.3 Visibilidade
  2.4 Mover entre funis
  2.5 Admin CRUD

EPIC 4 (Creditos)          ██████ Semana 5-6
  4.1 Modelo creditos
  4.2 Verificar antes
  4.3 Consumir apos
  4.4 Historico

EPIC 6 (Super Admin)       ████████ Semana 6-7
  6.1 Auth super admin
  6.2 Gerenciar orgs
  6.3 Gerenciar creditos
  6.4 Gerenciar planos
  6.5 Dashboard

EPIC 7 (Adaptacao)         ██████████ Semana 7-9
  7.1-7.6 (paralelo com epics anteriores)
```

---

## Dependencias entre Stories

```
1.1 → 1.2 → 1.3 → 1.4 → 1.5
1.1 → 2.1 → 2.2 → 2.3
1.2 → 3.1 → 3.2 → 3.3 → 3.4
1.1 → 4.1 → 4.2 → 4.3 → 4.4
5.1 → 5.2 → 5.3
1.1 → 6.1 → 6.2
4.1 → 6.3
5.1 → 6.4
1.3 → 7.1 → 7.2 → 7.3
1.4 → 7.4 → 7.5
```

---

## Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Queries sem orgId vazam dados | CRITICO | Code review obrigatorio, testes automatizados |
| Performance com filtro orgId | ALTO | Indexes compostos no Firestore |
| Migracao quebra dados existentes | ALTO | Script idempotente, backup antes |
| Limites do Firestore (subcollections) | MEDIO | Monitorar quotas, planejar sharding |
| Extension nao atualizada | MEDIO | Versionar e forcar update |
| Creditos negativos (race condition) | MEDIO | FieldValue.increment atomico |

---

## Metricas de Sucesso

- [ ] Zero vazamento de dados entre organizacoes (teste automatizado)
- [ ] Tempo de resposta < 2s para queries com orgId
- [ ] 100% das API routes protegidas por orgId
- [ ] Feature gate bloqueia 100% das funcoes por plano
- [ ] Creditos debitados corretamente em 100% das ligacoes
- [ ] Super admin consegue gerenciar tudo sem acesso ao Firebase Console
