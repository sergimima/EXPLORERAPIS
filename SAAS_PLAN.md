# 🚀 Plan de Transformación a SaaS Multi-Tenant

**Proyecto:** Blockchain Explorer → Token Analytics SaaS
**Fecha de Creación:** 2025-02-02
**Última Actualización:** 2025-02-04
**Estado:** 🔄 En Desarrollo - Fase 2 en progreso | Sprint 2.2 ✅ | Siguiente: Sprint 2.3
**Objetivo:** Convertir el explorer hardcoded de VTN en un SaaS donde cada cliente puede analizar su propio token ERC20

**Progreso:**
- ✅ Sprint 1.1: Setup de NextAuth (COMPLETADO - 2025-02-03)
- ✅ Sprint 1.2: Aislamiento Multi-Tenant (COMPLETADO - 2025-02-03)
- ✅ Sprint 1.3: Settings de Organización (COMPLETADO - 2025-02-03)
- ✅ Sprint 2.1: Configuración de Tokens (COMPLETADO - 2025-02-03)
- ✅ Sprint 2.2: Custom ABIs + Vesting Contracts (COMPLETADO - 2025-02-04)
- ⏳ Sprint 2.3: Token Supply Cache Migration (EN PROGRESO - 2-3 horas)
- ⏳ Sprint 2.4: APIs Multi-Tenant Completas (PENDIENTE - 2-3 horas)
- ⏳ Sprint 2.5: Invitación de Miembros (PENDIENTE - 3-4 horas)
- ⏸️ Fase 3: Onboarding (POSTPONED)
- 🔜 Sprint 4.1: Integración con Stripe (SIGUIENTE)

---

## 📋 Tabla de Contenidos

1. [Análisis del Estado Actual](#análisis-del-estado-actual)
2. [Arquitectura SaaS Target](#arquitectura-saas-target)
3. [Fases de Implementación](#fases-de-implementación)
4. [Fase 1: Sistema de Autenticación y Multi-Tenant](#fase-1-sistema-de-autenticación-y-multi-tenant)
5. [Fase 2: Configuración de Tokens y APIs](#fase-2-configuración-de-tokens-y-apis)
6. [Fase 3: Onboarding y UX](#fase-3-onboarding-y-ux)
7. [Fase 4: Billing y Suscripciones](#fase-4-billing-y-suscripciones)
8. [Fase 5: Features Premium y Escalabilidad](#fase-5-features-premium-y-escalabilidad)
9. [Estimaciones de Tiempo](#estimaciones-de-tiempo)
10. [Stack Tecnológico](#stack-tecnológico)

---

## 🔍 Análisis del Estado Actual

### ✅ Lo que ya tenemos (Fortalezas)

1. **Base de Datos PostgreSQL + Prisma**
   - Schema bien estructurado
   - Sistema de caché incremental funcionando
   - Migraciones configuradas

2. **Admin Panel Completo**
   - CRUD de addresses
   - Import/Export CSV
   - Dashboard de estadísticas

3. **Analytics Robusto**
   - Transfer tracking
   - Holder analysis
   - Whale detection
   - Gráficos con Recharts

4. **Caché Inteligente**
   - TransferCache (incremental)
   - HolderSnapshot (periódico)
   - 90% reducción en API calls

5. **UI Completa**
   - Dashboard unificado
   - Búsqueda global (Cmd+K)
   - Componentes reutilizables
   - Responsive design

### ❌ Lo que falta para SaaS

1. **Sistema de Autenticación**
   - ❌ No hay login/registro
   - ❌ No hay usuarios en BD
   - ❌ No hay roles/permisos
   - ❌ Admin sin protección

2. **Multi-Tenancy**
   - ❌ Todo hardcoded para VTN token
   - ❌ No hay concepto de "organizaciones" o "workspaces"
   - ❌ Datos no están aislados por cliente
   - ❌ Un solo token soportado

3. **Configuración por Cliente**
   - ❌ API keys son globales (no por cliente)
   - ❌ Token address hardcoded en 10+ archivos
   - ❌ No hay settings page
   - ❌ No se pueden agregar múltiples tokens

4. **Billing**
   - ❌ No hay sistema de suscripciones
   - ❌ No hay planes (Free/Pro/Enterprise)
   - ❌ No hay límites de uso
   - ❌ No hay facturación

5. **Onboarding**
   - ❌ No hay wizard de configuración inicial
   - ❌ No hay guías o tutoriales
   - ❌ No hay verificación de tokens

### 🚨 Hardcoded Values Identificados

**Token VTN (`0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC`):**
- `src/components/AnalyticsContent.tsx` (línea 14)
- `src/lib/blockchain.ts` (línea 1852)
- `src/app/api/test-vtn/route.ts` (línea 3)
- `src/app/api/token-analytics/route.ts` (línea 8)
- `prisma/seed.ts` (datos iniciales)

**API Keys Globales:**
- `NEXT_PUBLIC_BASESCAN_API_KEY`
- `NEXT_PUBLIC_ETHERSCAN_API_KEY`
- `NEXT_PUBLIC_MORALIS_API_KEY`
- `NEXT_PUBLIC_QUICKNODE_URL`

**Exchange Addresses:**
- Hardcoded en múltiples componentes
- Deberían ser configurables por cliente

---

## 🎯 Arquitectura SaaS Target

### Modelo de Datos Multi-Tenant

```
Organization (Workspace)
├── Users (many-to-many con roles)
├── Tokens (1 o más tokens ERC20)
│   ├── Settings (API keys propias opcionales)
│   ├── KnownAddresses (etiquetas privadas)
│   ├── TransferCache (aislado por org)
│   ├── HolderSnapshots (aislado por org)
│   └── Analytics (histórico aislado)
├── Subscription (plan actual)
└── Usage Tracking (límites de API calls)
```

### Jerarquía de Tenants

```
┌─────────────────────────────────────────┐
│  Platform (Super Admin)                 │
│  - Gestión de todas las orgs            │
│  - Métricas globales                    │
│  - Feature flags                        │
└─────────────────────────────────────────┘
           │
           ├─────────────────────────────┐
           │                             │
┌──────────▼──────────┐    ┌─────────────▼──────────┐
│  Organization 1     │    │  Organization 2        │
│  (Tenant)           │    │  (Tenant)              │
│                     │    │                        │
│  - Token: AAVE      │    │  - Token: UNI          │
│  - Token: LINK      │    │  - Token: PEPE         │
│  - Users: 5         │    │  - Users: 12           │
│  - Plan: Pro        │    │  - Plan: Enterprise    │
└─────────────────────┘    └────────────────────────┘
```

### Flujo de Usuario

```
1. Usuario llega a landing page
2. Sign Up (email/password o OAuth)
3. Crea organización (nombre, slug)
4. Onboarding wizard:
   a. Agregar primer token (address + network)
   b. (Opcional) Agregar API keys propias
   c. (Opcional) Importar addresses conocidas
5. Dashboard listo para usar
6. Puede invitar miembros del equipo
```

---

## 📅 Fases de Implementación

### Timeline General

```
Fase 1: Auth & Multi-Tenant     → 2-3 semanas
Fase 2: Token Config & APIs     → 1-2 semanas
Fase 3: Onboarding & UX         → 1-2 semanas
Fase 4: Billing & Subscriptions → 2-3 semanas
Fase 5: Premium & Scale         → 2-4 semanas
─────────────────────────────────────────────
TOTAL ESTIMADO:                  8-14 semanas (2-3.5 meses)
```

---

## 🔐 Fase 1: Sistema de Autenticación y Multi-Tenant

**Duración Estimada:** 2-3 semanas
**Prioridad:** 🔴 CRÍTICA
**Objetivo:** Implementar usuarios, organizaciones, roles y protección de rutas

### ✅ Sprint 1.1: Setup de NextAuth.js (COMPLETADO - 2025-02-03)

**Status:** ✅ Completado
**Duración:** 3 días

**Funcionalidad Implementada:**
- ✅ NextAuth.js con JWT sessions
- ✅ Credentials provider (email/password + bcrypt)
- ✅ OAuth Google provider
- ✅ Middleware de protección de rutas
- ✅ Roles: SUPER_ADMIN, ADMIN, MEMBER, VIEWER
- ✅ Schema multi-tenant (User, Organization, Token)
- ✅ Test user: admin@vottun.com / admin123

**Archivos Creados:**
- `src/lib/auth.ts` - NextAuth configuration
- `src/app/api/auth/[...nextauth]/route.ts` - Auth handlers
- `src/app/api/auth/signup/route.ts` - User registration
- `src/app/auth/signin/page.tsx` - Login page
- `src/app/auth/signup/page.tsx` - Registration page
- `src/components/auth/SignInForm.tsx` - Login form
- `src/components/auth/SignUpForm.tsx` - Registration form
- `src/middleware.ts` - Route protection
- `src/components/Providers.tsx` - SessionProvider wrapper
- `prisma/seed-user.ts` - User seeding script
- `prisma/migrate-vottun-data.ts` - Data migration (8,959 records)

**Referencias:**
- Ver [CLAUDE.md](CLAUDE.md) sección "Authentication & Database" para detalles

---


### ✅ Sprint 1.2: Aislamiento Multi-Tenant (COMPLETADO - 2025-02-03)

**Status:** ✅ Completado
**Duración:** 1 día

**Funcionalidad Implementada:**
- ✅ Tenant context helper (`getTenantContext`, `getApiKeys`)
- ✅ Todos los modelos de caché con `tokenId` FK
- ✅ APIs multi-tenant (token-analytics, addresses, transfers, vesting)
- ✅ Settings de organización
- ⚠️ Token-supply cache (in-memory) - migración pendiente Sprint 2.3

**Archivos Creados/Modificados:**
- `src/lib/tenant-context.ts` - Tenant context helpers
- `src/app/api/token-analytics/route.ts` - Multi-tenant analytics
- `src/app/api/addresses/route.ts` - Multi-tenant addresses
- `src/app/api/transfers-cache/route.ts` - Multi-tenant transfers
- `src/app/api/vesting-info/route.ts` - Multi-tenant vesting
- `prisma/migrate-vottun-data.ts` - Data migration script (8,959 records)

**Referencias:**
- Ver [CLAUDE.md](CLAUDE.md) sección "Database Architecture" para schema

---

### ✅ Sprint 1.3: Gestión de Organizaciones (COMPLETADO - 2025-02-03)

**Status:** ✅ Completado
**Duración:** 1 día

**Funcionalidad Implementada:**
- ✅ API de organizaciones (POST, GET /api/organizations)
- ✅ Página de settings (/settings/organization)
- ✅ Visualización de miembros del equipo
- ⚠️ Invitación de miembros - Sprint 2.5

**Archivos Creados:**
- `src/app/api/organizations/route.ts` - CRUD de organizaciones
- `src/app/settings/organization/page.tsx` - Settings page

**Referencias:**
- Ver [CLAUDE.md](CLAUDE.md) sección "Admin Panel"

---

### ✅ Sprint 2.1: CRUD de Tokens (COMPLETADO - 2025-02-03)

**Status:** ✅ Completado
**Duración:** 30 minutos

**Funcionalidad Implementada:**
- ✅ CRUD completo de tokens (POST, GET, DELETE)
- ✅ Verificación on-chain con ethers.js (symbol, name, decimals)
- ✅ Custom API keys por token (BaseScan, Etherscan, Moralis, QuikNode)
- ✅ Custom exchange addresses configurables
- ✅ Settings: whale threshold, cache duration, max transfers

**Archivos Creados:**
- `src/app/api/tokens/route.ts` - CRUD de tokens
- `src/app/api/tokens/[id]/route.ts` - Token individual
- `src/app/api/tokens/[id]/settings/route.ts` - Settings del token
- `src/app/settings/tokens/page.tsx` - Lista de tokens
- `src/app/settings/tokens/[id]/page.tsx` - Configuración individual

**Referencias:**
- Ver [CLAUDE.md](CLAUDE.md) sección "Platform Pages" y "Token Management"

---

### ⏳ Sprint 2.2: Custom ABIs y Vesting Contracts (PENDIENTE)

**Status:** ⏳ Pendiente
**Duración estimada:** 4-5 horas
**Objetivos:**
- Agregar soporte para ABIs custom por token
- Agregar gestión de vesting contracts configurables por token
- Por defecto usar ABI estándar ERC20
- Permitir subir ABI en formato JSON
- Auto-detectar ABI desde BaseScan con botón
- Eliminar arrays hardcoded de vesting contracts

---

#### Tarea 2.2.1: Modelos en Prisma (CustomAbi + VestingContract)
**Tiempo:** 45 minutos

**A. Agregar modelo CustomAbi:**
```prisma
model CustomAbi {
  id          String   @id @default(cuid())
  tokenId     String   @unique
  abi         Json     // ABI en formato JSON
  source      String   @default("STANDARD") // STANDARD, UPLOADED, BASESCAN

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  token       Token    @relation(fields: [tokenId], references: [id], onDelete: Cascade)

  @@map("custom_abis")
}
```

**B. Agregar modelo VestingContract:**
```prisma
model VestingContract {
  id          String   @id @default(cuid())
  tokenId     String

  // Información del contrato
  name        String   // "Vottun World", "Investors", etc.
  address     String   // Dirección del contrato
  network     String   @default("base")

  // Status y metadata
  isActive    Boolean  @default(true)
  description String?
  category    String?  // "investors", "team", "marketing", etc.

  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String?

  token       Token    @relation(fields: [tokenId], references: [id], onDelete: Cascade)

  @@unique([tokenId, address, network])
  @@index([tokenId])
  @@index([address])
  @@map("vesting_contracts")
}
```

**C. Actualizar modelo Token:**
```prisma
model Token {
  // ... campos existentes ...

  // Nuevas relaciones
  customAbi         CustomAbi?
  vestingContracts  VestingContract[]

  // ... resto del modelo ...
}
```

---

#### Tarea 2.2.2: APIs para Custom ABIs
**Tiempo:** 1 hora

**Endpoints:**
- `GET /api/tokens/[id]/abi` - Obtener ABI del token
  - Devuelve CustomAbi si existe, sino ABI estándar ERC20
- `POST /api/tokens/[id]/abi` - Subir ABI custom (JSON)
  - Body: `{ abi: {...}, source: "UPLOADED" }`
  - Valida formato JSON
- `POST /api/tokens/[id]/abi/detect` - Auto-detectar desde BaseScan
  - Obtiene ABI del contrato desde BaseScan API
  - Crea CustomAbi con source: "BASESCAN"
- `DELETE /api/tokens/[id]/abi` - Eliminar ABI custom (volver a estándar)

---

#### Tarea 2.2.3: APIs para Vesting Contracts
**Tiempo:** 1.5 horas

**Endpoints:**
- `GET /api/tokens/[id]/vesting-contracts` - Listar vesting contracts del token
  - Query params: `?active=true` (filtrar por activos)
  - Devuelve array de contratos ordenados por createdAt

- `POST /api/tokens/[id]/vesting-contracts` - Crear vesting contract
  - Body: `{ name, address, network, category?, description? }`
  - Valida que no exista duplicado (tokenId + address + network)

- `PATCH /api/tokens/[id]/vesting-contracts/[contractId]` - Actualizar vesting contract
  - Body: `{ name?, isActive?, category?, description? }`

- `DELETE /api/tokens/[id]/vesting-contracts/[contractId]` - Eliminar vesting contract

---

#### Tarea 2.2.4: UI en Settings de Token - ABIs
**Tiempo:** 1 hora

Agregar sección en `/settings/tokens/[id]`:

**Sección: ABI del Token**
- Radio buttons:
  - "ABI Estándar ERC20" (default)
  - "ABI Custom"
- Si "ABI Custom" seleccionado:
  - Textarea para pegar JSON (con syntax highlighting)
  - Botón "Auto-detectar desde BaseScan"
  - Botón "Guardar ABI"
  - Validación de formato JSON
  - Preview de métodos detectados
- Mostrar source actual (STANDARD, UPLOADED, BASESCAN)
- Botón "Volver a Estándar" si hay custom ABI

---

#### Tarea 2.2.5: UI en Settings de Token - Vesting Contracts
**Tiempo:** 1.5 horas

Agregar sección en `/settings/tokens/[id]`:

**Sección: Vesting Contracts**
- Tabla con columnas:
  - Nombre
  - Dirección (truncada con tooltip)
  - Red
  - Categoría
  - Estado (Activo/Inactivo)
  - Acciones (Editar, Activar/Desactivar, Eliminar)

- Botón "Agregar Vesting Contract"
  - Modal con form:
    - Input: Nombre (required)
    - Input: Dirección (required, validación de address)
    - Select: Red (base, base-testnet, base-sepolia)
    - Input: Categoría (opcional)
    - Textarea: Descripción (opcional)

- Búsqueda y filtros:
  - Buscar por nombre o dirección
  - Filtrar por red
  - Filtrar por estado (activo/inactivo)

---

#### Tarea 2.2.6: Actualizar Componentes para usar BD
**Tiempo:** 1 hora

**Archivos a modificar:**
1. `src/app/explorer/vestings/components/VestingContractList.tsx`
   - Eliminar array VESTING_CONTRACTS hardcoded
   - Hacer fetch a `/api/tokens/[id]/vesting-contracts`
   - Mostrar contratos desde BD

2. `src/app/api/vesting-info/route.ts`
   - Eliminar array VESTING_CONTRACTS hardcoded
   - Obtener contratos desde BD vía tenantContext

3. `src/components/VestingInfo.tsx`
   - Actualizar si tiene referencias hardcoded

---

#### Tarea 2.2.7: Script de Migración de Datos
**Tiempo:** 30 minutos

Crear `prisma/migrate-vesting-contracts.ts`:
- Migrar los 10 contratos hardcoded de Vottun al token VTN
- Insertar en tabla VestingContract
- Script idempotente (verificar antes de insertar)

**Contratos a migrar:**
```typescript
const VOTTUN_VESTING_CONTRACTS = [
  { name: 'Vottun World', address: '0xa699Cf416FFe6063317442c3Fbd0C39742E971c5', category: 'community' },
  { name: 'Investors', address: '0x3e0ef51811B647E00A85A7e5e495fA4763911982', category: 'investors' },
  { name: 'Marketing', address: '0xE521B2929DD28a725603bCb6F4009FBb656C4b15', category: 'marketing' },
  { name: 'Staking', address: '0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF', category: 'staking' },
  { name: 'Liquidity', address: '0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1', category: 'liquidity' },
  { name: 'Promos', address: '0xFC750D874077F8c90858cC132e0619CE7571520b', category: 'promos' },
  { name: 'Team', address: '0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8', category: 'team' },
  { name: 'Reserve', address: '0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d', category: 'reserve' },
  { name: 'ToCheck1', address: '0x7BBDa50bE87DFf935782C80D4222D46490F242A1', category: 'other' },
  { name: 'ToCheck2', address: '0x1808CF66F69DC1B8217d1C655fBD134B213AE358', category: 'other' }
];
```

---

### ⏳ Sprint 2.3: Token Supply Cache Migration (PENDIENTE)

**Status:** ⏳ Pendiente
**Duración estimada:** 2-3 horas
**Prioridad:** 🟡 Media (optimización)

**Problema Actual:**
El token supply usa caché in-memory con 5 min TTL, se pierde al reiniciar el servidor.

**Objetivos:**
- Migrar caché in-memory a modelo `TokenSupplyCache` (BD)
- Implementar TTL y refresh logic en BD
- Mejorar persistencia de datos

**Tareas:**
1. Actualizar `src/lib/blockchain.ts` - Usar Prisma en vez de objeto en memoria
2. Implementar refresh automático basado en `expiresAt`
3. Testing y validación

---

### ⏳ Sprint 2.4: APIs Multi-Tenant Completas (PENDIENTE)

**Status:** ⏳ Pendiente
**Duración estimada:** 2-3 horas
**Prioridad:** 🟡 Media (no crítico si se usa desde dashboard autenticado)

**APIs Pendientes de Actualizar:**
- `/api/tokens/balance` - Agregar `getTenantContext()`
- `/api/tokens/transfers` - Agregar `getTenantContext()`
- `/api/search` - Filtrar resultados por tokenId
- `/api/test-vtn` - Deprecar (endpoint de testing legacy)

**Objetivos:**
- Todas las APIs usan tenant context
- Validación de permisos consistente
- Isolación de datos por organización

---

### ⏳ Sprint 2.5: Invitación de Miembros (PENDIENTE)

**Status:** ⏳ Pendiente
**Duración estimada:** 3-4 horas
**Prioridad:** 🟡 Media (feature colaborativo)

**Problema Actual:**
El botón "Invitar Miembro" en `/settings/organization` no tiene funcionalidad.

**Objetivos:**
- Sistema completo de invitaciones por email
- Gestión de invitaciones pendientes
- Página de aceptación de invitaciones

**Tareas:**

#### 2.5.1: API de Invitaciones (1.5h)
- `POST /api/organizations/invite` - Enviar invitación
  - Body: `{ email, role }`
  - Crea registro en tabla `Invitation`
  - Envía email con link único
- `GET /api/organizations/invitations` - Listar pendientes
- `POST /api/organizations/invitations/[id]/accept` - Aceptar invitación
- `DELETE /api/organizations/invitations/[id]` - Cancelar invitación

#### 2.5.2: Email Service (1h)
- Integración con Resend o Nodemailer
- Template de email de invitación
- Link seguro con token único

#### 2.5.3: UI Updates (1.5h)
- Modal de invitación en `/settings/organization`
- Lista de invitaciones pendientes
- Página `/invite/[token]` para aceptar

**Modelo Prisma Necesario:**
```prisma
model Invitation {
  id             String   @id @default(cuid())
  organizationId String
  email          String
  role           MemberRole @default(MEMBER)
  token          String   @unique
  invitedBy      String
  expiresAt      DateTime
  acceptedAt     DateTime?

  organization   Organization @relation(...)

  @@index([token])
  @@index([organizationId])
}
```

---

**Próximo:** Fase 3 - Onboarding y UX (Sprint 3.1: Wizard de Onboarding)

---

## 🎨 Fase 3: Onboarding y UX

**Duración Estimada:** 1-2 semanas
**Prioridad:** ⏸️ POSTPONED (para el final)
**Objetivo:** Experiencia fluida para nuevos usuarios y gestión de múltiples tokens

### ⏸️ Sprint 3.1: Wizard de Onboarding (POSTPONED)

#### Tarea 3.1.1: Crear Flow de Onboarding
**Tiempo:** 6-8 horas

**Pasos del Onboarding:**
1. Bienvenida
2. Crear Organización
3. Agregar Primer Token
4. (Opcional) Configurar API Keys
5. (Opcional) Importar Addresses Conocidas
6. ¡Listo!

```typescript
// src/app/onboarding/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

type Step = 'welcome' | 'organization' | 'token' | 'apis' | 'addresses' | 'done';

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>('welcome');
  const [orgData, setOrgData] = useState({ name: '', slug: '' });
  const [tokenData, setTokenData] = useState({ address: '', network: 'base' });
  const [loading, setLoading] = useState(false);

  const handleCreateOrganization = async () => {
    setLoading(true);

    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orgData)
    });

    if (res.ok) {
      setStep('token');
    }

    setLoading(false);
  };

  const handleAddToken = async () => {
    setLoading(true);

    const res = await fetch('/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenData)
    });

    if (res.ok) {
      setStep('done');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {['welcome', 'organization', 'token', 'done'].map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-2 mx-1 rounded ${
                  ['welcome', 'organization', 'token', 'done'].indexOf(step) >= i
                    ? 'bg-blue-600'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 'welcome' && (
            <div className="text-center">
              <div className="text-6xl mb-4">🚀</div>
              <h1 className="text-3xl font-bold mb-4">
                ¡Bienvenido a Token Analytics!
              </h1>
              <p className="text-gray-600 mb-8">
                En solo 2 minutos tendrás tu dashboard de analytics listo para usar
              </p>
              <button
                onClick={() => setStep('organization')}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 text-lg"
              >
                Empezar
              </button>
            </div>
          )}

          {step === 'organization' && (
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Crea tu organización
              </h2>
              <p className="text-gray-600 mb-6">
                Tu espacio de trabajo donde gestionarás tus tokens
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Nombre de la Organización
                  </label>
                  <input
                    type="text"
                    value={orgData.name}
                    onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                    placeholder="Ej: Mi Proyecto Crypto"
                    className="w-full px-4 py-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Slug (URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">app.tudominio.com/</span>
                    <input
                      type="text"
                      value={orgData.slug}
                      onChange={(e) => setOrgData({
                        ...orgData,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                      })}
                      placeholder="mi-proyecto"
                      className="flex-1 px-4 py-3 border rounded-lg"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCreateOrganization}
                  disabled={!orgData.name || !orgData.slug || loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 mt-6"
                >
                  {loading ? 'Creando...' : 'Continuar'}
                </button>
              </div>
            </div>
          )}

          {step === 'token' && (
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Agrega tu primer token
              </h2>
              <p className="text-gray-600 mb-6">
                Ingresa la address del contrato ERC20 que quieres analizar
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Contract Address
                  </label>
                  <input
                    type="text"
                    value={tokenData.address}
                    onChange={(e) => setTokenData({ ...tokenData, address: e.target.value })}
                    placeholder="0x..."
                    className="w-full px-4 py-3 border rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Network
                  </label>
                  <select
                    value={tokenData.network}
                    onChange={(e) => setTokenData({ ...tokenData, network: e.target.value })}
                    className="w-full px-4 py-3 border rounded-lg"
                  >
                    <option value="base">Base Mainnet</option>
                    <option value="base-testnet">Base Testnet (Goerli)</option>
                    <option value="base-sepolia">Base Sepolia</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-800">
                    💡 <strong>Tip:</strong> Verificaremos on-chain que el token exista y obtendremos automáticamente el nombre, símbolo y decimales.
                  </div>
                </div>

                <button
                  onClick={handleAddToken}
                  disabled={!tokenData.address || loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 mt-6"
                >
                  {loading ? 'Verificando...' : 'Agregar Token'}
                </button>

                <button
                  onClick={() => setStep('organization')}
                  className="w-full text-gray-600 py-2"
                >
                  ← Atrás
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-3xl font-bold mb-4">
                ¡Todo listo!
              </h2>
              <p className="text-gray-600 mb-8">
                Tu dashboard está configurado y listo para usar. Puedes agregar más tokens después desde Settings.
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 text-lg"
              >
                Ir al Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Resultado:** Wizard completo de onboarding para nuevos usuarios

---

#### Tarea 3.1.2: Token Selector en UI
**Tiempo:** 3-4 horas

```typescript
// src/components/TokenSelector.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TokenSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tokens, setTokens] = useState<any[]>([]);
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTokens();
  }, []);

  useEffect(() => {
    const tokenId = searchParams.get('token');
    if (tokenId) {
      setActiveTokenId(tokenId);
    }
  }, [searchParams]);

  const fetchTokens = async () => {
    const res = await fetch('/api/tokens');
    const data = await res.json();
    setTokens(data);

    if (data.length > 0 && !activeTokenId) {
      setActiveTokenId(data[0].id);
    }

    setLoading(false);
  };

  const handleChange = (tokenId: string) => {
    setActiveTokenId(tokenId);

    // Actualizar URL para mantener token seleccionado
    const url = new URL(window.location.href);
    url.searchParams.set('token', tokenId);
    router.push(url.pathname + url.search);
  };

  if (loading) return <div>Cargando tokens...</div>;

  if (tokens.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          No hay tokens configurados. <a href="/settings/tokens" className="font-semibold underline">Agrega uno aquí</a>
        </p>
      </div>
    );
  }

  const activeToken = tokens.find(t => t.id === activeTokenId);

  return (
    <div className="relative">
      <select
        value={activeTokenId || ''}
        onChange={(e) => handleChange(e.target.value)}
        className="appearance-none bg-white border rounded-lg px-4 py-2 pr-10 font-medium hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {tokens.map((token) => (
          <option key={token.id} value={token.id}>
            {token.symbol} - {token.name}
          </option>
        ))}
      </select>

      {activeToken && (
        <div className="absolute left-0 mt-2 text-xs text-gray-500">
          {activeToken.address} • {activeToken.network}
        </div>
      )}
    </div>
  );
}
```

**Integrar en páginas:**

```typescript
// src/app/dashboard/page.tsx (actualizado)
import TokenSelector from '@/components/TokenSelector';

export default function Dashboard() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <TokenSelector />
      </div>

      {/* Resto del dashboard */}
    </div>
  );
}
```

**Resultado:** Selector de tokens en todas las páginas principales

---

**✅ FIN DE FASE 3**

**Entregables:**
- ✅ Wizard de onboarding completo (5 pasos)
- ✅ Token selector integrado en UI
- ✅ Flow optimizado para nuevos usuarios
- ✅ Redirección automática a onboarding si no hay org/tokens

**Próximo:** Fase 4 - Billing y Suscripciones

---

## 💳 Fase 4: Billing y Suscripciones

**Duración Estimada:** 2-3 semanas
**Prioridad:** 🟡 ALTA
**Objetivo:** Monetización con Stripe, planes y límites de uso

### Sprint 4.1: Integración con Stripe (4-5 días)

#### Tarea 4.1.1: Setup de Stripe
**Tiempo:** 2-3 horas

```bash
npm install stripe @stripe/stripe-js
```

```typescript
// src/lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export const STRIPE_PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: {
      tokens: 1,
      apiCallsPerMonth: 1000,
      dataRetentionDays: 7,
      customApiKeys: false,
      teamMembers: 1,
      advancedFilters: false,
      alertas: false
    }
  },
  pro: {
    name: 'Pro',
    price: 49,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: {
      tokens: 5,
      apiCallsPerMonth: 50000,
      dataRetentionDays: 90,
      customApiKeys: true,
      teamMembers: 5,
      advancedFilters: true,
      alertas: true
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 199,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: {
      tokens: -1, // Ilimitado
      apiCallsPerMonth: -1, // Ilimitado
      dataRetentionDays: 365,
      customApiKeys: true,
      teamMembers: -1, // Ilimitado
      advancedFilters: true,
      alertas: true,
      dedicatedSupport: true,
      customIntegrations: true
    }
  }
};
```

**Modelo de Subscription en Prisma:**

```prisma
model Subscription {
  id                String   @id @default(cuid())
  organizationId    String   @unique

  // Stripe
  stripeCustomerId      String?  @unique
  stripeSubscriptionId  String?  @unique
  stripePriceId         String?
  stripeCurrentPeriodEnd DateTime?

  // Plan
  plan              SubscriptionPlan @default(FREE)
  status            SubscriptionStatus @default(ACTIVE)

  // Usage tracking
  apiCallsThisMonth Int      @default(0)
  apiCallsLimit     Int      @default(1000)
  tokensCount       Int      @default(0)
  tokensLimit       Int      @default(1)

  // Billing
  billingCycleStart DateTime @default(now())
  billingCycleEnd   DateTime?

  // Metadata
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  canceledAt        DateTime?

  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([stripeCustomerId])
  @@index([stripeSubscriptionId])
  @@map("subscriptions")
}

enum SubscriptionPlan {
  FREE
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  CANCELED
  PAST_DUE
  TRIALING
}

// Tabla de uso (para tracking granular)
model UsageStats {
  id             String   @id @default(cuid())
  organizationId String
  date           DateTime @default(now())

  // Métricas
  apiCalls       Int      @default(0)
  transfersFetched Int    @default(0)
  holdersFetched   Int    @default(0)

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, date])
  @@index([organizationId])
  @@map("usage_stats")
}
```

**Migración:**
```bash
npx prisma migrate dev --name add_subscriptions
npx prisma generate
```

**Resultado:** Stripe configurado con modelos de Subscription

---

#### Tarea 4.1.2: Crear Checkout de Stripe
**Tiempo:** 4-5 horas

```typescript
// src/app/api/stripe/create-checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { stripe, STRIPE_PLANS } from '@/lib/stripe';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { plan } = await request.json();

  if (!['pro', 'enterprise'].includes(plan)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
  }

  const planConfig = STRIPE_PLANS[plan as 'pro' | 'enterprise'];

  // Obtener o crear Stripe Customer
  let subscription = await prisma.subscription.findUnique({
    where: { organizationId: tenantContext.organizationId }
  });

  let customerId = subscription?.stripeCustomerId;

  if (!customerId) {
    const user = await prisma.user.findUnique({
      where: { id: tenantContext.userId }
    });

    const customer = await stripe.customers.create({
      email: user!.email!,
      metadata: {
        organizationId: tenantContext.organizationId
      }
    });

    customerId = customer.id;

    // Actualizar subscription con customerId
    subscription = await prisma.subscription.upsert({
      where: { organizationId: tenantContext.organizationId },
      create: {
        organizationId: tenantContext.organizationId,
        stripeCustomerId: customerId,
        plan: 'FREE',
        status: 'ACTIVE'
      },
      update: {
        stripeCustomerId: customerId
      }
    });
  }

  // Crear Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: planConfig.priceId!,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?checkout=canceled`,
    metadata: {
      organizationId: tenantContext.organizationId,
      plan
    }
  });

  return NextResponse.json({ url: session.url });
}
```

**Webhook de Stripe:**

```typescript
// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Manejar eventos
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId;
      const plan = session.metadata?.plan;

      if (!organizationId || !plan) break;

      // Actualizar subscription
      await prisma.subscription.update({
        where: { organizationId },
        data: {
          stripeSubscriptionId: session.subscription as string,
          stripePriceId: session.line_items?.data[0]?.price?.id,
          plan: plan.toUpperCase() as 'PRO' | 'ENTERPRISE',
          status: 'ACTIVE',
          stripeCurrentPeriodEnd: new Date(session.expires_at * 1000)
        }
      });

      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata?.organizationId;

      if (!organizationId) break;

      await prisma.subscription.update({
        where: { organizationId },
        data: {
          status: subscription.status === 'active' ? 'ACTIVE' : 'CANCELED',
          stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000)
        }
      });

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata?.organizationId;

      if (!organizationId) break;

      await prisma.subscription.update({
        where: { organizationId },
        data: {
          plan: 'FREE',
          status: 'CANCELED',
          canceledAt: new Date()
        }
      });

      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

**Resultado:** Checkout funcional con webhooks de Stripe

---

#### Tarea 4.1.3: Página de Billing
**Tiempo:** 4-5 horas

```typescript
// src/app/settings/billing/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { STRIPE_PLANS } from '@/lib/stripe';

export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    const res = await fetch('/api/subscription');
    const data = await res.json();
    setSubscription(data);
    setLoading(false);
  };

  const handleUpgrade = async (plan: 'pro' | 'enterprise') => {
    setUpgrading(true);

    const res = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    });

    const { url } = await res.json();
    window.location.href = url;
  };

  if (loading) return <div>Cargando...</div>;

  const currentPlan = subscription?.plan?.toLowerCase() || 'free';

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
      <p className="text-gray-600 mb-8">
        Gestiona tu plan y métodos de pago
      </p>

      {/* Current Plan */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              Plan Actual: {STRIPE_PLANS[currentPlan as keyof typeof STRIPE_PLANS].name}
            </h2>
            <p className="text-gray-600">
              ${STRIPE_PLANS[currentPlan as keyof typeof STRIPE_PLANS].price}/mes
            </p>
          </div>

          {currentPlan !== 'free' && (
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">
                Próxima facturación
              </div>
              <div className="font-semibold">
                {new Date(subscription.stripeCurrentPeriodEnd).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>

        {/* Usage Stats */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t">
          <div>
            <div className="text-sm text-gray-500 mb-1">Tokens</div>
            <div className="text-2xl font-bold">
              {subscription?.tokensCount || 0} / {subscription?.tokensLimit === -1 ? '∞' : subscription?.tokensLimit}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">API Calls este mes</div>
            <div className="text-2xl font-bold">
              {subscription?.apiCallsThisMonth?.toLocaleString() || 0} / {subscription?.apiCallsLimit === -1 ? '∞' : subscription?.apiCallsLimit?.toLocaleString()}
            </div>
            {subscription?.apiCallsLimit !== -1 && (
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, (subscription?.apiCallsThisMonth / subscription?.apiCallsLimit) * 100)}%`
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plans */}
      <h2 className="text-2xl font-bold mb-4">Planes Disponibles</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {Object.entries(STRIPE_PLANS).map(([key, plan]) => (
          <div
            key={key}
            className={`border rounded-lg p-6 ${
              currentPlan === key ? 'border-blue-600 border-2' : ''
            }`}
          >
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="text-4xl font-bold mb-1">
                ${plan.price}
                <span className="text-lg text-gray-500">/mes</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  {plan.features.tokens === -1 ? 'Tokens ilimitados' : `${plan.features.tokens} token(s)`}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  {plan.features.apiCallsPerMonth === -1
                    ? 'API calls ilimitadas'
                    : `${plan.features.apiCallsPerMonth.toLocaleString()} API calls/mes`}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>Retención de {plan.features.dataRetentionDays} días</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>{plan.features.teamMembers === -1 ? 'Miembros ilimitados' : `${plan.features.teamMembers} miembro(s)`}</span>
              </li>
              {plan.features.customApiKeys && (
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>API keys personalizadas</span>
                </li>
              )}
              {plan.features.advancedFilters && (
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Filtros avanzados</span>
                </li>
              )}
              {plan.features.alertas && (
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>Sistema de alertas</span>
                </li>
              )}
            </ul>

            <button
              onClick={() => handleUpgrade(key as 'pro' | 'enterprise')}
              disabled={currentPlan === key || key === 'free' || upgrading}
              className={`w-full py-3 rounded-lg font-semibold ${
                currentPlan === key
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : key === 'free'
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {currentPlan === key ? 'Plan Actual' : key === 'free' ? 'Downgrade' : 'Upgrade'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Resultado:** Página completa de billing con planes y checkout

---

### Sprint 4.2: Límites y Usage Tracking (2-3 días)

#### Tarea 4.2.1: Middleware de Límites
**Tiempo:** 3-4 horas

```typescript
// src/lib/usage-limits.ts
import { getTenantContext } from './tenant-context';
import { prisma } from './db';
import { STRIPE_PLANS } from './stripe';

export async function checkUsageLimits() {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return { allowed: false, reason: 'No autenticado' };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: tenantContext.organizationId }
  });

  if (!subscription) {
    return { allowed: false, reason: 'No subscription encontrada' };
  }

  const plan = STRIPE_PLANS[subscription.plan.toLowerCase() as keyof typeof STRIPE_PLANS];

  // Check tokens limit
  if (plan.features.tokens !== -1 && tenantContext.tokens.length >= plan.features.tokens) {
    return {
      allowed: false,
      reason: `Has alcanzado el límite de ${plan.features.tokens} tokens. Upgrade tu plan.`
    };
  }

  // Check API calls limit
  if (plan.features.apiCallsPerMonth !== -1 &&
      subscription.apiCallsThisMonth >= plan.features.apiCallsPerMonth) {
    return {
      allowed: false,
      reason: `Has alcanzado el límite de ${plan.features.apiCallsPerMonth} API calls este mes. Upgrade tu plan o espera al próximo ciclo.`
    };
  }

  return { allowed: true };
}

export async function incrementApiCall(organizationId: string) {
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      apiCallsThisMonth: {
        increment: 1
      }
    }
  });

  // También registrar en usage stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.usageStats.upsert({
    where: {
      organizationId_date: {
        organizationId,
        date: today
      }
    },
    create: {
      organizationId,
      date: today,
      apiCalls: 1
    },
    update: {
      apiCalls: {
        increment: 1
      }
    }
  });
}
```

**Integrar en APIs:**

```typescript
// src/app/api/token-analytics/route.ts (actualizado)
import { checkUsageLimits, incrementApiCall } from '@/lib/usage-limits';

export async function GET(request: NextRequest) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // 🆕 Check usage limits
  const limitsCheck = await checkUsageLimits();

  if (!limitsCheck.allowed) {
    return NextResponse.json(
      { error: limitsCheck.reason },
      { status: 403 }
    );
  }

  // ... lógica normal de la API

  // 🆕 Incrementar contador al final
  await incrementApiCall(tenantContext.organizationId);

  return NextResponse.json({ ... });
}
```

**Resultado:** Sistema de límites funcionando en todas las APIs

---

**✅ FIN DE FASE 4**

**Entregables:**
- ✅ Integración completa con Stripe
- ✅ 3 planes (Free, Pro, Enterprise)
- ✅ Checkout y webhooks funcionando
- ✅ Página de billing con upgrade/downgrade
- ✅ Sistema de límites por plan
- ✅ Usage tracking granular
- ✅ Reset mensual de contadores

**Próximo:** Fase 5 - Features Premium y Escalabilidad

---

## 🚀 Fase 5: Features Premium y Escalabilidad

**Duración Estimada:** 2-4 semanas
**Prioridad:** 🟢 BAJA (post-launch)
**Objetivo:** Features avanzadas y optimizaciones

### Features a Implementar

1. **Sistema de Alertas (Telegram/Email)** - 1 semana
2. **Exportar Datos (CSV/JSON)** - 2-3 días
3. **Comparación de Tokens** - 3-4 días
4. **Histórico y Análisis de Tendencias** - 1 semana
5. **API Pública para Clientes** - 1-2 semanas
6. **White Label** - 2-3 semanas

*(Ver IMPROVEMENTS.md para detalles completos)*

---

## ⏱️ Estimaciones de Tiempo

### Resumen por Fase

| Fase | Descripción | Duración | Dificultad |
|------|-------------|----------|------------|
| **Fase 1** | Auth & Multi-Tenant | 2-3 semanas | 🔴 Alta |
| **Fase 2** | Token Config & APIs | 1-2 semanas | 🟡 Media |
| **Fase 3** | Onboarding & UX | 1-2 semanas | 🟢 Baja |
| **Fase 4** | Billing & Subscriptions | 2-3 semanas | 🟡 Media |
| **Fase 5** | Premium Features | 2-4 semanas | 🟢 Baja |
| **TOTAL** | **MVP SaaS** | **8-14 semanas** | **(2-3.5 meses)** |

### Desglose Detallado

**Fase 1: Auth & Multi-Tenant (2-3 semanas)**
- Sprint 1.1: NextAuth Setup → 3-4 días
- Sprint 1.2: Aislamiento Multi-Tenant → 4-5 días
- Sprint 1.3: Gestión de Organizaciones → 3-4 días

**Fase 2: Config de Tokens (1-2 semanas)**
- Sprint 2.1: CRUD Tokens → 3-4 días
- Sprint 2.2: Settings & API Keys → 2-3 días

**Fase 3: Onboarding (1-2 semanas)**
- Sprint 3.1: Wizard → 3-4 días
- Sprint 3.2: Token Selector → 2-3 días

**Fase 4: Billing (2-3 semanas)**
- Sprint 4.1: Stripe Integration → 4-5 días
- Sprint 4.2: Usage Limits → 2-3 días
- Sprint 4.3: Billing Page → 2-3 días

---

## 🛠️ Stack Tecnológico

### Backend
- ✅ **Next.js 14** - App Router
- ✅ **PostgreSQL** - Base de datos
- ✅ **Prisma** - ORM
- 🆕 **NextAuth.js** - Autenticación
- 🆕 **Stripe** - Billing

### Frontend
- ✅ **React 18** - UI
- ✅ **Tailwind CSS** - Styling
- ✅ **Recharts** - Charts
- 🆕 **React Hook Form** - Formularios
- 🆕 **Zod** - Validación

### Infraestructura
- ✅ **Docker** - PostgreSQL local
- 🆕 **Vercel** - Hosting (Next.js)
- 🆕 **Supabase/Neon** - PostgreSQL producción
- 🆕 **Stripe** - Payments
- 🆕 **Resend/SendGrid** - Emails (opcional)

---

## 📊 Checklist de Migración

### Pre-Launch Checklist

**Fase 1:**
- [x] NextAuth configurado
- [x] Login/Signup funcional
- [x] Modelos de User, Organization, Token creados
- [x] Middleware de protección
- [ ] Tenant context helper
- [ ] APIs protegidas y aisladas
- [ ] Página de settings de org

**Fase 2:**
- [x] CRUD de tokens
- [x] Verificación on-chain
- [x] Settings por token
- [x] API keys personalizadas
- [x] Custom exchange addresses
- [x] Custom ABIs multi-contrato
- [x] Vesting contracts configurables
- [ ] Token Supply Cache migration
- [ ] APIs multi-tenant completas
- [ ] Invitación de miembros

**Fase 3:**
- [ ] Wizard de onboarding
- [ ] Token selector en UI
- [ ] Redirección automática si no hay setup

**Fase 4:**
- [ ] Stripe configurado
- [ ] Planes definidos (Free/Pro/Enterprise)
- [ ] Checkout funcionando
- [ ] Webhooks configurados
- [ ] Página de billing
- [ ] Límites de uso implementados
- [ ] Usage tracking

**Launch:**
- [ ] Testing completo
- [ ] Migrar BD a producción
- [ ] Configurar Stripe en producción
- [ ] Docs actualizados
- [ ] Landing page
- [ ] Emails transaccionales

---

## 🎯 Métricas de Éxito

### KPIs Técnicos
- ⚡ Tiempo de carga: <3s
- 🔒 0 vulnerabilidades críticas
- ✅ 99.9% uptime
- 📊 <100ms latencia API p95

### KPIs de Producto
- 👥 50+ organizaciones registradas (primer mes)
- 💰 10+ conversiones a Pro (primer mes)
- 📈 70% completion rate del onboarding
- ⭐ 4.5/5 satisfacción del usuario

### KPIs de Negocio
- 💵 $2,000+ MRR (primer trimestre)
- 📊 20% conversion rate Free → Pro
- 🔄 <5% churn mensual
- 📈 30% MoM growth

---

## 🚨 Riesgos y Mitigaciones

### Riesgos Técnicos

1. **Migración de datos hardcoded**
   - **Riesgo:** Perder datos durante migración
   - **Mitigación:** Backup completo, migración gradual con rollback plan

2. **Rate limits de APIs externas**
   - **Riesgo:** Clientes exceden límites compartidos
   - **Mitigación:** API keys personalizadas, queuing, rate limiting inteligente

3. **Performance con múltiples tenants**
   - **Riesgo:** BD se satura con muchos clientes
   - **Mitigación:** Índices optimizados, caching agresivo, sharding futuro

### Riesgos de Producto

1. **Onboarding complejo**
   - **Riesgo:** Usuarios se pierden o abandonan
   - **Mitigación:** Wizard simple (2 min), demos, soporte en vivo

2. **Pricing no competitivo**
   - **Riesgo:** No convierten a paid
   - **Mitigación:** Research de competencia, A/B testing, trial period

3. **Falta de features críticas**
   - **Riesgo:** Usuarios piden funcionalidad no disponible
   - **Mitigación:** MVP con lo esencial, roadmap público, feedback loop

---

## 📚 Recursos Adicionales

### Documentación
- [NextAuth.js Docs](https://next-auth.js.org)
- [Stripe Docs](https://stripe.com/docs)
- [Prisma Multi-tenancy](https://www.prisma.io/docs/guides/performance-and-optimization/multi-tenancy)

### Ejemplos de SaaS con Next.js
- [Taxonomy](https://github.com/shadcn/taxonomy) - Boilerplate SaaS
- [NextAuth Example](https://github.com/nextauthjs/next-auth-example)
- [Cal.com](https://github.com/calcom/cal.com) - Open source SaaS

---

## 🎉 Siguiente Paso

**Acción Inmediata:**
1. Revisar y aprobar este plan
2. Crear milestones en GitHub
3. Empezar con Fase 1, Sprint 1.1: Setup de NextAuth

**¿Listo para empezar?** 🚀

---

**Documento creado:** 2025-02-02
**Última actualización:** 2025-02-03
**Versión:** 1.2 (Fase 1 y 2 completadas - Sprints 1.1, 1.2, 1.3, 2.1 ✅)
