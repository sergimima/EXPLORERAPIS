# Settings Architecture

**Última actualización:** 2025-02-04
**Objetivo:** Arquitectura de páginas de settings con sidebar y rutas separadas

---

## Estructura de Rutas

```
/settings/tokens/[id]/
├── layout.tsx                    → Sidebar compartido + header con token info
├── page.tsx                      → Redirect a /general
├── general/page.tsx              → Analytics settings + Exchange addresses
├── api-keys/page.tsx             → Custom API keys (BaseScan, Etherscan, Moralis, QuikNode)
├── supply/page.tsx               → Supply configuration (API vs ONCHAIN)
├── abi/page.tsx                  → Token ABI principal (Standard vs Custom)
└── contracts/page.tsx            → Lista de contratos + ABIs por contrato
```

---

## Layout Compartido (`layout.tsx`)

**Elementos:**
- Sidebar izquierdo fijo con navegación
- Header superior con:
  - Token avatar (círculo con iniciales)
  - Símbolo y nombre del token
  - Botón "← Volver"
- Contenido principal (children)

**Navegación del Sidebar:**
1. General (⚙️)
2. API Keys (🔑)
3. Supply (📊)
4. Token ABI (📄)
5. Contratos (📦)

**Indicador visual:** Highlight del item activo basado en pathname

---

## Páginas Individuales

### 1. General (`/general`)
- Analytics Settings:
  - Whale threshold
  - Cache duration
  - Max transfers to fetch
- Exchange Addresses (textarea, una por línea)
- Botón "Guardar Cambios"

### 2. API Keys (`/api-keys`)
- 4 inputs tipo password:
  - BaseScan API Key (link: basescan.org/apis)
  - Etherscan API Key
  - Moralis API Key (link: moralis.io)
  - QuikNode URL (link: quicknode.com)
- Placeholder: "Si está vacío, usa la key del platform"
- Botón "Guardar Cambios"

### 3. Supply (`/supply`)
- Radio buttons: API vs ONCHAIN
- Si API:
  - Input: URL Total Supply
  - Input: URL Circulating Supply
  - Info: "Legacy fallback a Vottun API"
- Si ONCHAIN:
  - Info: "Se calcula con totalSupply() del contrato"
- Botón "Guardar Cambios"

### 4. Token ABI (`/abi`)
- Radio buttons: Standard vs Custom
- Si Custom:
  - Botón "Auto-detectar desde BaseScan"
  - Textarea JSON (10 rows)
  - Botón "Guardar ABI"
  - Info del ABI actual (source, updatedAt)
  - Botón "Volver a Estándar"
- Preview de métodos detectados

### 5. Contratos (`/contracts`)
- Header con botón "+ Agregar Contrato"
- Lista de contratos (cards):
  - Nombre, address, network, category, status
  - ABI status (✓ configurado / ⚠ sin ABI)
  - Acciones:
    - Ver ABI (modal)
    - Copiar ABI
    - Auto-detectar ABI (si no tiene)
    - Eliminar ABI
    - Activar/Desactivar contrato
    - Eliminar contrato
- Form para agregar:
  - Nombre, Address, Network, Category (dropdown con enum), Descripción
- Modal para ver ABI completo (fullscreen, copiable)

---

## API Endpoints Usados

- `GET /api/tokens/[id]` → Token info
- `GET/PUT /api/tokens/[id]/settings` → Settings CRUD
- `GET/POST/DELETE /api/tokens/[id]/abi` → Token ABI principal
- `GET/POST /api/tokens/[id]/abis` → ABIs multi-contrato
- `GET/POST/PATCH/DELETE /api/tokens/[id]/vesting-contracts` → Contracts CRUD

---

## Estado y Fetching

**Cada página gestiona su propio estado:**
- Fetch individual en `useEffect`
- Botón "Guardar" por página (no global)
- Loading states independientes
- No estado compartido entre páginas

**Ventajas:**
- Performance: solo carga lo necesario
- Mantenible: cada página es independiente
- Escalable: agregar páginas no afecta existentes

---

## Permisos Futuros (Sprint 2.5+)

**Middleware por ruta:**
- `/general` → MEMBER+
- `/api-keys` → ADMIN+ (sensitive)
- `/supply` → ADMIN+
- `/abi` → ADMIN+
- `/contracts` → MEMBER+ (lectura), ADMIN+ (escritura)

---

## Estilo y UX

**Sidebar:**
- Width: 240px fijo
- Background: bg-gray-50
- Items: hover:bg-gray-100
- Active: bg-blue-50 text-blue-700 border-l-4 border-blue-700

**Layout:**
- Sidebar + Content (flex)
- Content: max-w-4xl mx-auto p-6
- Cards: bg-white shadow rounded-lg p-6
- Spacing: space-y-6 entre secciones

**Responsive:**
- Desktop: sidebar siempre visible
- Mobile: sidebar colapsable (hamburger) - implementar en futuro

---

## Migración desde página actual

**Pasos:**
1. Crear layout.tsx con sidebar
2. Mover secciones a páginas individuales:
   - Analytics + Exchanges → general/page.tsx
   - API Keys → api-keys/page.tsx
   - Supply → supply/page.tsx
   - Token ABI → abi/page.tsx
   - Contratos + ABIs → contracts/page.tsx
3. Extraer lógica común a hooks (useToken, useTokenSettings)
4. Testing de navegación y deep links
5. Eliminar página antigua

**Componentes reutilizables a crear:**
- `<TokenHeader />` → Avatar + info
- `<SettingsCard />` → Wrapper con título
- `<SaveButton />` → Botón guardar con loading
- `<AbiModal />` → Modal para ver ABI completo

---

## Futuras Expansiones

**Páginas a agregar:**
- `/webhooks` → Webhook configuration + logs
- `/alerts` → Custom alerts (Telegram, Email, Discord)
- `/integrations` → Third-party integrations (OAuth)
- `/analytics` → Advanced analytics settings
- `/team` → Compartir token con miembros (permisos)
- `/danger-zone` → Eliminar token, transferir ownership

---

**Versión:** 1.0
**Status:** ✅ Implementado (2025-02-04)

**Archivos creados:**
- `src/app/settings/tokens/[id]/layout.tsx` - Sidebar + Header
- `src/app/settings/tokens/[id]/page.tsx` - Redirect a /general
- `src/app/settings/tokens/[id]/general/page.tsx` - Analytics + Exchanges
- `src/app/settings/tokens/[id]/api-keys/page.tsx` - Custom API Keys
- `src/app/settings/tokens/[id]/supply/page.tsx` - Supply configuration
- `src/app/settings/tokens/[id]/abi/page.tsx` - Token ABI
- `src/app/settings/tokens/[id]/contracts/page.tsx` - Contracts + ABIs
