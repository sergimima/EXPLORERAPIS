# Recomendación de APIs para la plataforma

Resumen de qué APIs usa la plataforma, cuáles son necesarias y cuáles conviene tener como **principal** y **fallback**.

---

## 1. APIs principales (recomendadas u obligatorias)

| API | Uso en la plataforma | ¿Key? | Prioridad |
|-----|------------------------|-------|-----------|
| **BaseScan** | ABIs de contratos, verificación de contratos en Base (mainnet + Sepolia) | Sí | **Alta** – Sin alternativa implementada para ABIs |
| **Routescan** | Historial de transferencias de tokens (ERC20) en Base (formato compatible Etherscan) | Opcional (mejor con key) | **Alta** – Usado en analytics y wallet |
| **RPC Base (QuikNode o similar)** | Llamadas on-chain: balances, vesting, Uniswap V4 StateView, verificación de contratos | URL RPC | **Alta** – Evita timeouts del RPC público |
| **Moralis** | Top holders (dueños de tokens ERC20) para analytics | Sí | **Media-Alta** – Sin fallback actual si no hay key |
| **DEX Screener** | Liquidez por pool (Aerodrome, Uniswap, etc.) y **fallback de precio** | No | **Media** – Gratis, sin key |

---

## 2. Uso actual por funcionalidad

- **Transferencias (tokentx)**  
  - Principal: **Routescan** (`api.routescan.io/.../etherscan/api`, action=tokentx).  
  - En código se usa `ROUTESCAN_API_KEY` o, si no existe, `BASESCAN_API_KEY`.  
  - Cache: TransferCache en BD (sincronización incremental).

- **ABIs de contratos**  
  - Orden: BD (CustomAbi) → ABIs hardcodeados → **BaseScan** (`api.basescan.org`, getabi).  
  - Solo Base mainnet y Base Sepolia. Sin otro proveedor de ABI implementado.

- **Precio del token**  
  - Principal: **QuikNode** addon (`/addon/1051/v1/prices/{address}?target=aero`).  
  - Fallback: **DEX Screener** (`api.dexscreener.com/latest/dex/tokens/{address}`).

- **Liquidez (pools)**  
  - Principal: **DEX Screener** (pairs por token).  
  - Adicional: **Uniswap V4** vía StateView por RPC (no es API externa).

- **Top holders**  
  - Solo **Moralis** (`deep-index.moralis.io`, ERC20 owners, chain=base).  
  - Cache: HolderSnapshot en BD. Si no hay API key, la funcionalidad se degrada o falla.

- **RPC (lecturas on-chain)**  
  - Preferido: **QuikNode** (`NEXT_PUBLIC_QUICKNODE_URL`).  
  - Fallback en código: `mainnet.base.org`, `base.llamarpc.com`, `1rpc.io/base`.

---

## 3. Recomendaciones por tipo

### 3.1 Explorer / blockchain (transferencias + ABIs)

- **BaseScan**  
  - **Principal** para ABIs y datos de contratos en Base.  
  - Obtener key en: https://basescan.org/apis  
  - **Fallback sugerido (opcional):** Blockscout para Base (si en el futuro se quiere un segundo proveedor de ABI).

- **Routescan**  
  - **Principal** para transferencias en Base (compatible Etherscan, gratis con límites).  
  - Key opcional pero recomendada para más cuota: https://routescan.io  
  - **Fallback ya usado:** misma key de BaseScan en algunas rutas si no hay `ROUTESCAN_API_KEY`.

- **Etherscan**  
  - En la app se usa sobre todo **Routescan** para Base.  
  - `NEXT_PUBLIC_ETHERSCAN_API_KEY` tiene sentido si más adelante se soportan otras chains con Etherscan oficial.

### 3.2 RPC y precio

- **QuikNode (o otro RPC premium)**  
  - **Principal** para RPC y para el addon de precios (evita timeouts y rate limits del RPC público).  
  - **Fallback RPC:** ya implementado (mainnet.base.org, LlamaRPC, 1rpc).  
  - **Fallback precio:** DEX Screener ya está como segundo proveedor.

- **DEX Screener**  
  - Mantener como **principal** para liquidez y **fallback** para precio. No requiere key.

### 3.3 Holders

- **Moralis**  
  - **Principal** para top holders.  
  - **Fallback recomendado (a implementar si se desea robustez):**  
    - Usar solo cache (HolderSnapshot) y marcar datos como “antiguos” si no hay key, o  
    - Integrar otro proveedor (p. ej. Covalent, Helius, Alchemy) como segundo origen.

### 3.4 Otros servicios (opcionales)

- **Resend** – Emails (invitaciones). Sin key la app sigue funcionando; no envía correos.
- **Vottun** – Supply (total/circulating) y endpoints de usuario. Solo si sigues usando ese ecosistema.
- **Stripe** – Para facturación SaaS (guardado en SystemSettings).
- **Google OAuth** – Login social (opcional).

---

## 4. Resumen mínimo para producción

- **Imprescindibles:**  
  - BaseScan (key).  
  - Routescan o BaseScan (key) para transferencias.  
  - RPC estable (QuikNode o similar) para evitar timeouts.

- **Muy recomendables:**  
  - Moralis (key) para top holders.  
  - QuikNode (o RPC + addon precio) para precios en tiempo real; si no, solo DEX Screener.

- **Sin key / fallback ya cubierto:**  
  - DEX Screener (liquidez + fallback precio).  
  - RPC públicos como fallback de QuikNode.

---

## 5. Variables de entorno relacionadas

```env
# Explorer / transfers
NEXT_PUBLIC_BASESCAN_API_KEY=    # BaseScan (ABIs + fallback transfers)
NEXT_PUBLIC_ROUTESCAN_API_KEY=   # Routescan (transfers Base) – opcional si usas BaseScan
NEXT_PUBLIC_ETHERSCAN_API_KEY=   # Por si se usan otras chains Etherscan

# RPC y precio
NEXT_PUBLIC_QUICKNODE_URL=       # RPC + addon precios

# Holders
NEXT_PUBLIC_MORALIS_API_KEY=     # Top holders

# Opcionales
RESEND_API_KEY=                  # Emails
RESEND_FROM_EMAIL=
GOOGLE_CLIENT_ID=                # OAuth
GOOGLE_CLIENT_SECRET=
```

Las keys por defecto también se pueden configurar en **SystemSettings** (admin) y por token en **Token.settings** (custom keys).

---

*Documento generado a partir de CLAUDE.md y del análisis del código (blockchain.ts, token-analytics, health, settings, etc.).*
