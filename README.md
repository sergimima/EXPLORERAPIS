# Blockchain Explorer API

Una aplicación web para explorar datos en diferentes blockchains, enfocada inicialmente en Base y Base Testnet.

## Características

- **Explorador de Tokens**: Consulta los tokens enviados a una wallet específica
- **Filtrado**: Filtra por tokens específicos
- **Múltiples Redes**: Soporte para diferentes blockchains
  - Base Mainnet
  - Base Testnet (Goerli)
- **API RESTful**: Endpoints para integrar con otros proyectos

## Tecnologías

- **Frontend**: Next.js 14, React 18, TypeScript
- **Estilos**: Tailwind CSS
- **Blockchain**: ethers.js para interactuar con las redes blockchain

## Estructura del Proyecto

```
/
├── src/
│   ├── app/
│   │   ├── api/                # Rutas de API
│   │   │   └── tokens/
│   │   │       ├── balance/    # API para balances de tokens
│   │   │       └── transfers/  # API para transferencias de tokens
│   │   ├── docs/               # Documentación de la API
│   │   ├── explorer/
│   │   │   └── tokens/         # Explorador de tokens
│   │   ├── globals.css         # Estilos globales
│   │   ├── layout.tsx          # Layout principal
│   │   └── page.tsx            # Página principal
│   ├── components/             # Componentes reutilizables
│   │   ├── NetworkSelector.tsx
│   │   ├── TokenFilter.tsx
│   │   ├── TokenTransfersList.tsx
│   │   └── WalletInput.tsx
│   └── lib/
│       └── blockchain.ts       # Funciones para interactuar con blockchains
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

## Uso de la API

### Obtener Transferencias de Tokens

```
GET /api/tokens/transfers?wallet=0x...&network=base&token=WETH
```

Parámetros:
- `wallet`: Dirección de la wallet a consultar (requerido)
- `network`: Red blockchain a utilizar ('base' o 'base-testnet') (opcional)
- `token`: Filtro para tokens específicos (dirección o símbolo) (opcional)

### Obtener Balance de Tokens

```
GET /api/tokens/balance?wallet=0x...&network=base
```

Parámetros:
- `wallet`: Dirección de la wallet a consultar (requerido)
- `network`: Red blockchain a utilizar ('base' o 'base-testnet') (opcional)

## Próximas Características

- Soporte para más redes blockchain
- Explorador de NFTs
- Historial de transacciones
- Integración con proveedores de precios para valores en USD más precisos
