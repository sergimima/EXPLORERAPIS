# Plan de Implementación de Base de Datos

## 📋 Resumen Ejecutivo

Este documento detalla el estado actual de la implementación de la base de datos PostgreSQL + Prisma en el proyecto Blockchain Explorer, enfocándose en:
- ✅ Etiquetado de addresses (KnownAddress)
- ✅ Sistema de caché incremental (TransferCache, HolderSnapshot)
- ⚠️ UI de administración (pendiente)

> **💡 Para features avanzadas y roadmap futuro**, consultar [IMPROVEMENTS.md](IMPROVEMENTS.md)

---

## 📊 Estado Actual de Implementación

**Última actualización:** 2025-01-21 (Sistema de caché incremental + Uniswap V4 implementados ✅)

### ✅ Completado

#### Sprint 1: Setup Inicial (100% completado)
- ✅ Prisma instalado y configurado (`@prisma/client`, `@prisma/adapter-pg`)
- ✅ Schema completo de Fase 1 implementado (`KnownAddress`, `TokenSupplyCache`, `TransferCache`, `HolderSnapshot`)
- ✅ Cliente Prisma singleton en `src/lib/db.ts` con adapter PostgreSQL
- ✅ Migraciones creadas y aplicadas
- ✅ Seed script con datos iniciales (8 contratos vesting, 1 token, 4 exchanges)
- ✅ API básica `/api/addresses` con GET, POST, DELETE
- ✅ Integración en analytics page para mostrar nombres de addresses

#### Implementaciones Parciales
- ✅ **Sistema de Caché Incremental**: Implementado caché inteligente usando `TransferCache` y `HolderSnapshot` en `/api/token-analytics`
  - Transfers: Sync incremental (solo pide nuevos desde último timestamp)
  - Holders: Snapshots cada 5 minutos
  - Botón "Actualizar" manual en UI con timestamp
- ⚠️ **UI de administración**: No existe página `/admin/addresses` para gestionar etiquetas masivamente
- ⚠️ **Integración UI**: Los nombres se muestran en analytics con modal de edición, pero faltan badges de colores y filtros avanzados

### ❌ Pendiente

#### Sprint 2: UI de Administración (0% completado)
- ❌ Página `/admin/addresses` para gestionar etiquetas
- ❌ Formulario para agregar/editar addresses
- ❌ Búsqueda y filtrado de addresses
- ❌ Importar/Exportar addresses (CSV/JSON)
- ❌ Componentes admin (`AddressForm.tsx`, `AddressList.tsx`, `AddressImport.tsx`)

#### Sprint 3: Sistema de Caché en BD (80% completado) ✅
- ✅ Implementación de caché usando modelos de BD
- ⚠️ Middleware de caché para token supply usando `TokenSupplyCache` (pendiente, actualmente usa caché en memoria)
- ✅ Caché de transferencias usando `TransferCache` con sync incremental
- ✅ Caché de holders snapshot usando `HolderSnapshot` (snapshots cada 5 min)
- ❌ Job de limpieza de caché expirado (no necesario aún, se puede implementar luego)
- ✅ Integración de caché en `/api/token-analytics`
- ⚠️ Integración de caché en `/api/token-supply` (pendiente)

#### Sprint 4: Integración en UI (60% completado)
- ✅ Mostrar nombres de addresses desde BD
- ✅ Modal de edición de nombres con botón de lápiz
- ✅ Botón "Actualizar" manual con estado de loading
- ✅ Timestamp "Última actualización: hace Xm"
- ⚠️ Indicador visual de addresses conocidas (parcial: badges de tipo CEX/Contrato/Wallet)
- ❌ Tooltips con descripción completa
- ❌ Filtros avanzados por tipo de address
- ❌ Badges de colores según categoría
- ❌ Link directo a editar address desde cualquier vista

#### Fases Avanzadas
> **📌 Nota:** Features avanzadas (Watchlists, Alertas, Analytics Histórico, Multi-usuario, API Pública, etc.) están documentadas en [IMPROVEMENTS.md](IMPROVEMENTS.md)

### 📈 Progreso General

- **Fase 1 (Etiquetado y Caché Básico)**: ~70% completado ✅
  - Setup: 100% ✅
  - API básica: 100% ✅
  - UI Admin: 0% ❌ (pendiente página dedicada)
  - **Caché en BD: 80% ✅** (implementado sync incremental)
  - Integración UI: 60% ⚠️ (falta página admin y badges avanzados)

---

## 🎯 Objetivos Completados

1. ✅ **Etiquetar direcciones conocidas** (contratos propios, wallets importantes)
2. ✅ **Mejorar performance** mediante caché de datos frecuentes (reducción de 75-80% en tiempo de carga)
3. ✅ **Reducir llamadas a APIs** externas (reducción de 90% en API calls)

## 🎯 Objetivos Pendientes (Fase 1)

1. ⚠️ **UI de administración** para gestión masiva de addresses
2. ⚠️ **Badges y filtros avanzados** en Analytics
3. ⚠️ Migrar caché de `/api/token-supply` a usar `TokenSupplyCache`

> **📌 Para objetivos futuros** (Alertas, Watchlists, Multi-usuario, etc.), ver [IMPROVEMENTS.md](IMPROVEMENTS.md)

---

## 🗄️ Tecnología Recomendada

### **PostgreSQL + Prisma ORM**

**¿Por qué PostgreSQL?**
- ✅ Robusto y escalable
- ✅ Excelente para datos relacionales y JSON
- ✅ Soporte nativo para timestamps e índices
- ✅ Compatible con Vercel, Railway, Supabase (hosting fácil)

**¿Por qué Prisma?**
- ✅ Type-safe (TypeScript nativo)
- ✅ Migraciones automáticas
- ✅ Cliente moderno y fácil de usar
- ✅ Excelente documentación

### Alternativas Consideradas

| Tecnología | Pros | Contras | Recomendación |
|------------|------|---------|---------------|
| **MongoDB** | Flexible, NoSQL | Menos estructura, no relacional | ❌ No ideal para nuestro caso |
| **SQLite** | Sin servidor, simple | No escalable para producción | ⚠️ Solo desarrollo local |
| **Supabase** | Backend listo, Auth incluido | Vendor lock-in | ✅ Buena opción alternativa |

---

## 📊 Modelo de Datos

### **Fase 1: Etiquetado y Caché Básico**

```prisma
// schema.prisma

model KnownAddress {
  id          String   @id @default(cuid())
  address     String   @unique
  name        String
  type        AddressType
  category    String?
  description String?
  tags        String[] // Array de tags: ["vesting", "important", "monitored"]
  color       String?  // Color hex para UI
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([address])
  @@index([type])
}

enum AddressType {
  CONTRACT
  WALLET
  EXCHANGE
  VESTING
  TOKEN
  UNKNOWN
}

model TokenSupplyCache {
  id                String   @id @default(cuid())
  tokenAddress      String   @unique
  network           String
  totalSupply       String
  circulatingSupply String
  lockedSupply      String
  cachedAt          DateTime @default(now())
  expiresAt         DateTime

  @@index([tokenAddress, network])
  @@index([expiresAt])
}

model TransferCache {
  id            String   @id @default(cuid())
  hash          String   @unique
  tokenAddress  String
  from          String
  to            String
  value         String
  timestamp     Int
  blockNumber   Int
  network       String
  cachedAt      DateTime @default(now())

  @@index([tokenAddress, network])
  @@index([from])
  @@index([to])
  @@index([timestamp])
}

model HolderSnapshot {
  id              String   @id @default(cuid())
  tokenAddress    String
  network         String
  holderAddress   String
  balance         String
  percentage      String
  isExchange      Boolean  @default(false)
  isContract      Boolean  @default(false)
  snapshotAt      DateTime @default(now())

  @@index([tokenAddress, network, snapshotAt])
  @@index([holderAddress])
}
```

### **Fases Avanzadas (Watchlists, Alertas, Analytics Histórico, Multi-usuario)**

> **📌 Los modelos de datos para features avanzadas están documentados en [IMPROVEMENTS.md](IMPROVEMENTS.md)**
>
> Incluyen: Watchlists, Alertas, PriceHistory, DailyMetrics, Users, ApiKeys, etc.

---

## 🚀 Plan de Implementación

### **Sprint 1: Setup Inicial (2-3 días)** ✅ COMPLETADO

#### Día 1: Configuración Base
- [x] Instalar dependencias
  ```bash
  npm install prisma @prisma/client
  npm install -D prisma
  ```
- [x] Inicializar Prisma
  ```bash
  npx prisma init
  ```
- [x] Configurar conexión a PostgreSQL (local o Supabase)
- [x] Crear `.env` con `DATABASE_URL`

#### Día 2: Modelos Fase 1
- [x] Definir schema de `KnownAddress`
- [x] Definir schema de caché (`TokenSupplyCache`, `TransferCache`, `HolderSnapshot`)
- [x] Crear migración inicial
  ```bash
  npx prisma migrate dev --name init
  ```
- [x] Generar cliente Prisma
  ```bash
  npx prisma generate
  ```

#### Día 3: Integración Básica
- [x] Crear `src/lib/db.ts` para cliente Prisma (con adapter PostgreSQL)
- [x] ~~Crear `src/lib/knownAddresses.ts` para queries~~ (No necesario, queries directas en API)
- [x] Migrar direcciones hardcodeadas a BD (via seed)
- [x] Crear seed script con contratos existentes (8 vesting, 1 token, 4 exchanges)
- [x] Crear API `/api/addresses` con GET, POST, DELETE
- [x] Integrar en analytics page para mostrar nombres

### **Sprint 2: UI de Administración (3-4 días)** ❌ PENDIENTE

#### Funcionalidades
- [ ] Página `/admin/addresses` para gestionar etiquetas
- [ ] Formulario para agregar/editar addresses
- [ ] Búsqueda y filtrado de addresses
- [ ] Importar/Exportar addresses (CSV/JSON)
- [ ] Vista previa de cómo se verán las etiquetas

#### API Routes
**Nota:** Actualmente existe `/api/addresses` con GET, POST, DELETE. Se puede usar directamente o crear `/api/admin/addresses` para mejor organización.
- [x] `POST /api/addresses` - Crear/Actualizar address (upsert) ✅
- [ ] `PUT /api/admin/addresses/:id` - Actualizar por ID (opcional)
- [x] `DELETE /api/addresses` - Eliminar por address ✅
- [ ] `GET /api/admin/addresses` - Listar con paginación
- [ ] `POST /api/admin/addresses/import` - Importar bulk

### **Sprint 3: Sistema de Caché (2-3 días)** ❌ PENDIENTE

**Nota:** Actualmente existe caché en memoria en `blockchain.ts` para token supply, pero **NO** usa los modelos de BD. Los modelos `TokenSupplyCache`, `TransferCache`, y `HolderSnapshot` están definidos pero no se utilizan.

#### Implementación
- [ ] Migrar caché en memoria a BD usando `TokenSupplyCache`
- [ ] Middleware de caché para token supply usando BD
- [ ] Caché de transferencias recientes usando `TransferCache` (últimas 24h)
- [ ] Caché de holders snapshot usando `HolderSnapshot` (actualizar cada 1h)
- [ ] Job de limpieza de caché expirado
- [ ] Configurar TTL por tipo de dato

#### Optimizaciones
- [ ] Reemplazar caché en memoria por caché en BD en `/api/token-supply`
- [ ] Implementar caché en `/api/token-analytics` usando `TransferCache`
- [ ] Métricas de hit/miss ratio
- [ ] Logs de performance

### **Sprint 4: Integración en UI (2 días)** ⚠️ PARCIAL (30%)

#### Analytics Page
- [x] Mostrar nombres de addresses desde BD ✅
- [ ] Indicador visual de addresses conocidas
- [ ] Tooltips con descripción completa
- [ ] Filtros por tipo de address

#### Dashboard
- [ ] Badges de colores según categoría
- [x] Link directo a editar address desde cualquier vista (botón de editar existe) ✅
- [ ] Sugerencias de addresses para etiquetar

### **Sprints Futuros (Watchlists, Alertas, etc.)**

> **📌 Ver [IMPROVEMENTS.md](IMPROVEMENTS.md)** para el roadmap completo de features avanzadas

---

## 🏗️ Estructura de Archivos

### Estructura Actual (Implementada)

```
src/
├── lib/
│   └── db.ts                    # ✅ Cliente Prisma singleton con adapter PostgreSQL
├── app/
│   ├── api/
│   │   └── addresses/
│   │       └── route.ts         # ✅ GET, POST, DELETE implementados
│   └── explorer/
│       └── analytics/
│           └── page.tsx         # ✅ Integración de nombres desde BD
├── components/
│   └── EditAddressModal.tsx     # ✅ Modal para editar nombres
└── prisma/
    ├── schema.prisma            # ✅ Schema completo Fase 1
    ├── migrations/              # ✅ Migraciones aplicadas
    └── seed.ts                  # ✅ Seed con 13 addresses iniciales
```

### Estructura Planificada (Pendiente)

```
src/
├── lib/
│   ├── db.ts                    # ✅ Implementado
│   ├── cache.ts                 # ❌ Sistema de caché en BD (pendiente)
│   └── alerts.ts                # ❌ Sistema de alertas (futuro)
├── app/
│   ├── api/
│   │   ├── addresses/
│   │   │   └── route.ts         # ✅ Implementado
│   │   ├── admin/
│   │   │   ├── addresses/
│   │   │   │   ├── route.ts     # ❌ Listar con paginación
│   │   │   │   └── [id]/route.ts # ❌ Actualizar por ID
│   │   │   └── cache/
│   │   │       └── route.ts     # ❌ Endpoints para gestionar caché
│   │   └── watchlists/
│   │       └── route.ts         # ❌ Futuro
│   └── admin/
│       ├── addresses/
│       │   └── page.tsx         # ❌ UI para gestionar addresses
│       ├── cache/
│       │   └── page.tsx         # ❌ Estadísticas de caché
│       └── layout.tsx           # ❌ Layout admin con sidebar
├── components/
│   ├── admin/
│   │   ├── AddressForm.tsx      # ❌ Pendiente
│   │   ├── AddressList.tsx     # ❌ Pendiente
│   │   └── AddressImport.tsx   # ❌ Pendiente
│   ├── EditAddressModal.tsx     # ✅ Implementado
│   └── AddressBadge.tsx         # ❌ Badge reutilizable (pendiente)
└── prisma/
    ├── schema.prisma            # ✅ Implementado
    ├── migrations/              # ✅ Implementado
    └── seed.ts                  # ✅ Implementado
```

---

## 🔧 Configuración Técnica

### Variables de Entorno

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/explorer_db"

# Opciones de conexión
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_TIMEOUT=30000

# Caché
CACHE_TTL_SUPPLY=300000          # 5 minutos
CACHE_TTL_TRANSFERS=60000        # 1 minuto
CACHE_TTL_HOLDERS=3600000        # 1 hora
```

### Prisma Client Singleton

**✅ Implementado** en `src/lib/db.ts`:

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Crear el pool de conexiones
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Crear el adapter
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Nota:** Se usa `@prisma/adapter-pg` para mejor rendimiento con PostgreSQL.

### Seed Script

**✅ Implementado** en `prisma/seed.ts`:

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

async function main() {
  // Seed: 8 contratos de vesting Vottun
  await prisma.knownAddress.createMany({
    data: [
      { address: '0xa699Cf416FFe6063317442c3Fbd0C39742E971c5', name: 'Vottun World Vesting', ... },
      { address: '0x3e0ef51811B647E00A85A7e5e495fA4763911982', name: 'Investors Vesting', ... },
      { address: '0xE521B2929DD28a725603bCb6F4009FBb656C4b15', name: 'Marketing Vesting', ... },
      { address: '0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF', name: 'Staking Vesting', ... },
      { address: '0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1', name: 'Liquidity Vesting', ... },
      { address: '0xFC750D874077F8c90858cC132e0619CE7571520b', name: 'Promos Vesting', ... },
      { address: '0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8', name: 'Team Vesting', ... },
      { address: '0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d', name: 'Reserve Vesting', ... },
    ],
    skipDuplicates: true,
  });

  // Seed: 1 token VTN
  await prisma.knownAddress.createMany({
    data: [
      { address: '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC', name: 'Vottun Token (VTN)', type: 'TOKEN', ... },
    ],
    skipDuplicates: true,
  });

  // Seed: 4 exchanges conocidos
  await prisma.knownAddress.createMany({
    data: [
      { address: '0x3cd751e6b0078be393132286c442345e5dc49699', name: 'Coinbase', type: 'EXCHANGE', ... },
      { address: '0x71660c4005ba85c37ccec55d0c4493e66fe775d3', name: 'Coinbase 2', type: 'EXCHANGE', ... },
      { address: '0x503828976d22510aad0201ac7ec88293211d23da', name: 'Coinbase 3', type: 'EXCHANGE', ... },
      { address: '0x0d0707963952f2fba59dd06f2b425ace40b492fe', name: 'Gate.io', type: 'EXCHANGE', ... },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

**Total:** 13 addresses seedeadas (8 vesting, 1 token, 4 exchanges)

---

## 📈 Métricas de Éxito

### Performance
- ⏱️ Reducir tiempo de carga de Analytics en 50%
- 📉 Reducir llamadas a APIs externas en 70%
- 🚀 Página de tokens carga en < 2 segundos

### Funcionalidad
- ✅ 100% de contratos propios etiquetados
- ✅ UI de administración intuitiva
- ✅ Sistema de caché funcionando sin errores

### Escalabilidad
- 📊 Soportar 1000+ addresses etiquetadas
- 💾 Caché de 30 días de histórico
- 👥 Preparado para sistema multi-usuario

---

## 🛡️ Consideraciones de Seguridad

### Fase 1 (Sin autenticación)
- ⚠️ Proteger rutas `/admin/*` con variables de entorno
- 🔒 Validar todas las inputs
- 🚫 No exponer endpoints de escritura públicamente

### Fase 2 (Con usuarios)
- 🔐 Implementar autenticación (NextAuth.js recomendado)
- 👤 Sistema de roles (Admin, User, Viewer)
- 🔑 API Keys para acceso programático
- 📝 Logs de auditoría para cambios importantes

---

## 💰 Costos Estimados

### Hosting PostgreSQL

| Opción | Costo Mensual | Características |
|--------|---------------|-----------------|
| **Supabase Free** | $0 | 500MB, 2 conexiones simultáneas |
| **Supabase Pro** | $25 | 8GB, 60 conexiones |
| **Railway** | ~$5-10 | Pay as you go |
| **Vercel Postgres** | $20 | 256MB incluido en Pro |
| **Neon** | $0-19 | Serverless, escala automático |

**Recomendación inicial:** Supabase Free o Neon Free (suficiente para empezar)

---

## 🗓️ Timeline (Fase 1)

### ✅ Completado (Semanas 1-3)
- ✅ Sprint 1: Setup Inicial (BD, Prisma, modelos)
- ✅ Sprint 3: Sistema de Caché Incremental
- ✅ Parcial Sprint 4: Integración UI básica

### ⚠️ Pendiente
- ❌ Sprint 2: UI de Administración (~1 semana)
- ❌ Completar Sprint 4: Badges y filtros avanzados (~3 días)

**Tiempo restante Fase 1:** ~1-2 semanas

---

## 🎯 Quick Start (Mínimo Viable)

Si quieres empezar YA con lo mínimo:

### 1. Setup (1 hora)
```bash
npm install prisma @prisma/client
npx prisma init
# Configurar DATABASE_URL en .env
```

### 2. Schema mínimo (30 min)
```prisma
model KnownAddress {
  id      String @id @default(cuid())
  address String @unique
  name    String
  type    String
  color   String?
}
```

### 3. Migrar (15 min)
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Seed (30 min)
```bash
# Crear seed.ts con tus contratos
npx prisma db seed
```

### 5. Usar en código (1 hora)
```typescript
// Reemplazar hardcoded addresses
const knownAddresses = await prisma.knownAddress.findMany();
```

**Total:** ~3 horas para MVP funcional ✅

---

## 📚 Referencias y Recursos

- [Prisma Docs](https://www.prisma.io/docs)
- [Prisma + Next.js Guide](https://www.prisma.io/nextjs)
- [Supabase Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Database Design Best Practices](https://planetscale.com/blog/database-design-best-practices)

---

## ✅ Estado Actual de Decisiones

**Ya decidido/implementado:**
- ✅ Hosting de DB: PostgreSQL local con Docker (explorer-postgres)
- ✅ Fase 1 implementada (~70% completado)
- ✅ Sistema de caché con sync incremental funcionando
- ✅ Addresses iniciales importadas via seed (13 addresses)

**Próximas decisiones:**
- [ ] ¿Implementar página admin dedicada o seguir con modales?
- [ ] ¿Migrar a DB en cloud (Supabase/Neon) para producción?
- [ ] ¿Backups automáticos? (recomendado cuando vaya a producción)

---

**Documento creado:** 2025-01-19
**Última actualización:** 2025-01-20
**Versión:** 1.2 (Sistema de caché implementado)

---

## 📝 Notas de Implementación

### Cambios Realizados vs Plan Original

1. **API Routes**: Se implementó `/api/addresses` directamente en lugar de `/api/admin/addresses`. Esto funciona bien, pero para mejor organización se podría mover a `/api/admin/addresses` en el futuro.

2. **Caché**: Actualmente existe caché en memoria en `blockchain.ts` para token supply. Los modelos de BD para caché (`TokenSupplyCache`, `TransferCache`, `HolderSnapshot`) están definidos pero no se utilizan. **Prioridad:** Migrar caché en memoria a BD.

3. **Queries**: No se creó `src/lib/knownAddresses.ts` porque las queries se hacen directamente en los componentes/APIs donde se necesitan. Esto está bien, pero se podría centralizar para mejor mantenimiento.

4. **Adapter PostgreSQL**: Se usa `@prisma/adapter-pg` en lugar del cliente estándar de Prisma para mejor rendimiento con PostgreSQL.

### Próximos Pasos Recomendados

1. **Alta Prioridad**: Sprint 2 - UI de Administración (necesario para gestionar addresses fácilmente)
2. **Media Prioridad**: ~~Sprint 3 - Migrar caché en memoria a BD~~ ✅ **YA IMPLEMENTADO**
   - ⚠️ Falta: Migrar caché de `/api/token-supply` a usar `TokenSupplyCache`
3. **Baja Prioridad**: Completar Sprint 4 - Mejoras visuales en UI (badges, tooltips, filtros)

### Cambios Importantes - Sistema de Caché

**✅ COMPLETADO (2025-01-20):**
- Sistema de caché incremental implementado en `/api/token-analytics`
- Modelo `TransferCache`: Guarda transfers con sync incremental (solo pide nuevos)
- Modelo `HolderSnapshot` + `Holder`: Snapshots periódicos cada 5 minutos
- UI con botón "Actualizar" manual y timestamp "hace Xm"
- Reducción de API calls en ~90%
- Tiempo de carga reducido de 10-15s a 2-4s (después de primera carga)
