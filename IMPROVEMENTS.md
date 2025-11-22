# 🚀 Plan de Mejoras y Escalabilidad

**Proyecto:** Blockchain Explorer API - Base Network
**Fecha:** 2025-01-21
**Estado Actual:** MVP funcional con caché incremental, analytics avanzados, y liquidez multi-DEX

---

## 📋 Tabla de Contenidos

1. [Performance & Caché](#1-performance--caché)
2. [Panel de Administración](#2-panel-de-administración)
3. [Sistema de Alertas](#3-sistema-de-alertas)
4. [Búsqueda y Filtros Avanzados](#4-búsqueda-y-filtros-avanzados)
5. [Gráficos y Visualizaciones](#5-gráficos-y-visualizaciones)
6. [Multi-Token Support](#6-multi-token-support)
7. [API Pública](#7-api-pública)
8. [Sistema Multi-Usuario](#8-sistema-multi-usuario)
9. [Mobile App / PWA](#9-mobile-app--pwa)
10. [Inteligencia Artificial](#10-inteligencia-artificial)

---

## 1. Performance & Caché ✅ **IMPLEMENTADO**

### 🎯 Objetivo
Reducir tiempo de carga de Analytics de 10-15 segundos a <2 segundos y minimizar llamadas a APIs externas.

**Estado:** ✅ Completado - Sistema de caché incremental implementado

### 📊 Problema Actual
- Cada carga de Analytics hace múltiples llamadas API:
  - Moralis: Top holders (50 addresses)
  - Etherscan V2: Historial de transferencias (10,000 tx)
  - QuikNode: Precio actual
  - DEX Screener: Liquidez
  - RPC: Verificación de contratos (50+ llamadas)
- Total: ~60-100 llamadas por página
- Tiempo de carga: 10-15 segundos
- Rate limits: Riesgo de bloqueo

### ✅ Solución Propuesta (ACTUALIZADA)

#### Estrategia de Caché Inteligente (2-3 horas implementación)

**Principio: "Sync Incremental" - Solo pedir datos nuevos**

---

#### **A. Transfers - Sync Incremental**

**Problema actual:**
- Cada carga llama API para TODOS los transfers históricos
- Desperdicio de tiempo y rate limits

**Solución:**
```typescript
// 1. Primera carga (BD vacía)
- API: Obtener TODOS los transfers históricos
- Guardar en TransferCache con timestamp
- Total: ~10 segundos

// 2. Cargas siguientes (BD con datos)
- BD: Leer TODOS los transfers guardados (200-500ms)
- Encontrar timestamp del transfer más reciente
- API: Obtener SOLO transfers nuevos desde ese timestamp
- Agregar los nuevos a BD
- Mostrar todo junto

// 3. Con botón "Actualizar"
- Mismo proceso: lee BD + fetch nuevos
- Usuario controla cuándo quiere datos frescos
```

**Implementación:**
```typescript
// src/app/api/token-analytics/route.ts
export async function GET(request: NextRequest) {
  const tokenAddress = searchParams.get('tokenAddress');

  // 1. Leer transfers guardados
  const cachedTransfers = await prisma.transferCache.findMany({
    where: { tokenAddress: tokenAddress.toLowerCase() },
    orderBy: { timestamp: 'asc' }
  });

  // 2. Encontrar último timestamp
  const lastTimestamp = cachedTransfers.length > 0
    ? cachedTransfers[cachedTransfers.length - 1].timestamp
    : 0;

  // 3. Fetch solo nuevos desde API
  const newTransfers = await fetchTransfersFromAPI({
    tokenAddress,
    startBlock: timestampToBlock(lastTimestamp),
    endBlock: 'latest'
  });

  // 4. Guardar nuevos en BD
  if (newTransfers.length > 0) {
    await prisma.transferCache.createMany({
      data: newTransfers.map(t => ({
        tokenAddress: tokenAddress.toLowerCase(),
        from: t.from.toLowerCase(),
        to: t.to.toLowerCase(),
        value: t.value,
        hash: t.hash,
        timestamp: t.timestamp,
        blockNumber: t.blockNumber
      })),
      skipDuplicates: true // Por si hay overlap
    });
  }

  // 5. Retornar todo junto
  return NextResponse.json({
    transfers: [...cachedTransfers, ...newTransfers],
    cached: cachedTransfers.length,
    new: newTransfers.length,
    lastUpdate: Date.now()
  });
}
```

**Ventajas:**
- ✅ Primera carga: 10s (normal)
- ✅ Siguientes: 1-2s (lee BD) + 1-2s (solo nuevos)
- ✅ Total: ~3s vs 10-15s actual
- ✅ Historial completo siempre disponible
- ✅ Nunca pides datos viejos dos veces
- ✅ Escalable: aunque haya 100k transfers, solo pides últimos 10

---

#### **B. Holders - Snapshots Periódicos**

**Problema actual:**
- Cada carga llama Moralis API para top 50 holders
- No hay historial de cómo cambian los holders

**Solución:**
```typescript
// Los holders cambian constantemente
// No tiene sentido "incremental"
// Mejor: guardar SNAPSHOTS cada X tiempo

// 1. Primera carga o snapshot viejo (>5 min)
- API: Obtener top 50 holders desde Moralis
- Guardar snapshot completo con timestamp
- Verificar cuáles son contratos (RPC)

// 2. Cargas dentro de 5 min
- BD: Retornar último snapshot
- Mostrar "Última actualización: hace 3m"

// 3. Con botón "Actualizar"
- Bypasea caché
- Fuerza nuevo snapshot desde API
- Usuario decide cuándo quiere datos frescos
```

**Implementación:**
```typescript
// src/app/api/token-analytics/route.ts
export async function GET(request: NextRequest) {
  const forceRefresh = searchParams.get('forceRefresh') === 'true';

  // 1. Buscar último snapshot
  const lastSnapshot = await prisma.holderSnapshot.findFirst({
    where: { tokenAddress: tokenAddress.toLowerCase() },
    orderBy: { timestamp: 'desc' },
    include: { holders: true }
  });

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  const isCacheValid = lastSnapshot &&
    (Date.now() - lastSnapshot.timestamp.getTime() < CACHE_DURATION);

  // 2. ¿Usar caché o fetch nuevo?
  if (isCacheValid && !forceRefresh) {
    return NextResponse.json({
      holders: lastSnapshot.holders,
      cached: true,
      age: Date.now() - lastSnapshot.timestamp.getTime()
    });
  }

  // 3. Fetch nuevo snapshot desde API
  const freshHolders = await fetchHoldersFromMoralis(tokenAddress);

  // 4. Verificar contratos en paralelo
  const holdersWithContractCheck = await Promise.all(
    freshHolders.map(async (h) => {
      const isContract = await checkIsContract(h.address);
      return { ...h, isContract };
    })
  );

  // 5. Guardar snapshot
  const snapshot = await prisma.holderSnapshot.create({
    data: {
      tokenAddress: tokenAddress.toLowerCase(),
      timestamp: new Date(),
      holders: {
        create: holdersWithContractCheck.map(h => ({
          address: h.address.toLowerCase(),
          balance: h.balance,
          percentage: h.percentage,
          isContract: h.isContract,
          isExchange: KNOWN_EXCHANGES.includes(h.address.toLowerCase())
        }))
      }
    },
    include: { holders: true }
  });

  return NextResponse.json({
    holders: snapshot.holders,
    cached: false,
    age: 0
  });
}
```

**Ventajas:**
- ✅ Carga instantánea si hay snapshot reciente (<5 min)
- ✅ Historial automático (ver cómo cambiaron holders)
- ✅ Usuario controla refresh con botón
- ✅ Reduce llamadas a Moralis (costosas)

---

#### **C. UI - Botón "Actualizar" y Timestamp**

**Componente Analytics:**
```typescript
// src/app/explorer/analytics/page.tsx
export default function AnalyticsPage() {
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async (forceRefresh = false) => {
    setIsRefreshing(true);

    const response = await fetch(
      `/api/token-analytics?tokenAddress=${TOKEN}&forceRefresh=${forceRefresh}`
    );
    const data = await response.json();

    setLastUpdate(Date.now());
    setIsRefreshing(false);
    // ... actualizar estado
  };

  return (
    <div>
      {/* Header con timestamp y botón */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">
          Última actualización: {formatTimeAgo(lastUpdate)}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="btn-primary"
        >
          {isRefreshing ? '🔄 Actualizando...' : '🔄 Actualizar'}
        </button>
      </div>

      {/* Resto de analytics */}
    </div>
  );
}

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `hace ${seconds}s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
  return `hace ${Math.floor(seconds / 86400)}d`;
}
```

---

#### **D. Schema de BD (ya existe, pequeños ajustes)**

```prisma
// prisma/schema.prisma

// Transfers incrementales
model TransferCache {
  id           String   @id @default(cuid())
  tokenAddress String
  from         String
  to           String
  value        String
  hash         String   @unique  // Para evitar duplicados
  timestamp    Int
  blockNumber  Int
  createdAt    DateTime @default(now())

  @@index([tokenAddress, timestamp])
  @@index([hash])
  @@map("transfer_cache")
}

// Snapshots de holders
model HolderSnapshot {
  id           String   @id @default(cuid())
  tokenAddress String
  timestamp    DateTime @default(now())
  holders      Holder[]

  @@index([tokenAddress, timestamp])
  @@map("holder_snapshots")
}

model Holder {
  id         String   @id @default(cuid())
  snapshotId String
  address    String
  balance    String
  percentage Float
  isContract Boolean  @default(false)
  isExchange Boolean  @default(false)

  snapshot   HolderSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@index([address])
  @@map("holders")
}
```

---

### **Resumen de la Estrategia**

| Dato | Estrategia | Caché | Actualización | Control |
|------|-----------|-------|---------------|---------|
| **Transfers** | Incremental | Permanente | Solo nuevos desde último timestamp | Botón manual |
| **Holders** | Snapshots | 5 minutos | Snapshot completo si expiró | Botón manual |
| **Precio** | Tiempo real | No | Cada request a API | N/A |
| **Liquidez** | Tiempo real | No | Cada request a API | N/A |

**Impacto:**
- ⚡ Carga: 10-15s → 2-4s (80% mejora)
- 💰 API calls: -90% (solo pides nuevos)
- 📊 Histórico completo automático
- 🎯 Control manual con botón "Actualizar"
- 📈 Preparado para análisis histórico (gráficos futuros)

#### Opción B: Caché FULL con Background Jobs (2-3 días)
**Agregar:**
- Cron job que actualiza cada 15 minutos
- Redis para caché en memoria (ultra rápido)
- Queue system (Bull/BullMQ) para procesar jobs
- Webhooks para notificaciones en tiempo real

**Impacto:**
- ⚡ Carga: <500ms siempre
- 🔄 Datos siempre frescos (max 15min atraso)
- 💪 Soporta miles de usuarios concurrentes

### 📈 Métricas de Éxito
- [ ] Página carga en <2 segundos (95% de las veces)
- [ ] Reducir API calls en 90%
- [ ] Costos de APIs: $0 (mantenerse en free tier)
- [ ] Tener 7 días de histórico en BD

### 🛠️ Tareas
- [ ] Implementar lógica de caché en `/api/token-analytics`
- [ ] Modificar frontend para mostrar "última actualización: X minutos"
- [ ] Agregar botón "Refrescar datos" manual
- [ ] Crear background job (opcional)
- [ ] Monitorear usage de APIs

### ⚠️ Consideraciones
- **Storage:** 1 snapshot/día = ~5KB → 1.8MB/año (mínimo)
- **Stale data:** Usuario puede ver datos de hace 6h (aceptable para analytics)
- **Complejidad:** Baja (usar tablas existentes)

---

## 2. Panel de Administración ✅ **IMPLEMENTADO**

### 🎯 Objetivo
Gestionar addresses etiquetadas de forma masiva y eficiente.

**Estado:** ✅ Panel completo con CRUD, importación CSV, exportación y estadísticas

### 📊 Problema Actual
- ✅ ~~Solo se puede editar una address a la vez (modal)~~
- ✅ ~~No hay vista general de todas las addresses etiquetadas~~
- ✅ ~~No hay forma de importar/exportar masivamente~~
- ✅ ~~No hay búsqueda o filtros~~

### ✅ Solución Propuesta **IMPLEMENTADO**

#### Nueva página: `/admin/addresses` ✅

**Features:**
```typescript
1. Tabla paginada con todas las addresses
   - Columnas: Address, Nombre, Tipo, Categoría, Tags, Creado
   - Ordenar por cualquier columna
   - Búsqueda por address o nombre
   - Filtros: tipo, categoría, tags

2. Acciones masivas
   - Editar múltiples addresses
   - Eliminar múltiples
   - Cambiar categoría en bulk
   - Agregar/quitar tags en bulk

3. Importar/Exportar
   - Importar CSV: address,name,type,category
   - Exportar todo a CSV/JSON
   - Template CSV para descargar

4. Estadísticas
   - Total de addresses etiquetadas
   - Breakdown por tipo (CEX: 4, Contratos: 15, Wallets: 200)
   - Addresses más vistas en Analytics
   - Última actualización
```

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│  📝 Gestión de Addresses                    [+ Nueva]  │
├─────────────────────────────────────────────────────────┤
│  🔍 Buscar: [_____________]  Tipo: [Todos ▼]           │
│                                                          │
│  ☑ Address              Nombre          Tipo    Acciones│
│  ☑ 0x3cd7...4699       Coinbase         CEX      ✏️ 🗑️  │
│  ☐ 0xa699...71c5       Vottun World     Vesting  ✏️ 🗑️  │
│  ☐ 0xA9bc...7abC       Vottun Token     Token    ✏️ 🗑️  │
│                                                          │
│  [2 seleccionados] Acciones: [Eliminar] [Editar]       │
│                                                          │
│  Página 1 de 5                            [< 1 2 3 >]   │
└─────────────────────────────────────────────────────────┘
```

#### Estructura de archivos:
```
src/app/admin/
├── layout.tsx              # Layout con sidebar admin
├── addresses/
│   ├── page.tsx           # Lista principal
│   ├── components/
│   │   ├── AddressTable.tsx
│   │   ├── AddressFilters.tsx
│   │   ├── BulkActions.tsx
│   │   └── ImportExport.tsx
│   └── [id]/
│       └── page.tsx       # Editar individual
└── dashboard/
    └── page.tsx           # Stats generales
```

### 📈 Métricas de Éxito
- [ ] Poder etiquetar 100 addresses en <5 minutos (vía CSV)
- [ ] Buscar cualquier address en <1 segundo
- [ ] Vista clara del estado actual (cuántas etiquetadas, etc.)

### 🛠️ Tareas
- [ ] Crear layout admin con sidebar
- [ ] Implementar tabla con paginación
- [ ] Agregar búsqueda y filtros
- [ ] Implementar importar CSV
- [ ] Implementar exportar CSV/JSON
- [ ] Agregar acciones masivas
- [ ] Proteger rutas admin (por ahora solo local)

### ⚠️ Consideraciones
- **Seguridad:** Por ahora solo localhost, luego agregar auth
- **Performance:** Paginación del lado servidor (100 por página)
- **UX:** Teclado shortcuts (Ctrl+K para buscar, etc.)

---

## 3. Sistema de Alertas

### 🎯 Objetivo
Notificaciones automáticas de eventos importantes on-chain.

### 📊 Estado Actual
- Sistema de alertas básico en Analytics (visual)
- No hay notificaciones push/email/telegram
- No son personalizables

### ✅ Solución Propuesta

#### Fase 1: Backend de Alertas

**Tablas ya definidas en schema:**
- `Alert` - Configuración de alertas
- `AlertHistory` - Historial de disparos

**Tipos de alertas:**
```typescript
enum AlertType {
  WHALE_MOVEMENT      // Transferencia > X tokens
  BALANCE_CHANGE      // Wallet aumentó/disminuyó > X%
  PRICE_CHANGE        // Precio cambió > X%
  HOLDER_CHANGE       // Top holder nuevo o salió
  EXCHANGE_FLOW       // Net flow a CEX > X tokens
  CUSTOM              // Condición personalizada
}
```

**Ejemplo de configuración:**
```json
{
  "type": "WHALE_MOVEMENT",
  "address": "*",  // Cualquier address
  "condition": {
    "threshold": 100000,
    "token": "VTN"
  },
  "channels": ["telegram", "email"],
  "isActive": true
}
```

#### Fase 2: Canales de Notificación

**1. Email (fácil - Resend/SendGrid)**
```typescript
// Cuando se dispara alerta
await sendEmail({
  to: user.email,
  subject: '🚨 Alerta: Ballena movió 250,000 VTN',
  template: 'whale-alert',
  data: { from, to, amount, time }
});
```

**2. Telegram Bot (recomendado)**
```typescript
// Bot de Telegram
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.command('subscribe', (ctx) => {
  // Registrar chatId del usuario
  ctx.reply('✅ Suscrito a alertas de VTN');
});

// Cuando hay alerta
await bot.telegram.sendMessage(chatId,
  '🚨 Ballena movió 250k VTN\n' +
  'From: Coinbase\n' +
  'To: 0xabc...def'
);
```

**3. Webhook (para integraciones)**
```typescript
POST https://tu-servidor.com/webhook
{
  "event": "whale_movement",
  "data": { ... }
}
```

#### Fase 3: Background Worker

**Cron job cada 5-10 minutos:**
```typescript
// Check si hay nuevas transferencias que disparen alertas
const recentTransfers = await getRecentTransfers(lastCheck);

for (const alert of activeAlerts) {
  const matches = recentTransfers.filter(t =>
    matchesCondition(t, alert.condition)
  );

  if (matches.length > 0) {
    // Disparar alerta
    await triggerAlert(alert, matches);
  }
}
```

#### UI para configurar alertas

**Página: `/dashboard` → Tab "Alertas"**
```
┌─────────────────────────────────────────────────┐
│  🔔 Mis Alertas                      [+ Nueva]  │
├─────────────────────────────────────────────────┤
│  ⚡ Ballenas VTN (>100k)             🟢 Activa  │
│     Telegram, Email                  ✏️ 🗑️ ⏸️   │
│                                                  │
│  📈 Cambio de precio (>5%)           🔴 Pausa   │
│     Telegram                         ✏️ 🗑️ ▶️   │
│                                                  │
│  🏦 Flujo a Coinbase (>50k)          🟢 Activa  │
│     Telegram                         ✏️ 🗑️ ⏸️   │
└─────────────────────────────────────────────────┘

Historial reciente:
  • 14:35 - Ballena movió 250k VTN
  • 12:20 - Precio subió 6.2%
  • 09:15 - 80k VTN a Coinbase
```

### 📈 Métricas de Éxito
- [ ] Recibir alerta en <5 minutos del evento
- [ ] 0 falsos positivos
- [ ] Poder configurar alerta en <1 minuto

### 🛠️ Tareas
- [ ] Implementar modelos Alert y AlertHistory
- [ ] Crear endpoint POST /api/alerts para configurar
- [ ] Implementar evaluación de condiciones
- [ ] Setup Telegram bot
- [ ] Background worker para check periódico
- [ ] UI para gestionar alertas
- [ ] Sistema de templates de alertas comunes

### ⚠️ Consideraciones
- **Rate limits:** No spam (max 1 alerta/condición cada 15 min)
- **Costo:** Telegram gratis, Email ~$0 (free tier Resend)
- **Privacy:** No compartir datos sensibles en mensajes

---

## 4. Búsqueda y Filtros Avanzados ✅ **IMPLEMENTADO (Búsqueda Global)**

### 🎯 Objetivo
Encontrar información rápidamente sin navegar múltiples tabs.

**Estado:** ✅ Búsqueda global con Cmd+K implementada

### 📊 Problema Actual
- ✅ ~~No hay barra de búsqueda global~~
- Filtros limitados en Analytics (solo período y threshold)
- ~~No se puede buscar por nombre guardado~~

### ✅ Solución Propuesta

#### Search Bar Global (Cmd+K / Ctrl+K) ✅ **IMPLEMENTADO**

**Funcionalidad:**
```typescript
// Búsqueda universal
- Addresses (0x...)
- Nombres guardados ("Coinbase")
- Transaction hashes
- Tokens por símbolo/nombre
- Comandos rápidos ("ver holders", "analytics")
```

**UI:**
```
┌─────────────────────────────────────────────────┐
│  🔍 Buscar...                          Ctrl+K   │
├─────────────────────────────────────────────────┤
│  Addresses                                       │
│    💼 Coinbase (0x3cd7...4699)                  │
│    🏦 Gate.io (0x0d07...2fe)                    │
│                                                  │
│  Contratos                                       │
│    🔒 Vottun World Vesting (0xa699...)          │
│                                                  │
│  Acciones rápidas                                │
│    📊 Ver Analytics                             │
│    👥 Ver Top Holders                           │
└─────────────────────────────────────────────────┘
```

#### Filtros Avanzados en Analytics

**Nuevos filtros:**
```typescript
1. Tipo de Address
   ☑ CEX  ☑ Contratos  ☑ Wallets

2. Rango de Montos
   Min: [10,000] Max: [1,000,000] VTN

3. Fecha personalizada
   Desde: [DD/MM/YYYY] Hasta: [DD/MM/YYYY]

4. Solo addresses etiquetadas
   ☑ Mostrar solo addresses con nombre

5. Excluir addresses
   [0x3cd7...] [0xa699...] (útil para excluir exchanges)
```

#### Vista de resultados mejorada

**Exportar filtrados:**
- CSV con columnas personalizables
- JSON para integraciones
- Copiar al portapapeles

**Guardar filtros:**
- "Ballenas >100k sin etiquetar"
- "Solo movimientos a CEX última semana"
- Compartir link con filtros aplicados

### 📈 Métricas de Éxito
- [ ] Encontrar cualquier address en <3 segundos
- [ ] 80% de búsquedas exitosas
- [ ] Usuarios usan filtros avanzados >50% del tiempo

### 🛠️ Tareas
- [ ] Implementar componente SearchBar global
- [ ] Endpoint GET /api/search?q=...
- [ ] Agregar filtros avanzados a Analytics
- [ ] Exportar resultados filtrados
- [ ] Guardar filtros favoritos (localStorage primero)
- [ ] Keyboard shortcuts

### ⚠️ Consideraciones
- **Performance:** Indexar addresses y nombres en BD
- **UX:** Debounce en búsqueda (300ms)
- **Mobile:** Adaptar UI para pantallas pequeñas

---

## 5. Gráficos y Visualizaciones ✅ **IMPLEMENTADO**

### 🎯 Objetivo
Entender datos on-chain de forma visual e intuitiva.

**Estado:** ✅ Completado - 3 gráficos principales implementados

### 📊 Problema Actual
- Solo tablas y números
- Difícil ver tendencias temporales
- No hay comparaciones visuales

### ✅ Solución Propuesta

#### Librería: **Recharts** (recomendada para React)
- Lightweight
- Responsive
- Fácil de usar
- Soporte para Next.js

#### Gráficos a Implementar

**1. Precio Histórico (Line Chart)**
```typescript
// Precio VTN últimos 30 días
<LineChart data={priceHistory}>
  <Line dataKey="price" stroke="#3B82F6" />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
</LineChart>
```

**2. Distribución de Holders (Pie Chart)**
```typescript
// Top 10 holders vs resto
<PieChart>
  <Pie data={[
    { name: 'Top 10', value: 65 },
    { name: 'Top 50', value: 20 },
    { name: 'Resto', value: 15 }
  ]} />
</PieChart>
```

**3. Timeline de Transferencias Grandes (Scatter Plot)**
```typescript
// Visualizar cuando ocurrieron ballenas
<ScatterChart>
  <Scatter data={largeTransfers} fill="#F59E0B" />
  <XAxis dataKey="timestamp" />
  <YAxis dataKey="amount" />
</ScatterChart>
```

**4. Net Flow CEX (Bar Chart)**
```typescript
// Flujo neto a exchanges por día
<BarChart data={dailyFlows}>
  <Bar dataKey="netFlow" fill="#EF4444" />
  <XAxis dataKey="date" />
  <YAxis />
</BarChart>
```

**5. Heatmap de Actividad (Calendar Heatmap)**
```typescript
// Estilo GitHub contributions
// Muestra volumen de transfers por día
<CalendarHeatmap
  values={transfersByDay}
  colorScale={['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']}
/>
```

**6. Sankey Diagram (Flujo de Tokens)**
```typescript
// Visualizar movimientos entre addresses principales
// Desde -> Hacia con grosor según monto
<Sankey
  nodes={[
    { name: 'Coinbase' },
    { name: 'Whale 1' },
    { name: 'DEX' }
  ]}
  links={[
    { source: 0, target: 1, value: 100000 },
    { source: 1, target: 2, value: 50000 }
  ]}
/>
```

#### Ubicación en Dashboard

**Nueva sección: `/dashboard` → Tab "Gráficos"**

O integrado en Analytics:
```
┌──────────────────────────────────────────┐
│  📊 Analytics VTN                         │
├──────────────────────────────────────────┤
│  [Overview] [Gráficos] [Whales] [Holders]│
│                                           │
│  ┌──────────────┬──────────────┐        │
│  │ Precio 30d   │ Distribución │        │
│  │ [Line Chart] │ [Pie Chart]  │        │
│  └──────────────┴──────────────┘        │
│                                           │
│  ┌──────────────────────────────┐       │
│  │ Timeline Ballenas             │       │
│  │ [Scatter Plot]                │       │
│  └──────────────────────────────┘       │
└──────────────────────────────────────────┘
```

### 📈 Métricas de Éxito
- [ ] Usuario identifica tendencia en <5 segundos
- [ ] 70% de usuarios prefieren gráficos vs tablas
- [ ] Página con gráficos carga en <3 segundos

### 🛠️ Tareas
- [ ] Instalar Recharts: `npm install recharts`
- [ ] Crear componentes reutilizables para cada gráfico
- [ ] Fetch price history desde API/caché
- [ ] Calcular datos agregados para gráficos
- [ ] Hacer gráficos responsive (mobile)
- [ ] Agregar tooltips informativos
- [ ] Exportar gráficos como imagen (opcional)

### ⚠️ Consideraciones
- **Performance:** No renderizar 10,000 puntos (agregar/samplear)
- **Mobile:** Algunos gráficos mejor desactivar en mobile
- **Colores:** Consistentes con tema del dashboard

---

## 6. Multi-Token Support

### 🎯 Objetivo
Analizar cualquier token ERC20 en Base, no solo VTN.

### 📊 Problema Actual
- Hardcoded para VTN (`0xA9bc...7abC`)
- No se pueden comparar tokens
- Limitado a un solo proyecto

### ✅ Solución Propuesta

#### Selector de Token en Analytics

**UI:**
```
┌─────────────────────────────────────────┐
│  📊 Token Analytics                      │
├─────────────────────────────────────────┤
│  Token: [VTN ▼]          Network: [Base]│
│         • VTN (Vottun)                   │
│         • USDC                           │
│         • ETH                            │
│         • AERO (Aerodrome)               │
│         + Agregar custom...              │
└─────────────────────────────────────────┘
```

#### Cambios en Backend

**Modificar APIs:**
```typescript
// Antes:
GET /api/token-analytics
// Ahora:
GET /api/token-analytics?token=0xA9bc...&network=base

// Soportar múltiples tokens
GET /api/tokens/compare?tokens[]=0xA9bc...&tokens[]=0x123...
```

**Base de datos:**
```prisma
// Agregar tokenAddress a caches
model TransferCache {
  tokenAddress String  // Ahora filtrar por token
  network      String
  // ...
  @@index([tokenAddress, network])
}
```

#### Features Adicionales

**1. Comparación de Tokens**
```
┌──────────────────────────────────┐
│  Comparar Tokens                  │
├──────────────────────────────────┤
│  Token A: [VTN  ▼]  🆚           │
│  Token B: [USDC ▼]               │
│                                   │
│  Métrica          VTN    USDC    │
│  Holders          1,234  45,678  │
│  Liquidity        $2.5M  $150M   │
│  Volume 24h       $125K  $45M    │
│  Large Transfers  15     8       │
└──────────────────────────────────┘
```

**2. Lista de tokens populares**
```typescript
const POPULAR_TOKENS = [
  { symbol: 'VTN', address: '0xA9bc...', name: 'Vottun Token' },
  { symbol: 'USDC', address: '0x833...', name: 'USD Coin' },
  { symbol: 'AERO', address: '0x940...', name: 'Aerodrome' },
  { symbol: 'cbETH', address: '0x2Ae...', name: 'Coinbase ETH' },
];
```

**3. Agregar token custom**
```
Input: [0x...]
→ Fetch metadata (symbol, decimals, name)
→ Validar es ERC20
→ Agregar a lista personal
```

### 📈 Métricas de Éxito
- [ ] Soportar top 10 tokens en Base
- [ ] Permitir analizar cualquier ERC20
- [ ] Comparar 2 tokens lado a lado

### 🛠️ Tareas
- [ ] Agregar tokenAddress param a todos los endpoints
- [ ] Crear TokenSelector component
- [ ] Lista de tokens populares (hardcoded primero)
- [ ] Input para agregar token custom
- [ ] Validar address es ERC20
- [ ] Actualizar caché para multi-token
- [ ] Página de comparación (opcional)

### ⚠️ Consideraciones
- **Storage:** Caché por token aumenta DB size
- **APIs:** Algunos endpoints (Moralis) cuestan más por token
- **UX:** No abrumar con demasiadas opciones

---

## 7. API Pública

### 🎯 Objetivo
Permitir que terceros accedan a datos y generar posible ingreso.

### 📊 Use Cases
- Bots de Discord/Telegram
- Otras dashboards/apps
- Integraciones automatizadas
- Investigadores/analistas

### ✅ Solución Propuesta

#### API REST Pública

**Base URL:** `https://api.tudominio.com/v1`

**Endpoints:**
```typescript
// Públicos (sin auth)
GET /v1/token/:address/price
GET /v1/token/:address/stats

// Requieren API Key
GET /v1/token/:address/analytics
GET /v1/token/:address/holders
GET /v1/token/:address/transfers
GET /v1/address/:address/label
POST /v1/webhook/subscribe

// Admin (requiere API Key admin)
POST /v1/address/label
DELETE /v1/address/label/:address
```

#### Sistema de API Keys

**Modelo ya definido:**
```prisma
model ApiKey {
  id        String   @id
  userId    String
  key       String   @unique
  name      String
  isActive  Boolean
  lastUsed  DateTime?
  createdAt DateTime
  expiresAt DateTime?

  // Rate limiting
  requestsPerMinute Int @default(60)
  requestsToday     Int @default(0)
}
```

**Generación de keys:**
```typescript
// UI: /admin/api-keys
const newKey = generateApiKey(); // sk_live_abc123...

await prisma.apiKey.create({
  data: {
    key: hashApiKey(newKey),
    name: 'Mi Bot de Telegram',
    requestsPerMinute: 60
  }
});
```

**Uso:**
```bash
curl https://api.tudominio.com/v1/token/0xA9bc.../analytics \
  -H "Authorization: Bearer sk_live_abc123..."
```

#### Rate Limiting

**Implementar middleware:**
```typescript
// middleware/rateLimit.ts
export async function rateLimit(req: Request, apiKey: ApiKey) {
  const key = `ratelimit:${apiKey.id}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, 60); // 60 segundos
  }

  if (current > apiKey.requestsPerMinute) {
    throw new RateLimitError('Too many requests');
  }
}
```

#### Documentación de API

**Página: `/docs/api`**

Usar Swagger/OpenAPI:
```yaml
openapi: 3.0.0
info:
  title: Blockchain Explorer API
  version: 1.0.0
paths:
  /v1/token/{address}/analytics:
    get:
      summary: Get token analytics
      parameters:
        - name: address
          in: path
          required: true
        - name: days
          in: query
          schema:
            type: integer
            default: 7
```

#### Webhooks

**Suscribirse a eventos:**
```typescript
POST /v1/webhook/subscribe
{
  "url": "https://mibot.com/webhook",
  "events": ["whale_movement", "price_change"],
  "filters": {
    "token": "0xA9bc...",
    "threshold": 100000
  }
}

// Cuando hay evento, POST a la URL:
POST https://mibot.com/webhook
{
  "event": "whale_movement",
  "timestamp": "2025-01-20T14:35:00Z",
  "data": {
    "from": "0x3cd7...",
    "to": "0xabcd...",
    "amount": "250000",
    "token": "0xA9bc..."
  },
  "signature": "sha256..." // Verificar autenticidad
}
```

### 📈 Métricas de Éxito
- [ ] 10+ API keys activas
- [ ] <100ms latencia p95
- [ ] 99.9% uptime
- [ ] Documentación clara y ejemplos

### 🛠️ Tareas
- [ ] Implementar sistema de API keys
- [ ] Middleware de autenticación
- [ ] Rate limiting con Redis
- [ ] Documentación Swagger
- [ ] Página de gestión de keys
- [ ] Implementar webhooks
- [ ] Logs de uso por key
- [ ] Sistema de facturación (opcional)

### ⚠️ Consideraciones
- **Seguridad:** HTTPS obligatorio, hash keys en BD
- **Abuse:** Rate limits estrictos
- **Monetización:** Free tier + paid plans
- **Legal:** Terms of Service, límites de uso

---

## 8. Sistema Multi-Usuario

### 🎯 Objetivo
Múltiples usuarios con sus propias etiquetas, watchlists y alertas.

### 📊 Estado Actual
- Sin autenticación
- Etiquetas globales (todos ven las mismas)
- No hay concepto de "usuario"

### ✅ Solución Propuesta

#### NextAuth.js (Recomendado)

**Providers:**
- Email magic link (sin contraseña)
- Google OAuth
- GitHub OAuth
- Wallet connect (Web3)

**Setup básico:**
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  ],
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub;
      return session;
    }
  }
};

export const handler = NextAuth(authOptions);
```

#### Modelo de datos ya definido:
```prisma
model User {
  id            String   @id
  email         String   @unique
  name          String?
  role          UserRole @default(USER)

  watchlists    Watchlist[]
  apiKeys       ApiKey[]
}

enum UserRole {
  ADMIN
  USER
  VIEWER
}
```

#### Features por Rol

**ADMIN:**
- Ver/editar todas las addresses
- Gestionar usuarios
- Ver analytics de uso
- Acceso a panel admin completo

**USER:**
- Etiquetas privadas (solo él las ve)
- Crear watchlists personales
- Configurar alertas propias
- API keys propias

**VIEWER:**
- Solo lectura
- No puede crear/editar
- Ver dashboards públicos

#### Etiquetas Públicas vs Privadas

**Modificar modelo:**
```prisma
model KnownAddress {
  id        String  @id
  address   String
  name      String
  userId    String? // null = pública, con valor = privada
  isPublic  Boolean @default(false)

  user      User?   @relation(fields: [userId], references: [id])

  @@unique([address, userId])
}
```

**Lógica:**
```typescript
// Al buscar address
const labels = await prisma.knownAddress.findMany({
  where: {
    address,
    OR: [
      { isPublic: true },
      { userId: currentUser.id }
    ]
  }
});

// Usuario ve: etiqueta pública + su etiqueta privada
// Mostrar ambas o dejar que user elija cuál ver
```

#### Watchlists Personales

**Página: `/dashboard/watchlists`**

```
┌────────────────────────────────────────┐
│  👁️ Mis Watchlists            [+ Nueva]│
├────────────────────────────────────────┤
│  📌 Ballenas VTN (15 addresses)        │
│     • Coinbase (0x3cd7...)             │
│     • Whale 1 (0xabcd...)              │
│     • Gate.io (0x0d07...)              │
│     [Ver Analytics] [Editar]           │
│                                         │
│  🏦 Exchanges Base (8 addresses)       │
│     • Coinbase, Gate.io, ...           │
│     [Ver Analytics] [Editar]           │
│                                         │
│  🔒 Contratos Vottun (8 addresses)     │
│     • Vesting contracts                │
│     [Ver Analytics] [Editar]           │
└────────────────────────────────────────┘
```

**Features:**
- Crear listas de addresses
- Analytics consolidado de toda la lista
- Alertas para toda la watchlist
- Compartir watchlist (link público)

### 📈 Métricas de Éxito
- [ ] 100+ usuarios registrados
- [ ] 80% usan etiquetas privadas
- [ ] 50% crean al menos 1 watchlist

### 🛠️ Tareas
- [ ] Setup NextAuth.js
- [ ] Implementar providers (Google, Email)
- [ ] Modificar KnownAddress para soportar privacidad
- [ ] UI de login/register
- [ ] Implementar Watchlists
- [ ] Sistema de roles
- [ ] Migrar etiquetas actuales a públicas

### ⚠️ Consideraciones
- **Migración:** Etiquetas actuales → públicas por defecto
- **Privacy:** GDPR compliance si hay usuarios EU
- **UX:** Onboarding claro para nuevos usuarios

---

## 9. Mobile App / PWA

### 🎯 Objetivo
Acceso móvil nativo con notificaciones push.

### 📊 Problema Actual
- Responsive pero no optimizado para móvil
- No hay app en stores
- No hay notificaciones push móviles

### ✅ Solución Propuesta

#### Opción A: Progressive Web App (PWA)

**Ventajas:**
- No necesita stores (App/Play Store)
- Se "instala" desde navegador
- Funciona offline
- Notificaciones push
- Más barato que app nativa

**Implementación:**
```typescript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

module.exports = withPWA({
  // ...config
});
```

**Manifest:**
```json
// public/manifest.json
{
  "name": "Blockchain Explorer",
  "short_name": "Explorer",
  "description": "Analytics para Base Network",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3B82F6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Service Worker:**
```typescript
// Caché estrategias
- Páginas estáticas: Cache first
- APIs: Network first, fallback a cache
- Assets: Cache first, update background
```

**Push Notifications:**
```typescript
// Pedir permiso
const permission = await Notification.requestPermission();

if (permission === 'granted') {
  const registration = await navigator.serviceWorker.ready;
  await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY
  });
}

// Backend envía push
await webpush.sendNotification(subscription, JSON.stringify({
  title: '🚨 Alerta VTN',
  body: 'Ballena movió 250k tokens',
  icon: '/icon-192.png',
  badge: '/badge.png',
  data: { url: '/dashboard?tab=analytics' }
}));
```

#### Opción B: React Native (App Nativa)

**Solo si necesitas:**
- Performance crítica
- Acceso a APIs móviles nativas
- Presencia en App/Play Store
- Biometría (FaceID, huella)

**Costo:** 5-10x más desarrollo que PWA

#### Optimizaciones Móviles

**1. UI/UX:**
```typescript
// Usar touch gestures
- Swipe para cambiar tabs
- Pull to refresh
- Bottom sheet para modals
- Haptic feedback
```

**2. Performance:**
```typescript
// Lazy load pesado
- Gráficos solo cuando visibles
- Cargar imágenes progressive
- Reducir bundle size
```

**3. Data:**
```typescript
// Modo offline
- Caché agresivo
- Sync cuando vuelve online
- Indicador de estado de red
```

### 📈 Métricas de Éxito
- [ ] 50% de usuarios en móvil
- [ ] Install rate >10%
- [ ] App carga en <2s en 4G

### 🛠️ Tareas
- [ ] Instalar next-pwa
- [ ] Crear manifest.json
- [ ] Service worker con caché strategies
- [ ] Setup push notifications (web push)
- [ ] Optimizar UI para móvil
- [ ] Agregar install prompt
- [ ] Testing en iOS y Android
- [ ] Analytics de instalaciones

### ⚠️ Consideraciones
- **iOS:** Push notifications limitadas en PWA
- **Storage:** Límite de cache (~50MB)
- **Fallback:** Funcionalidad básica offline

---

## 10. Inteligencia Artificial / ML

### 🎯 Objetivo
Detectar patrones y predecir movimientos basado en datos on-chain.

### 📊 Use Cases
- Predecir dumps antes que ocurran
- Detectar wash trading
- Clasificar addresses automáticamente
- Alertas predictivas ("patrón similar a dump anterior")

### ✅ Solución Propuesta

#### Fase 1: Clasificación de Addresses (ML Simple)

**Problema:** ¿Es CEX, wallet, o contrato?

**Solución: Random Forest Classifier**
```python
# Features
features = [
  'tx_count_7d',          # Transacciones última semana
  'avg_tx_amount',        # Monto promedio
  'unique_counterparties', # Cuántas addresses únicas
  'has_contract_code',    # Tiene código (1/0)
  'balance_volatility',   # Volatilidad del balance
  'receives_from_many',   # Recibe de muchas addresses
  'sends_to_many',        # Envía a muchas addresses
]

# Labels
labels = ['cex', 'wallet', 'contract', 'bot', 'unknown']

# Train
from sklearn.ensemble import RandomForestClassifier
model = RandomForestClassifier()
model.fit(X_train, y_train)
model.save('address_classifier.pkl')

# Predict
prediction = model.predict(new_address_features)
# → 'cex' (95% confidence)
```

**Integración:**
```typescript
// API endpoint
POST /api/ml/classify-address
{ "address": "0x3cd7..." }

// Response
{
  "prediction": "cex",
  "confidence": 0.95,
  "features_used": { ... }
}
```

#### Fase 2: Detección de Patrones de Dumps

**Dataset:**
```python
# Recopilar dumps históricos
dumps = [
  {
    'timestamp': '2024-01-15T10:00:00Z',
    'price_drop': -15.3,  # %
    'features_before': {
      'large_transfers_count': 8,
      'cex_net_flow': 150000,
      'top10_concentration': 68,
      'volume_spike': 2.5x,
      'holder_count_change': -50
    }
  },
  # ... 50+ ejemplos de dumps
]
```

**Modelo: LSTM (Time Series)**
```python
import tensorflow as tf

# Features: ventana de 24h antes del evento
X = [features_24h_before_each_dump]
y = [1 if dump else 0]

model = tf.keras.Sequential([
  tf.keras.layers.LSTM(64, return_sequences=True),
  tf.keras.layers.LSTM(32),
  tf.keras.layers.Dense(16, activation='relu'),
  tf.keras.layers.Dense(1, activation='sigmoid')
])

model.fit(X_train, y_train, epochs=50)

# Predict
current_features = get_last_24h_features()
dump_probability = model.predict([current_features])
# → 0.78 (78% chance de dump próximo)
```

**Integración:**
```typescript
// Background job cada hora
const riskScore = await fetch('/api/ml/dump-risk');

if (riskScore.probability > 0.7) {
  await sendAlert({
    type: 'DUMP_RISK',
    message: `⚠️ Alto riesgo de dump (${riskScore.probability * 100}%)`,
    recommendation: 'Monitorear closely'
  });
}
```

#### Fase 3: Análisis de Sentimiento (Opcional)

**Fuentes:**
- Twitter/X mentions
- Discord/Telegram mensajes
- Reddit posts
- News articles

**Modelo: BERT Fine-tuned**
```python
from transformers import BertForSequenceClassification

# Dataset
tweets = [
  {"text": "VTN to the moon! 🚀", "sentiment": "positive"},
  {"text": "VTN dumping hard", "sentiment": "negative"},
]

# Fine-tune
model = BertForSequenceClassification.from_pretrained('bert-base')
model.train(tweets)

# Predict
sentiment = model.predict("Just bought more VTN")
# → "positive" (0.85 confidence)
```

**Agregar al dashboard:**
```
┌────────────────────────────────┐
│  😊 Sentiment Score: 72/100   │
│  📈 Trending: Positive (+15%)  │
│                                 │
│  Recent mentions:               │
│  • Twitter: 1,234 (↑25%)       │
│  • Reddit: 45 posts            │
│  • Discord: High activity      │
└────────────────────────────────┘
```

#### Infraestructura ML

**Opción A: Serverless (Recomendada)**
```typescript
// Usar Hugging Face Inference API
const response = await fetch(
  'https://api-inference.huggingface.co/models/...',
  {
    headers: { Authorization: `Bearer ${HF_API_KEY}` },
    body: JSON.stringify({ inputs: data })
  }
);
```

**Opción B: Self-hosted**
```yaml
# docker-compose.yml
services:
  ml-api:
    image: tensorflow/serving
    ports:
      - "8501:8501"
    volumes:
      - ./models:/models
```

### 📈 Métricas de Éxito
- [ ] Clasificar address con >90% accuracy
- [ ] Detectar dump con >70% accuracy y 48h anticipación
- [ ] Reducir falsos positivos a <10%

### 🛠️ Tareas
- [ ] Recopilar dataset histórico
- [ ] Train address classifier
- [ ] API endpoint para inferencia
- [ ] Background job para predicciones
- [ ] UI para mostrar scores/predictions
- [ ] Logging de predicciones vs realidad (improve model)

### ⚠️ Consideraciones
- **Data:** Necesitas mucho histórico (>1 año)
- **Compute:** Puede ser costoso (GPU)
- **Accuracy:** ML no es magia, expect 70-80% accuracy
- **Legal:** Disclaimer: "No financial advice"

---

## 📊 Matriz de Priorización

| Mejora | Impacto | Esfuerzo | Prioridad | Tiempo | Estado |
|--------|---------|----------|-----------|--------|--------|
| 1. Caché LITE | Alto | Bajo | 🔴 Alta | 2h | ✅ Hecho |
| 2. Panel Admin | Alto | Medio | 🔴 Alta | 1 semana | ✅ Hecho |
| 4. Búsqueda | Medio | Bajo | 🟡 Media | 2 días | ✅ Hecho |
| 5. Gráficos | Alto | Medio | 🟡 Media | 3 días | ✅ Hecho |
| 3. Alertas | Medio | Alto | 🟡 Media | 1 semana | ⏳ Pendiente |
| 6. Multi-Token | Medio | Medio | 🟢 Baja | 1 semana | ⏳ Pendiente |
| 7. API Pública | Bajo | Alto | 🟢 Baja | 2 semanas | ⏳ Pendiente |
| 8. Multi-Usuario | Alto | Alto | 🟢 Baja | 3 semanas | ⏳ Pendiente |
| 9. PWA | Medio | Medio | 🟢 Baja | 1 semana | ⏳ Pendiente |
| 10. AI/ML | Bajo | Muy Alto | ⚪ Futuro | 1+ meses | ⏳ Pendiente |

---

## 🎯 Roadmap Recomendado

### **Sprint 1 (Semana 1-2):** ✅ **COMPLETADO**
1. ✅ Caché LITE (2h)
2. ✅ Búsqueda global (2 días)
3. ✅ Gráficos principales (3 días)
4. ✅ Panel Admin completo (1 semana)
5. ✅ Filtros avanzados en Analytics (1 día)

### **Sprint 2 (Semana 3-4):**
1. ⏳ Sistema de Alertas backend (5 días)
2. ⏳ Multi-Token support
3. ⏳ PWA setup

### **Sprint 3 (Mes 2):**
7. ✅ Multi-Token support
8. ✅ Sistema de alertas completo (Telegram)
9. ✅ PWA setup

### **Sprint 4+ (Mes 3+):**
10. ✅ Multi-usuario
11. ✅ API pública
12. ✅ AI/ML (exploración)

---

## 💬 Notas Finales

**Filosofía de desarrollo:**
- ✅ MVP primero, iterar rápido
- ✅ Medir antes de optimizar
- ✅ User feedback > assumptions
- ✅ Mantener código simple

**Próximos pasos:**
1. Revisar este documento
2. Decidir qué implementar primero
3. Crear issues en GitHub (opcional)
4. Empezar a codear! 🚀

---

**Documento creado:** 2025-01-20
**Última actualización:** 2025-01-20
**Versión:** 1.0
