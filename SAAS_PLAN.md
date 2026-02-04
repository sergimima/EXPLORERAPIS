# 🚀 Plan de Transformación a SaaS Multi-Tenant

**Proyecto:** Blockchain Explorer → Token Analytics SaaS
**Fecha de Creación:** 2025-02-02
**Última Actualización:** 2025-02-04
**Estado:** ✅ Fase 2 COMPLETADA (Sprints 2.1-2.5) | Siguiente: Fase 4 (Stripe)
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
- 🔜 **Fase 4:** Integración con Stripe (SIGUIENTE)

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

## ⏳ Sprints Pendientes

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

### Sprint 4.1: Integración con Stripe (6-8h)

**Status:** 🔜 Siguiente después de 2.5
**Prioridad:** 🔴 Alta (monetización)

**Objetivos:**
- Planes: Free, Pro, Enterprise
- Checkout con Stripe
- Webhooks para actualizar subscriptions
- Portal de billing

**Planes Propuestos:**
```typescript
Free:
- 1 token
- 10k transfers/mes
- Analytics básico
- 1 usuario

Pro ($29/mes):
- 5 tokens
- 100k transfers/mes
- Analytics avanzado
- Webhooks
- 5 usuarios

Enterprise ($99/mes):
- Tokens ilimitados
- Transfers ilimitados
- White-label
- Priority support
- Usuarios ilimitados
```

**Tareas:**
1. Crear cuenta en Stripe
2. Configurar productos y precios
3. Modelo `Subscription` en Prisma
4. APIs de checkout y webhooks
5. Middleware para verificar límites
6. UI de planes y billing portal

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

**Fase 3 (Onboarding):**
- Tiempo de setup < 5 minutos
- 80%+ usuarios completan onboarding

**Fase 4 (Billing):**
- Conversión Free → Pro: 10%+
- Churn < 5%/mes

---

## 🔗 Referencias

- [NextAuth.js Docs](https://next-auth.js.org)
- [Prisma Multi-Tenant Guide](https://www.prisma.io/docs/guides/multi-tenant)
- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions)

---

**Última actualización:** 2025-02-04
**Versión:** 2.1 (Fase 2 completa - Sprints 1.1-2.5 ✅ + UI Refactor | Siguiente: Fase 4 Stripe)
