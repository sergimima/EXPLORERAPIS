# 🔧 Panel de Administración SUPER_ADMIN

**Fecha:** 2025-02-05
**Versión:** 2.0
**Estado:** ✅ COMPLETADO Y FUNCIONAL

---

## 📋 Resumen

Panel `/admin/*` exclusivo para usuarios con rol `SUPER_ADMIN` que permite:
- Ver y gestionar todas las organizaciones del sistema
- Crear y configurar planes con límites personalizables
- Asignar planes manualmente a organizaciones
- Configurar API keys globales (sin tocar .env)
- Ver métricas globales del SaaS (MRR, distribución de planes, stats)

---

## 🗄️ Base de Datos

### Modelos Principales

**Plan** - Planes configurables por SUPER_ADMIN
- Campos: name, slug, price, currency, stripePriceId
- Límites: tokensLimit, apiCallsLimit, transfersLimit, membersLimit
- Features: features (JSON), isActive, isPublic, sortOrder

**SystemSettings** - Configuración global (singleton)
- API Keys: defaultBasescanApiKey, defaultEtherscanApiKey, defaultMoralisApiKey, defaultQuiknodeUrl
- Email: resendApiKey, resendFromEmail
- Stripe: stripePublicKey, stripeSecretKey
- General: appName, appUrl, supportEmail

**Subscription** - Actualizado con:
- `planId` (FK a Plan)
- `transfersLimit`, `membersLimit`

---

## 🎨 Estructura del Panel

```
/admin/
├── dashboard/          # Métricas globales (MRR, orgs, users, gráficos)
├── organizations/      # Lista + detalle de organizaciones
│   └── [id]/          # Detalle: info, plan, miembros, tokens, métricas
├── plans/             # CRUD de planes con drag & drop
├── settings/          # Config global (API keys, email, Stripe, general)
└── layout.tsx         # Sidebar con navegación
```

---

## ✅ Estado de Implementación

### Sprint 4.1: Base de Datos ✅
- Modelos Plan, SystemSettings creados
- Subscription actualizado (planId, transfersLimit, membersLimit)
- Usuario SUPER_ADMIN: superadmin@tokenlens.com / super123
- 3 planes por defecto: Free ($0), Pro ($29), Enterprise ($99)

### Sprint 4.2: APIs ✅
- `GET/POST /api/admin/plans` - CRUD de planes
- `GET/PUT/DELETE /api/admin/plans/[id]` - Individual
- `POST /api/admin/plans/reorder` - Drag & drop order
- `GET /api/admin/organizations` - Lista con stats
- `GET/PATCH /api/admin/organizations/[id]` - Detalle + asignar plan
- `GET/PUT /api/admin/settings` - Config global
- `GET /api/admin/stats` - Datos para gráficos
- `POST /api/admin/stripe/webhook` - Stub para futuro

### Sprint 4.3: UI Panel Admin ✅
- **Dashboard**: 4 cards métricas + 3 gráficos (Recharts) + distribución planes + orgs recientes
- **Organizations List**: Tabla con filtros (nombre, plan, estado) + búsqueda con debounce
- **Organization Detail**: Info general, cambiar plan, progress bars (uso vs límites), lista miembros, lista tokens, métricas cards, **indicador custom API keys**
- **Plans**: Grid con drag & drop (@dnd-kit), formulario inline crear/editar, delete con validación
- **Settings**: 4 tabs (API Keys, Email, Stripe, General) con todos los campos

### Sprint 4.4: Navbar + Protección ✅
- Link "Admin" en navbar (solo visible para SUPER_ADMIN)
- Middleware protege `/admin/*` (solo SUPER_ADMIN)
- Redirect automático post-login según rol

### Sprint 4.5: Validación de Límites ✅
- `src/lib/limits.ts` con helpers
- Integrado en `/api/tokens` (bloquea si alcanza límite)
- Integrado en `/api/organizations/invite` (bloquea si alcanza límite)
- Integrado en `/api/token-analytics` (contador API calls)
- Mensajes claros para upgrades

### Sprint 4.6: Fixes y Mejoras ✅
1. **Login Redirect Fix**: SignInForm ahora detecta rol SUPER_ADMIN con useSession y redirige correctamente
2. **Next.js 15 Async Params**: Actualizado `context.params` en routes dinámicas
3. **Custom API Keys Indicator**: Badge "🔑 Custom APIs" en org detail que muestra qué servicios están configurados (BaseScan, Etherscan, Moralis, QuikNode)
4. **Organization Detail Completo**: Progress bars, lista miembros completa, tokens con detalles, métricas cards

---

## 🔑 Acceso

**Credenciales SUPER_ADMIN:**
- Email: `superadmin@tokenlens.com`
- Password: `super123`

**URLs:**
- Dashboard: http://localhost:4200/admin/dashboard
- Organizaciones: http://localhost:4200/admin/organizations
- Planes: http://localhost:4200/admin/plans
- Settings: http://localhost:4200/admin/settings

---

## 🚀 Características Destacadas

✅ **Dashboard completo** con MRR, stats, gráficos históricos (12 meses)
✅ **Gestión de planes** con límites configurables (-1 = ilimitado)
✅ **Drag & drop** para reordenar planes
✅ **Custom API keys por token** con indicador visual en admin panel
✅ **Validación de límites** en tiempo real (tokens, members, API calls)
✅ **SystemSettings en BD** (no más hardcoded en .env)
✅ **Gráficos interactivos** (Recharts) - nuevas orgs, cancelaciones, MRR evolution
✅ **Filtros y búsqueda** en lista de organizaciones
✅ **Progress bars** de uso vs límites por organización

---

## 📝 Notas de Implementación

- **Protección**: Todas las rutas `/admin/*` requieren rol `SUPER_ADMIN`
- **Auth Helper**: `requireSuperAdmin()` en todas las APIs admin
- **Multi-tenant**: Custom API keys por token (TokenSettings) tienen prioridad sobre SystemSettings
- **Límites**: Plan con `-1` = ilimitado, valores normales = hard limit
- **Soft Limit**: API calls incrementa contador pero no bloquea (solo warnings)
- **Hard Limit**: Tokens y Members bloquean creación/invitación al alcanzar límite

---

## ✅ Sprint 4.7: Mejoras UX (COMPLETADO - 2025-02-05)

**1. Indicador Custom APIs en lista de organizaciones:**
- Nueva columna "APIs" en tabla `/admin/organizations`
- Icono 🔑 visible si algún token de la org tiene custom API keys
- Detección automática en la API (customBasescanApiKey, customEtherscanApiKey, customMoralisApiKey, customQuiknodeUrl)
- Permite ver de un vistazo qué orgs usan sus propias keys sin entrar al detalle

**2. Alertas en Dashboard:**
- Sección de alertas al final del dashboard que muestra orgs cerca de límites (≥80%)
- 3 tipos de alertas: Tokens 🪙, API Calls 📡, Members 👥
- Color coding por severidad:
  - Amarillo (80-89%): Advertencia
  - Rojo (90%+): Crítico
- Cada alerta muestra:
  - Nombre de la org
  - Tipo de recurso
  - Uso actual vs límite (ej: 4 / 5)
  - Porcentaje de uso
  - Link directo al detalle de la org
- Tip al final: "Contacta a estas organizaciones para ofrecer un upgrade"

**Beneficio:** Permite detectar problemas proactivamente y ofrecer upgrades antes de que los clientes alcancen límites.

---

## ✅ Sprint 4.8: Gestión de Usuarios (COMPLETADO - 2025-02-05)

**Nueva página `/admin/users`:**
- Lista global de todos los usuarios del sistema
- Stats cards: Total usuarios, Super Admins, Admins, Members
- Filtros: búsqueda por email/nombre, filtro por rol
- Tabla con columnas:
  - Email y nombre
  - Rol con color coding (SUPER_ADMIN rojo, ADMIN amarillo, MEMBER azul, VIEWER gris)
  - Count de organizaciones (miembro)
  - Count de organizaciones (owner) en verde
  - Fecha de creación
  - Estado de verificación de email (✓ verde si verificado)
- Hover tooltips mostrando nombres de organizaciones
- Link agregado al sidebar del admin panel

**API `/api/admin/users`:**
- GET con filtros por rol y búsqueda
- Incluye memberships y owned organizations
- Stats: total, por rol, sin organizaciones, verificados
- Formato compatible con la UI

**Beneficio:** Vista global de usuarios, identificar usuarios sin organizaciones, ver distribución de roles, detectar problemas de acceso.

---

**Última actualización:** 2025-02-05 02:30
**Sprints Completados:** 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
**Estado:** 🎉 **100% FUNCIONAL + GESTIÓN COMPLETA**


Prioridad	Mejora	Esfuerzo	Estado
Alta	Alertas en dashboard	Medio	✅ Completado (4.7)
Alta	Mostrar 10 orgs recientes	Muy bajo	❌ No implementado
Alta	Indicador Custom APIs en lista orgs	Bajo	✅ Completado (4.7)
Media	/admin/users	Medio	✅ Completado (4.8)
Media	Paginación/orden en lista orgs	Bajo
Media	Historial de cambios de plan	Medio
Baja	Exportar CSV	Medio
Baja	Bulk actions	Medio