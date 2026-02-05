# Future APIs - Roadmap y Planificación

**Fecha:** 2025-02-05
**Versión:** 1.0
**Estado:** Planificación

---

## 📋 Resumen Ejecutivo

Este documento describe las **APIs adicionales** que se pueden integrar en la plataforma SaaS para dar más flexibilidad a los usuarios según el tipo de token que gestionen.

**Concepto clave:** Cada token puede necesitar diferentes fuentes de datos según:
- Si está listado en exchanges centralizados (CEX)
- Si solo tiene liquidez en DEXs
- Si tiene contratos de vesting personalizados
- Si necesita datos de mercado específicos

---

## 🎯 APIs Actuales (Ya Implementadas)

| API | Propósito | Status | Custom por Token |
|-----|-----------|--------|------------------|
| **BaseScan** | ABIs de contratos | ✅ Activo | ✅ Sí |
| **Routescan** | Fallback ABIs | ✅ Activo | ✅ Sí |
| **Etherscan** | Transfers históricos | ✅ Activo | ✅ Sí |
| **Moralis** | Top holders | ✅ Activo | ✅ Sí |
| **QuikNode** | RPC Provider + Precios | ✅ Activo | ✅ Sí |
| **DEX Screener** | Liquidez DEXs | ✅ Activo | ❌ No (gratis) |
| **Uniswap V4 StateView** | Liquidez on-chain | ✅ Activo | ❌ No (contrato) |

---

## 🚀 APIs Propuestas para Futuro

### 1. **CoinGecko API** (Prioridad: ⭐⭐⭐ ALTA)

#### **Para Qué Sirve:**
- Obtener **precios de tokens listados** en exchanges centralizados
- Market cap, volumen, historical data
- **Ideal para:** Tokens listados en Binance, Coinbase, Gate.io, etc.

#### **Casos de Uso:**
- Token está en CoinGecko pero no tiene liquidez en DEXs de Base
- Usuario prefiere mostrar precio de CEX en lugar de DEX
- Quiere mostrar market cap oficial

#### **Free Tier:**
- 10-50 calls/minuto (sin key)
- 500 calls/minuto (con key gratuita)
- Rate limit: Variable según plan

#### **Endpoints Útiles:**
```bash
# Precio simple
GET https://api.coingecko.com/api/v3/simple/price?ids={token}&vs_currencies=usd

# Datos completos
GET https://api.coingecko.com/api/v3/coins/{id}

# Historical data
GET https://api.coingecko.com/api/v3/coins/{id}/market_chart
```

#### **Integración Propuesta:**
1. Agregar `customCoingeckoApiKey` en TokenSettings
2. Agregar `defaultCoingeckoApiKey` en SystemSettings
3. Agregar campo `priceSource: 'QUICKNODE' | 'COINGECKO' | 'DEX_SCREENER'` en TokenSettings
4. Implementar fallback: Fuente preferida → Alternativas → Error

#### **Implicaciones:**
- ✅ Tokens listados obtienen precios más confiables
- ✅ Fallback cuando DEXs no tienen liquidez
- ⚠️ Requiere que el token esté listado en CoinGecko
- ⚠️ Rate limits pueden ser restrictivos en free tier

---

### 2. **Alchemy API** (Prioridad: ⭐⭐ MEDIA)

#### **Para Qué Sirve:**
- **RPC Provider alternativo** a QuikNode
- Enhanced APIs para NFTs, tokens, transacciones
- Webhooks para eventos on-chain

#### **Casos de Uso:**
- Fallback cuando QuikNode falla o está saturado
- Usuario prefiere Alchemy por sus herramientas
- Necesita webhooks para alertas en tiempo real

#### **Free Tier:**
- 300M compute units/mes
- Más generoso que QuikNode en algunos aspectos
- Webhooks limitados en free tier

#### **Endpoints Base:**
```bash
# RPC Base Mainnet
https://base-mainnet.g.alchemy.com/v2/{API_KEY}

# Enhanced APIs
GET https://base-mainnet.g.alchemy.com/v2/{API_KEY}/getAssetTransfers
```

#### **Integración Propuesta:**
1. Agregar `customAlchemyApiKey` en TokenSettings
2. Agregar `defaultAlchemyApiKey` en SystemSettings
3. Modificar función `getProvider()` para usar Alchemy como fallback
4. Agregar opción de "RPC preferido" en settings

#### **Implicaciones:**
- ✅ Mayor redundancia para RPC calls
- ✅ Enhanced APIs pueden simplificar código
- ⚠️ Otro servicio externo a mantener
- ⚠️ Costos si se excede free tier

---

### 3. **1inch API** (Prioridad: ⭐ BAJA)

#### **Para Qué Sirve:**
- **DEX Aggregator** - Liquidez agregada de múltiples DEXs
- Mejores precios para swaps
- Datos de liquidez más completos

#### **Casos de Uso:**
- Token tiene liquidez fragmentada en varios DEXs
- Usuario quiere ver liquidez total agregada
- Comparar precios entre DEXs

#### **Free Tier:**
- Gratis para consultas básicas
- Rate limit no documentado claramente

#### **Endpoints Útiles:**
```bash
# Precio y liquidez
GET https://api.1inch.dev/price/v1.1/{chainId}?tokens={address}

# Quote para swap
GET https://api.1inch.dev/swap/v5.0/{chainId}/quote
```

#### **Integración Propuesta:**
1. Agregar `custom1inchApiKey` en TokenSettings (opcional)
2. Usar como fuente alternativa para liquidez
3. Agregar opción "Mostrar liquidez agregada"

#### **Implicaciones:**
- ✅ Datos de liquidez más completos
- ✅ Útil para tokens multi-DEX
- ⚠️ Puede ser redundante con DEX Screener
- ⚠️ No todos los tokens están soportados en Base

---

### 4. **The Graph (Subgraphs)** (Prioridad: ⭐ MUY BAJA)

#### **Para Qué Sirve:**
- **Consultas GraphQL** a subgraphs personalizados
- Datos históricos indexados
- Ideal para proyectos con subgraphs propios

#### **Casos de Uso:**
- Token tiene su propio subgraph deployado
- Necesita datos históricos complejos
- Proyecto DeFi con dashboard personalizado

#### **Free Tier:**
- Gratis para queries públicos
- Rate limit: 1000 queries/día (free)

#### **Integración Propuesta:**
1. Agregar `customSubgraphUrl` en TokenSettings
2. Permitir queries GraphQL personalizados (avanzado)
3. UI para configurar endpoints de subgraph

#### **Implicaciones:**
- ✅ Máxima flexibilidad para proyectos avanzados
- ⚠️ Requiere que el usuario tenga un subgraph deployado
- ⚠️ Muy avanzado, pocos usuarios lo necesitarían
- ⚠️ Complejidad de implementación alta

---

## 🏗️ Arquitectura Propuesta: Multi-Source por Token

### Concepto: "Preferred Sources"

Cada token puede configurar sus **fuentes preferidas** para diferentes tipos de datos:

```typescript
interface TokenDataSources {
  // Precios
  priceSource: 'QUICKNODE' | 'COINGECKO' | 'DEX_SCREENER' | 'AUTO';
  priceFallback: string[]; // Orden de fallback

  // Liquidez
  liquiditySource: 'DEX_SCREENER' | '1INCH' | 'UNISWAP_V4' | 'AUTO';
  liquidityFallback: string[];

  // ABIs
  abiSource: 'BASESCAN' | 'ROUTESCAN' | 'AUTO'; // Ya implementado

  // Transfers
  transfersSource: 'ETHERSCAN' | 'ALCHEMY' | 'MORALIS' | 'AUTO';

  // Holders
  holdersSource: 'MORALIS' | 'ALCHEMY' | 'AUTO';
}
```

### Ejemplo de Configuración por Tipo de Token:

#### **Tipo A: Token Listado en CEX (ej: USDC, WETH)**
```json
{
  "priceSource": "COINGECKO",
  "priceFallback": ["QUICKNODE", "DEX_SCREENER"],
  "liquiditySource": "DEX_SCREENER",
  "abiSource": "AUTO",
  "transfersSource": "ETHERSCAN",
  "holdersSource": "MORALIS"
}
```

#### **Tipo B: Token Solo en DEXs (ej: Nuevo proyecto)**
```json
{
  "priceSource": "DEX_SCREENER",
  "priceFallback": ["QUICKNODE"],
  "liquiditySource": "DEX_SCREENER",
  "abiSource": "AUTO",
  "transfersSource": "ETHERSCAN",
  "holdersSource": "MORALIS"
}
```

#### **Tipo C: Token con Liquidez Fragmentada**
```json
{
  "priceSource": "AUTO",
  "priceFallback": ["DEX_SCREENER", "1INCH", "QUICKNODE"],
  "liquiditySource": "1INCH",
  "liquidityFallback": ["DEX_SCREENER"],
  "abiSource": "AUTO",
  "transfersSource": "ETHERSCAN",
  "holdersSource": "MORALIS"
}
```

---

## 🎨 Propuesta de UI: Source Selection

### Settings Page: `/settings/tokens/[id]/data-sources`

Nueva tab en la configuración de token:

```
┌─────────────────────────────────────────────────┐
│  Data Sources Configuration                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  💰 Price Data                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ Primary Source:   [CoinGecko    ▼]     │   │
│  │ Fallback Order:   [DEX Screener ▼]     │   │
│  │                   [QuikNode     ▼]     │   │
│  │                   [+ Add Fallback]     │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  💧 Liquidity Data                              │
│  ┌─────────────────────────────────────────┐   │
│  │ Primary Source:   [DEX Screener ▼]     │   │
│  │ Fallback Order:   [1inch        ▼]     │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  📜 Contract ABIs                               │
│  ┌─────────────────────────────────────────┐   │
│  │ Primary Source:   [Auto (Smart) ▼]     │   │
│  │ Current: BaseScan → Routescan           │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  [Save Configuration]                           │
└─────────────────────────────────────────────────┘
```

### Features:
- **Drag & Drop** para reordenar fallbacks
- **Auto-detection** sugiere sources basado en el token
- **Preview** muestra qué fuente está activa actualmente
- **Health indicators** 🟢🟡🔴 para cada fuente

---

## 📊 Matriz de Decisión: ¿Qué API Agregar?

| API | Utilidad SaaS | Complejidad | Free Tier | Prioridad |
|-----|---------------|-------------|-----------|-----------|
| **CoinGecko** | ⭐⭐⭐⭐⭐ | 🟢 Baja | ✅ Generoso | ⭐⭐⭐ ALTA |
| **Alchemy** | ⭐⭐⭐ | 🟡 Media | ✅ Generoso | ⭐⭐ MEDIA |
| **1inch** | ⭐⭐ | 🟡 Media | ✅ Básico | ⭐ BAJA |
| **The Graph** | ⭐ | 🔴 Alta | ✅ Limitado | ⭐ MUY BAJA |

---

## 🛠️ Plan de Implementación Propuesto

### Fase 1: CoinGecko (Esencial para Tokens Listados)
**Tiempo estimado:** 2-3 días

1. **Base de Datos:**
   - Agregar `customCoingeckoApiKey` a TokenSettings
   - Agregar `defaultCoingeckoApiKey` a SystemSettings
   - Agregar `priceSource` y `priceFallback` a TokenSettings

2. **Backend:**
   - Crear `fetchPriceFromCoinGecko()` en blockchain.ts
   - Modificar `getCurrentPrice()` para usar multi-source
   - Implementar fallback automático

3. **Frontend:**
   - Agregar campo en `/admin/settings` (API Keys tab)
   - Agregar campo en `/settings/tokens/[id]/api-keys`
   - Nueva tab `/settings/tokens/[id]/data-sources` (opcional)

4. **Testing:**
   - Probar con token listado (WETH)
   - Probar con token no listado (fallback a DEX)
   - Probar rate limiting

### Fase 2: Alchemy (Redundancia RPC) - OPCIONAL
**Tiempo estimado:** 1-2 días

1. **Base de Datos:**
   - Agregar `customAlchemyApiKey` a TokenSettings
   - Agregar `defaultAlchemyApiKey` a SystemSettings

2. **Backend:**
   - Modificar `getProvider()` para soportar múltiples RPC providers
   - Implementar fallback automático

3. **Frontend:**
   - Agregar campos en settings (igual que Fase 1)

### Fase 3: Multi-Source UI (Advanced) - OPCIONAL
**Tiempo estimado:** 3-4 días

1. Crear UI de Source Selection (drag & drop)
2. Implementar auto-detection basado en token
3. Health monitoring de cada fuente
4. Sugerencias inteligentes

---

## ⚠️ Consideraciones Importantes

### 1. **Token No Listado**
**Problema:** Usuario configura CoinGecko como fuente primaria, pero su token no está listado.

**Solución:**
- Auto-detectar si token está en CoinGecko
- Mostrar warning en UI: "⚠️ Token no encontrado en CoinGecko, usando fallback"
- Sugerir automáticamente fuente alternativa

### 2. **Rate Limiting**
**Problema:** Free tier de CoinGecko se agota rápido.

**Solución:**
- Implementar caching agresivo (5-10 min para precios)
- Rotar entre fuentes para distribuir calls
- Mostrar indicador de "Rate limit alcanzado, usando cache"

### 3. **Costos para Clientes**
**Problema:** Cliente excede free tier y necesita pagar.

**Solución:**
- Dashboard de "API Usage" en settings
- Estimación de costos según uso actual
- Sugerencia de plan según necesidades

### 4. **Complejidad para Usuario Final**
**Problema:** Demasiadas opciones confunden al usuario.

**Solución:**
- Modo "AUTO (Recommended)" por defecto
- Configuración avanzada en tab separada
- Tooltips explicativos para cada opción

---

## 📈 Métricas de Éxito

### KPIs para Evaluar Éxito de Nuevas APIs:

1. **Adoption Rate**
   - % de tokens que usan cada fuente custom
   - Meta: >30% usan CoinGecko custom key

2. **Reliability**
   - % de llamadas exitosas por fuente
   - Meta: >95% success rate con fallbacks

3. **User Satisfaction**
   - Feedback sobre data accuracy
   - Meta: <5% reportes de precios incorrectos

4. **Cost Efficiency**
   - API calls reducidos por caching
   - Meta: <1000 calls/día por token en promedio

---

## 🎯 Recomendación Final

### Implementar AHORA:
✅ **CoinGecko API** (Fase 1)
- Esencial para tokens listados
- Baja complejidad
- Alto valor para clientes SaaS

### Implementar DESPUÉS (si hay demanda):
⏸️ **Alchemy API** (Fase 2)
- Solo si hay problemas con QuikNode
- Esperar feedback de usuarios

### NO Implementar (por ahora):
❌ **1inch API** - Redundante con DEX Screener
❌ **The Graph** - Muy avanzado, nicho pequeño

---

## 📝 Notas de Implementación

### Modificaciones en Prisma Schema:

```prisma
model TokenSettings {
  // ... campos existentes ...

  // CoinGecko (Fase 1)
  customCoingeckoApiKey   String?
  priceSource             String   @default("AUTO") // AUTO, QUICKNODE, COINGECKO, DEX_SCREENER
  priceFallback           String[] // Array de fuentes en orden

  // Alchemy (Fase 2 - opcional)
  customAlchemyApiKey     String?
  rpcSource               String   @default("QUICKNODE") // QUICKNODE, ALCHEMY

  // 1inch (Fase 3 - opcional)
  custom1inchApiKey       String?
  liquiditySource         String   @default("DEX_SCREENER") // DEX_SCREENER, 1INCH
}

model SystemSettings {
  // ... campos existentes ...

  // Defaults para nuevas APIs
  defaultCoingeckoApiKey  String?
  defaultAlchemyApiKey    String?
  default1inchApiKey      String?
}
```

### Ejemplo de Función Multi-Source:

```typescript
async function getCurrentPrice(
  tokenAddress: string,
  sources: TokenDataSources
): Promise<number> {
  const sourceFunctions = {
    'COINGECKO': fetchPriceFromCoinGecko,
    'QUICKNODE': fetchPriceFromQuikNode,
    'DEX_SCREENER': fetchPriceFromDexScreener
  };

  // Intentar fuente primaria
  const primarySource = sources.priceSource;
  try {
    const price = await sourceFunctions[primarySource](tokenAddress);
    if (price) {
      console.log(`✅ Price from ${primarySource}: $${price}`);
      return price;
    }
  } catch (error) {
    console.warn(`⚠️ ${primarySource} failed, trying fallbacks...`);
  }

  // Intentar fallbacks en orden
  for (const fallbackSource of sources.priceFallback) {
    try {
      const price = await sourceFunctions[fallbackSource](tokenAddress);
      if (price) {
        console.log(`✅ Price from ${fallbackSource} (fallback): $${price}`);
        return price;
      }
    } catch (error) {
      console.warn(`⚠️ ${fallbackSource} failed, trying next...`);
    }
  }

  throw new Error('All price sources failed');
}
```

---

**Última actualización:** 2025-02-05
**Próxima revisión:** Después de implementar Fase 1 (CoinGecko)
