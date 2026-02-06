# 🚀 Plan de Transformación a SaaS Multi-Tenant

**Proyecto:** Blockchain Explorer → Token Analytics SaaS
**Fecha de Creación:** 2025-02-02
**Última Actualización:** 2025-02-05
**Estado:** ✅ Fase 4 COMPLETADA (Admin Panel 4.1-4.8) | 🔜 Sprint 4.9 (Logos + Admin Tokens)
**Objetivo:** Convertir el explorer hardcoded de VTN en un SaaS donde cada cliente puede analizar su propio token ERC20

---

## 📊 Estado del Proyecto

**Progreso:**
- ✅ **Fase 1 (Auth + Multi-Tenant):** COMPLETADA
  - Sprint 1.1: NextAuth Setup
  - Sprint 1.2: Tenant Context & API Isolation
  - Sprint 1.3: Organization Settings
- ✅ **Fase 2 (Tokens + Config):** COMPLETADA
  - Sprint 2.1: Token Management + Custom API Keys
  - Sprint 2.2: Custom ABIs + Contracts (modelo genérico)
  - Sprint 2.3: Token Supply Custom Configuration
  - Sprint 2.4: APIs Multi-Tenant Completas
  - Sprint 2.5: Invitación de Miembros ✅
- ⏸️ **Fase 3:** Onboarding (POSTPONED)
- ✅ **Fase 4 (Admin Panel SaaS):** COMPLETADA 🎉
  - Sprint 4.1: Base de Datos (Plan, SystemSettings, Subscription) ✅
  - Sprint 4.2: APIs de Admin ✅
  - Sprint 4.3: UI Panel Admin completo ✅
  - Sprint 4.4: Navbar + Protección ✅
  - Sprint 4.5: Validación de Límites ✅
  - Sprint 4.6: Fixes y Mejoras ✅
  - Sprint 4.7: Mejoras UX (alertas, custom APIs) ✅
  - Sprint 4.8: Gestión de Usuarios ✅
  - Sprint 4.9: Logos + Admin Tokens Panel 🔜
- ⏸️ **Fase 3:** Onboarding (POSTPONED)
- 🔜 **Fase 5:** Integración REAL con Stripe

---

## 🎯 Sprints Completados (Resumen)

### ✅ Sprint 1.1: NextAuth Setup
- NextAuth.js configurado con JWT
- Providers: Credentials (email/password) + Google OAuth
- Roles: SUPER_ADMIN, ADMIN, MEMBER, VIEWER
- Páginas: `/auth/signin`, `/auth/signup`, `/auth/error`
- Middleware para rutas protegidas

### ✅ Sprint 1.2: Tenant Context & API Isolation
- Helper `getTenantContext()` en `src/lib/tenant-context.ts`
- Aislamiento de datos por organización
- APIs actualizadas: token-analytics, addresses, transfers-cache, vesting-info

### ✅ Sprint 1.3: Organization Settings
- Página `/settings/organization`
- Visualización de miembros del equipo
- API de organizaciones

### ✅ Sprint 2.1: Token Management + Custom API Keys
- CRUD completo de tokens
- Verificación on-chain de ERC20
- Custom API keys por token (BaseScan, Etherscan, Moralis, QuikNode)
- Settings: whale threshold, cache duration, max transfers

### ✅ Sprint 2.2: Custom ABIs + Contracts
- Modelo `CustomAbi` multi-contrato/multi-red
- Modelo `Contract` genérico con enum `ContractCategory`
- 11 ABIs migrados a BD
- APIs: `/api/tokens/[id]/abi`, `/api/tokens/[id]/abis`

### ✅ Sprint 2.3: Token Supply Custom Configuration
- Configuración de supply method (API vs ONCHAIN)
- Custom URLs para API de supply
- Cálculo on-chain con ethers.js
- UI en settings page

### ✅ Sprint 2.4: APIs Multi-Tenant Completas
- `/api/tokens/transfers` - Tenant context + validación
- `/api/search` - Filtrado por tokenId
- `/api/test-vtn` - Deprecated con warnings

### ✅ Sprint 2.5: Invitación de Miembros + UI Refactor
- Modelo `Invitation` en Prisma con todos los campos necesarios
- API POST `/api/organizations/invite` - Crear invitaciones con token único
- API GET `/api/organizations/invitations` - Listar invitaciones pendientes
- API DELETE `/api/organizations/invitations/[id]` - Cancelar invitaciones
- API POST `/api/invitations/[token]/accept` - Aceptar invitaciones
- Servicio de email con Resend (HTML template incluido)
- **UI Reorganización Completa:**
  - Nuevo layout con sidebar para `/settings`
  - `/settings/general` - Información de organización
  - `/settings/members` - Miembros + Sistema de invitaciones
  - `/settings/tokens` - Gestión de tokens
  - Navbar actualizado con nuevos links
- Página `/invite/[token]` para aceptar invitaciones
- Flujo completo: crear cuenta automáticamente o agregar a organización existente

---

## ✅ Fase 4: Admin Panel SaaS (COMPLETADA - 2025-02-05)

**Objetivo:** Panel de administración completo para SUPER_ADMIN con gestión de planes, organizaciones, usuarios y configuración global del SaaS.

**Referencia completa:** Ver [ADMIN_PLAN.md](ADMIN_PLAN.md) para detalles exhaustivos

### ✅ Sprint 4.1: Base de Datos
**Modelos creados:**
- `Plan` - Planes configurables (Free, Pro, Enterprise)
  - Campos: name, slug, price, currency, stripePriceId
  - Límites: tokensLimit, apiCallsLimit, transfersLimit, membersLimit (-1 = ilimitado)
  - Features: JSON array, isActive, isPublic, sortOrder
- `SystemSettings` - Configuración global (singleton)
  - API Keys: defaultBasescanApiKey, defaultEtherscanApiKey, defaultMoralisApiKey, defaultQuiknodeUrl
  - Email: resendApiKey, resendFromEmail
  - Stripe: stripePublicKey, stripeSecretKey
  - General: appName, appUrl, supportEmail
- `Subscription` - Actualizado con planId, transfersLimit, membersLimit

**Seed data:**
- Usuario SUPER_ADMIN: superadmin@tokenlens.com / super123
- 3 planes: Free ($0), Pro ($29), Enterprise ($99)

### ✅ Sprint 4.2: APIs de Admin
**APIs creadas en `/api/admin/*`:**
- `GET/POST /api/admin/plans` - CRUD de planes
- `GET/PUT/DELETE /api/admin/plans/[id]` - Plan individual
- `POST /api/admin/plans/reorder` - Drag & drop order
- `GET /api/admin/organizations` - Lista con stats
- `GET/PATCH /api/admin/organizations/[id]` - Detalle + asignar plan
- `GET/PUT /api/admin/settings` - Config global
- `GET /api/admin/stats` - Datos para gráficos
- `GET /api/admin/users` - Lista global de usuarios
- `POST /api/admin/stripe/webhook` - Stub para futuro

**Seguridad:**
- Helper `requireSuperAdmin()` en todas las APIs
- Validación de rol SUPER_ADMIN obligatoria

### ✅ Sprint 4.3: UI Panel Admin
**Páginas creadas en `/admin/*`:**
- `/admin/dashboard` - 4 cards métricas + 3 gráficos (Recharts)
  - MRR, distribución de planes, stats globales
  - Gráficos: nuevas orgs, cancelaciones, MRR evolution
  - Alertas proactivas (orgs cerca de límites ≥80%)
- `/admin/organizations` - Lista con filtros y búsqueda
  - Indicador "🔑 Custom APIs" visible en tabla
  - Filtros: nombre, plan, estado
- `/admin/organizations/[id]` - Detalle completo
  - Info general, cambiar plan
  - Progress bars (uso vs límites)
  - Lista miembros, tokens, métricas
  - Indicador custom API keys con detalles
- `/admin/plans` - Grid con drag & drop (@dnd-kit)
  - Formulario inline crear/editar
  - Delete con validación
- `/admin/settings` - 4 tabs
  - API Keys, Email, Stripe, General
- `/admin/users` - Lista global
  - Stats por rol, filtros, búsqueda
  - Tooltips con organizaciones

**Componentes:**
- Layout con sidebar persistente
- Consistent styling con dark mode

### ✅ Sprint 4.4: Navbar + Protección
- Link "Admin" en navbar (solo visible para SUPER_ADMIN)
- Middleware protege `/admin/*` (solo SUPER_ADMIN)
- Redirect automático post-login según rol
- SignInForm detecta rol y redirige correctamente

### ✅ Sprint 4.5: Validación de Límites
**Helper creado:** `src/lib/limits.ts`
- `checkTokensLimit()` - Verifica límite de tokens
- `checkMembersLimit()` - Verifica límite de miembros
- `incrementApiCalls()` - Contador API calls
- `canPerformAction()` - Validación genérica

**Integración:**
- `/api/tokens` - Bloquea si alcanza límite de tokens
- `/api/organizations/invite` - Bloquea si alcanza límite de miembros
- `/api/token-analytics` - Contador API calls (soft limit)
- Mensajes claros para upgrades

### ✅ Sprint 4.6: Fixes y Mejoras
- Login redirect fix para SUPER_ADMIN
- Next.js 15 async params actualizado
- Custom API keys indicator en org detail
- Organization detail completo (progress bars, listas)

### ✅ Sprint 4.7: Mejoras UX
- Indicador custom APIs en lista de organizaciones (columna "APIs")
- Alertas en dashboard (orgs cerca de límites ≥80%)
- Color coding por severidad (amarillo 80-89%, rojo 90%+)
- Detección automática de custom keys (BaseScan, Etherscan, Moralis, QuikNode)

### ✅ Sprint 4.8: Gestión de Usuarios
- Página `/admin/users` con lista global
- Stats cards (total, por rol)
- Filtros por rol y búsqueda
- Tooltips con nombres de organizaciones
- Count de orgs (miembro vs owner)

**Scripts de migración:**
```bash
npx tsx prisma/migrate-admin-setup.ts  # Setup inicial admin
npx tsx prisma/seed-superadmin.ts      # Crear superadmin
```

---

## ⏳ Sprints Pendientes

---

### Sprint 4.9: Logos + Admin Tokens Panel (4-5h)

**Status:** 🔜 Siguiente (después de Sprint 4.8)
**Prioridad:** 🟡 Media-Alta (profesionalidad + visibilidad)

**Objetivo:** Añadir sistema de logos para organizaciones y tokens, más panel de gestión global de tokens para SUPER_ADMIN.

**Parte 1: Sistema de Logos (2.5h)**

**Campos nuevos en Schema:**
- `Organization.logoUrl` - URL del logo de la organización
- `Token.logoUrl` - URL del logo del token

**Storage: Cloudinary (free tier)**
- 25 GB storage, 25 GB bandwidth/mes, 25k transformations/mes
- CDN global incluido
- Optimización automática de imágenes
- Sin tarjeta de crédito requerida para empezar

**Tareas:**
1. Setup Cloudinary (30min)
   - Crear cuenta gratuita en cloudinary.com
   - Obtener API keys (cloud_name, api_key, api_secret)
   - Instalar: `npm install cloudinary`
   - Helper `src/lib/cloudinary.ts` para uploads

2. Schema update (15min)
   - Añadir `logoUrl String?` a Organization y Token
   - Migración: `npx prisma db push`

3. UI de upload (1.5h)
   - Componente reutilizable `<LogoUpload>` con preview
   - Input file + upload a Cloudinary
   - Preview con fallback a iniciales (ej: "VT" para Vottun)
   - Botón "Remove logo"
   - Integrar en:
     - `/settings/general` (org logo)
     - `/settings/tokens/[id]/general` (token logo)

4. Mostrar logos (30min)
   - Navbar: logo de org actual
   - `/admin/organizations` tabla: columna con logo
   - `/settings/tokens` lista: logo de cada token
   - `/admin/tokens` nueva página (ver Parte 2)
   - Componente `<Avatar>` con fallback a iniciales

**Parte 2: Panel Admin de Tokens (2h)**

**Nueva página:** `/admin/tokens`

**Stats Cards:**
- Total tokens en el sistema
- Tokens por red (Base: X, Testnet: Y, Sepolia: Z)
- Tokens activos (con transfers en últimos 30 días)
- Top token por API calls

**Tabla principal:**
```
Logo | Symbol | Address | Network | Organization | Contracts | Transfers | API Calls | Created
🪙   | VTN    | 0xA9b...| Base    | Vottun       | 8         | 15.2k     | 1.2M      | Jan 15
🔵   | USDC   | 0x123...| Base    | Acme Corp    | 2         | 8.5k      | 450k      | Feb 01
```

**Filtros y búsqueda:**
- 🔍 Búsqueda por symbol o address (debounced)
- 🏢 Filtro por organización (dropdown con todas las orgs)
- 🌐 Filtro por red (Base, Testnet, Sepolia)
- 📊 Ordenar por: Created, Transfers, API Calls, Symbol

**Click en fila:**
- Redirect a `/admin/organizations/[orgId]` con scroll automático a sección de tokens
- O modal con stats detalladas del token

**API necesaria:**
```typescript
GET /api/admin/tokens
// Query params: search?, organizationId?, network?, sortBy?, order?
// Response: {
//   stats: {
//     total: number,
//     byNetwork: { base: number, testnet: number, sepolia: number },
//     active: number,
//     topByApiCalls: { symbol: string, calls: number }
//   },
//   tokens: [{
//     id, symbol, address, network, logoUrl,
//     organization: { id, name, logoUrl },
//     _count: { contracts, transferCache },
//     stats: { totalTransfers, apiCalls },
//     createdAt
//   }]
// }
```

**Integración:**
- Añadir link "Tokens" en sidebar de admin (después de Users)
- Icono: 🪙 o similar

**Scripts de migración:**
```bash
npx prisma db push                    # Aplicar logoUrl a Organization y Token
```

---

### Sprint 4.10: Direcciones Conocidas Globales (SUPER_ADMIN) (3-4h)

**Status:** 🔜 Pendiente
**Prioridad:** 🟡 Media-Alta (evita que cada org tenga que registrar los mismos exchanges)

**Problema actual:**
- `KnownAddress` va por `tokenId` - cada token tiene su propio set
- Los 4 exchanges por defecto (Coinbase x3, Gate.io) estan hardcodeados en `route.ts` pero NO estan en BD
- Si un SUPER_ADMIN quiere que todos los tokens tengan "Coinbase" como conocida, tiene que entrarla manualmente en cada token

**Objetivo:**
Desde el panel de SUPER_ADMIN, poder gestionar direcciones conocidas **globales** (sin `tokenId`) que se apliquen a todos los tokens del sistema.

**Propuesta de implementacion:**

1. **Schema:** `KnownAddress.tokenId` ya es nullable (`String?`), asi que las globales tendrian `tokenId = null`

2. **Nueva pagina:** `/admin/addresses`
   - CRUD de direcciones globales (tokenId = null)
   - Tabla: Address | Nombre | Tipo | Tags | Acciones
   - Boton "Añadir Exchange Global"
   - Importar las 4 hardcodeadas como seed inicial

3. **API:** `GET/POST /api/admin/addresses`
   - Solo SUPER_ADMIN
   - POST crea con `tokenId: null` (global)
   - GET lista todas las globales

4. **Merge en analytics:** `buildExchangeSet()` ya combina 3 fuentes, añadir 4ta:
   - DEFAULT_EXCHANGES (hardcoded, eventualmente eliminar)
   - TokenSettings.customExchangeAddresses
   - KnownAddress con type EXCHANGE y tokenId = [tokenId actual]
   - **NUEVO:** KnownAddress con type EXCHANGE y tokenId = null (globales)

5. **Merge de nombres:** `addressNames` debe incluir globales con menor prioridad:
   ```
   Prioridad: KnownAddress per-token > KnownAddress global > DEFAULT_EXCHANGE_LABELS
   ```

6. **Eliminar hardcoded:** Una vez migradas las 4 a BD como globales, eliminar `DEFAULT_EXCHANGES` y `DEFAULT_EXCHANGE_LABELS`

**Sin migracion DB:** `tokenId` ya es nullable, no requiere cambios en schema.

---

### Sprint 3.1: Wizard de Onboarding (5-6h)

**Status:** ⏸️ Postponed
**Prioridad:** 🔴 Alta (UX crítico)

**Objetivos:**
- Wizard de 5 pasos para nuevos usuarios
- Crear organización y primer token automáticamente
- Redirección automática si no tiene org/tokens

**Pasos del Wizard:**
1. **Bienvenida** - Explicación del producto
2. **Crear Organización** - Nombre + slug
3. **Agregar Token** - Address + network (verificación on-chain)
4. **Configurar Settings** - Opcional (whale threshold, API keys)
5. **Listo** - Redirect a dashboard

**Archivos a crear:**
- `/onboarding/page.tsx` - Main wizard container
- `/onboarding/steps/welcome.tsx`
- `/onboarding/steps/organization.tsx`
- `/onboarding/steps/token.tsx`
- `/onboarding/steps/settings.tsx`
- `/onboarding/steps/complete.tsx`

---

### Sprint 5.1: Integración REAL con Stripe (6-8h)

**Status:** 🔜 Siguiente (después de admin panel)
**Prioridad:** 🔴 Alta (monetización real)

**Nota:** La estructura de planes ya está creada en BD (Sprint 4.1), ahora falta la integración REAL con Stripe API.

**Objetivos:**
- Conectar con Stripe API real
- Checkout flow completo con Stripe
- Webhooks automáticos para sincronizar subscripciones
- Portal de billing para clientes (Stripe Customer Portal)
- Sincronización automática de cambios de plan

**Lo que ya está hecho:**
- ✅ Modelo `Plan` en BD con límites configurables
- ✅ Modelo `Subscription` actualizado con planId
- ✅ SystemSettings con stripePublicKey y stripeSecretKey
- ✅ UI de admin para gestionar planes
- ✅ Validación de límites implementada

**Lo que falta:**
1. Crear productos y precios en Stripe Dashboard
2. Sincronizar stripePriceId de BD con Stripe
3. API checkout: `POST /api/stripe/create-checkout-session`
4. Webhook handler completo: `POST /api/stripe/webhook`
   - `checkout.session.completed` - Crear subscription en BD
   - `customer.subscription.updated` - Actualizar plan
   - `customer.subscription.deleted` - Cancelar subscription
5. API para customer portal: `POST /api/stripe/create-portal-session`
6. UI página `/billing` para clientes
   - Ver plan actual
   - Botón "Upgrade" → checkout
   - Botón "Manage Billing" → portal
7. Stripe webhook secret en `.env` (`STRIPE_WEBHOOK_SECRET`)

**Planes actuales en BD (ya configurados):**
- Free: $0/mes - 1 token, 10k API calls, 1k transfers, 1 member
- Pro: $29/mes - 5 tokens, 100k API calls, 50k transfers, 5 members
- Enterprise: $99/mes - ilimitado todo

---

## 🏗️ Arquitectura Multi-Tenant

### Jerarquía de Datos
```
Organization (tenant)
  ├── Users (members)
  └── Tokens
      ├── Settings (API keys, thresholds)
      ├── Contracts (vesting, staking, etc.)
      ├── CustomAbis
      ├── KnownAddresses
      ├── TransferCache
      ├── HolderSnapshot
      └── Analytics data
```

### Isolamiento de Datos
- Todas las queries filtran por `organizationId` o `tokenId`
- Helper `getTenantContext()` valida acceso
- Middleware protege rutas sensibles

---

## 📚 Stack Tecnológico

**Core:**
- Next.js 14 (App Router)
- TypeScript 5.2
- PostgreSQL + Prisma 6
- NextAuth.js (JWT sessions)

**Blockchain:**
- ethers.js 6
- BaseScan API, Moralis API, QuikNode RPC

**UI:**
- Tailwind CSS
- Recharts (visualizations)

**Futuro:**
- Stripe (billing)
- Resend (emails)
- Vercel (hosting)

---

## 📈 Métricas de Éxito

**Fase 1-2 (Completada):**
- ✅ Multi-tenant funcionando
- ✅ Auth + roles implementados
- ✅ Tokens configurables
- ✅ APIs aisladas por tenant
- ✅ Invitación de miembros con email

**Fase 3 (Onboarding - Postponed):**
- Tiempo de setup < 5 minutos
- 80%+ usuarios completen onboarding

**Fase 4 (Admin Panel - 95% Completada):**
- ✅ Panel SUPER_ADMIN funcional (Sprints 4.1-4.8)
- ✅ Gestión de planes configurables
- ✅ Validación de límites en tiempo real
- ✅ Dashboard con métricas globales (MRR, stats)
- ✅ Gestión completa de organizaciones y usuarios
- ✅ Alertas proactivas para upgrades
- 🔜 Sistema de logos + Panel de tokens (Sprint 4.9)

**Fase 5 (Stripe Real - Pendiente):**
- Integración completa con Stripe API
- Checkout flow funcionando
- Webhooks sincronizando automáticamente
- Portal de billing para clientes
- Conversión Free → Pro: 10%+
- Churn < 5%/mes

---

## 🔗 Referencias

- [NextAuth.js Docs](https://next-auth.js.org)
- [Prisma Multi-Tenant Guide](https://www.prisma.io/docs/guides/multi-tenant)
- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions)

---

**Última actualización:** 2025-02-05
**Versión:** 3.1 (Fase 4: Sprints 4.1-4.8 ✅ | Sprint 4.9 propuesto 🔜 | Siguiente: Logos + Admin Tokens → Onboarding → Stripe Real)
