# Explorador de Blockchain Base

Una aplicación web completa para explorar datos en la blockchain Base, incluyendo balances de tokens, transferencias, información de vesting y airdrops.

## Características

- **Balance de Tokens**: Consulta los balances de tokens en una wallet específica
- **Transferencias**: Visualiza las transferencias de tokens enviados y recibidos
- **Información de Vesting**: Consulta detalles de vesting para una wallet y contrato específicos
- **Resumen de Vesting**: Verifica el estado general de un contrato de vesting
- **Airdrops**: Visualiza información sobre airdrops recibidos
- **Múltiples Redes**: Soporte para diferentes redes de Base
  - Base Mainnet
  - Base Testnet (Goerli)
  - Base Testnet (Sepolia)
- **API RESTful**: Endpoints para integrar con otros proyectos

## Tecnologías

- **Frontend**: Next.js 14, React 18, TypeScript
- **Estilos**: Tailwind CSS
- **Blockchain**: ethers.js v6 para interactuar con las redes blockchain
- **API**: Integración con BaseScan para obtener datos adicionales

## Estructura del Proyecto

```
/
├── scripts/                   # Scripts de utilidad
│   └── getAllAbis.js          # Script para obtener ABIs de contratos de vesting
├── src/
│   ├── app/
│   │   ├── api/               # Rutas de API
│   │   │   └── tokens/
│   │   │       ├── balance/   # API para balances de tokens
│   │   │       └── transfers/ # API para transferencias de tokens
│   │   ├── docs/              # Documentación de la API
│   │   ├── explorer/
│   │   │   └── tokens/        # Explorador de tokens
│   │   ├── globals.css        # Estilos globales
│   │   ├── layout.tsx         # Layout principal
│   │   └── page.tsx           # Página principal
│   ├── components/            # Componentes reutilizables
│   │   ├── AirdropAssignments.tsx  # Componente para mostrar airdrops
│   │   ├── NetworkSelector.tsx     # Selector de red blockchain
│   │   ├── TabsContainer.tsx       # Contenedor de pestañas
│   │   ├── TokenBalance.tsx        # Componente de balance de tokens
│   │   ├── TokenFilter.tsx         # Filtro de tokens
│   │   ├── TokenTransfersList.tsx  # Lista de transferencias
│   │   ├── VestingInfo.tsx         # Información de vesting
│   │   ├── VestingSummary.tsx      # Resumen de contratos de vesting
│   │   └── WalletInput.tsx         # Input para dirección de wallet
│   └── lib/                   # Bibliotecas y utilidades
│       ├── blockchain.ts           # Funciones para interactuar con blockchains
│       ├── contractAbis.ts         # ABIs precargados de contratos de vesting
│       ├── types.ts                # Definiciones de tipos
│       ├── utils.ts                # Funciones de utilidad
│       ├── vestingContractHelpers.ts # Helpers para contratos de vesting
│       └── vestingHelpers.ts       # Funciones auxiliares de vesting
├── package.json
├── tsconfig.json
└── next.config.js
```

## Instalación

1. Clona este repositorio
2. Instala las dependencias:
   ```bash
   npm install
   # o
   yarn install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   # o
   yarn dev
   ```
4. Abre [http://localhost:3000](http://localhost:3000) en tu navegador

## Descripción de los Archivos Principales

### Biblioteca Principal (src/lib)

- **blockchain.ts**: Contiene todas las funciones para interactuar con la blockchain, organizadas por pestañas:
  - **Balance de Tokens**: Funciones para obtener balances de tokens
  - **Transferencias**: Funciones para obtener transferencias de tokens
  - **Información de Vesting**: Funciones para obtener información de vesting para una wallet
  - **Resumen de Vesting**: Funciones para verificar el estado de un contrato de vesting

- **contractAbis.ts**: Almacena los ABIs precargados de contratos de vesting para reducir llamadas a BaseScan

- **vestingHelpers.ts**: Funciones auxiliares para procesar información de vesting

- **vestingContractHelpers.ts**: Funciones específicas para trabajar con diferentes tipos de contratos de vesting

### Componentes (src/components)

- **TokenBalance.tsx**: Muestra los balances de tokens de una wallet

- **TokenTransfersList.tsx**: Muestra las transferencias de tokens

- **VestingInfo.tsx**: Muestra información detallada de vesting para una wallet y contrato

- **VestingSummary.tsx**: Muestra un resumen del estado de un contrato de vesting

- **AirdropAssignments.tsx**: Muestra información sobre airdrops recibidos

## Uso de la API

### Obtener Transferencias de Tokens

```
GET /api/tokens/transfers?wallet=0x...&network=base&token=WETH
```

Parámetros:
- `wallet`: Dirección de la wallet a consultar (requerido)
- `network`: Red blockchain a utilizar ('base', 'base-testnet' o 'base-sepolia') (opcional)
- `token`: Filtro para tokens específicos (dirección o símbolo) (opcional)

### Obtener Balance de Tokens

```
GET /api/tokens/balance?wallet=0x...&network=base
```

Parámetros:
- `wallet`: Dirección de la wallet a consultar (requerido)
- `network`: Red blockchain a utilizar ('base', 'base-testnet' o 'base-sepolia') (opcional)

### Obtener Información de Vesting

```
GET /api/vesting/info?wallet=0x...&contract=0x...&network=base
```

Parámetros:
- `wallet`: Dirección de la wallet a consultar (requerido)
- `contract`: Dirección del contrato de vesting (requerido)
- `network`: Red blockchain a utilizar ('base', 'base-testnet' o 'base-sepolia') (opcional)

### Verificar Estado de Contrato de Vesting

```
GET /api/vesting/status?contract=0x...&network=base
```

Parámetros:
- `contract`: Dirección del contrato de vesting (requerido)
- `network`: Red blockchain a utilizar ('base', 'base-testnet' o 'base-sepolia') (opcional)

## Características Implementadas Recientemente

- **Optimización de ABIs**: Almacenamiento de ABIs precargados para reducir llamadas a BaseScan
- **Soporte para múltiples tipos de contratos de vesting**: Compatibilidad con diferentes implementaciones
- **Resumen de Vesting**: Nueva pestaña para verificar el estado de contratos de vesting
- **Soporte para Base Sepolia**: Añadida red de pruebas Sepolia

## Próximas Características

- Mejoras en la detección de tokens liberables en contratos de vesting
- Soporte para más redes blockchain
- Explorador de NFTs
- Historial detallado de transacciones
- Integración con proveedores de precios para valores en USD más precisos
