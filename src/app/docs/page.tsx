'use client';

import React from 'react';
import Link from 'next/link';

export default function ApiDocs() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Documentación de la API</h1>

      <div className="bg-card p-6 rounded-lg shadow-md mb-8 border border-border">
        <h2 className="text-xl font-semibold mb-4">Introducción</h2>
        <p className="mb-4">
          Esta API te permite consultar datos de diferentes blockchains, centrándose en la información
          de tokens y transferencias. Actualmente soportamos las redes Base Mainnet y Base Testnet.
        </p>
      </div>

      <div className="bg-card p-6 rounded-lg shadow-md mb-8 border border-border">
        <h2 className="text-xl font-semibold mb-4">Endpoints</h2>

        <div className="mb-6 border-b pb-6">
          <h3 className="text-lg font-medium mb-2">GET /api/tokens/transfers</h3>
          <p className="mb-2">Obtiene las transferencias de tokens para una dirección de wallet específica.</p>
          
          <div className="bg-muted p-4 rounded-md mb-4">
            <h4 className="font-medium mb-2">Parámetros</h4>
            <ul className="list-disc pl-6">
              <li className="mb-1"><code className="bg-muted px-1 rounded">wallet</code> - Dirección de la wallet a consultar (requerido)</li>
              <li className="mb-1"><code className="bg-muted px-1 rounded">network</code> - Red blockchain a utilizar ('base' o 'base-testnet') (opcional, por defecto: 'base')</li>
              <li className="mb-1"><code className="bg-muted px-1 rounded">token</code> - Filtro para tokens específicos (dirección o símbolo) (opcional)</li>
            </ul>
          </div>
          
          <div className="bg-muted p-4 rounded-md">
            <h4 className="font-medium mb-2">Ejemplo de respuesta</h4>
            <pre className="bg-muted text-success p-4 rounded-md overflow-x-auto">
{`[
  {
    "tokenAddress": "0x4200000000000000000000000000000000000006",
    "tokenSymbol": "WETH",
    "tokenName": "Wrapped Ether",
    "from": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "to": "0x123...abc",
    "amount": "0.5",
    "timestamp": 1679012345,
    "transactionHash": "0x1234...abcd"
  },
  {
    "tokenAddress": "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",
    "tokenSymbol": "USDbC",
    "tokenName": "USD Base Coin",
    "from": "0x123...def",
    "to": "0x123...abc",
    "amount": "100",
    "timestamp": 1679012345,
    "transactionHash": "0xabcd...1234"
  }
]`}
            </pre>
          </div>
        </div>

        <div className="mb-6 border-b pb-6">
          <h3 className="text-lg font-medium mb-2">GET /api/tokens/balance</h3>
          <p className="mb-2">Obtiene el balance de tokens para una dirección de wallet específica.</p>
          
          <div className="bg-muted p-4 rounded-md mb-4">
            <h4 className="font-medium mb-2">Parámetros</h4>
            <ul className="list-disc pl-6">
              <li className="mb-1"><code className="bg-muted px-1 rounded">wallet</code> - Dirección de la wallet a consultar (requerido)</li>
              <li className="mb-1"><code className="bg-muted px-1 rounded">network</code> - Red blockchain a utilizar ('base' o 'base-testnet') (opcional, por defecto: 'base')</li>
            </ul>
          </div>
          
          <div className="bg-muted p-4 rounded-md">
            <h4 className="font-medium mb-2">Ejemplo de respuesta</h4>
            <pre className="bg-muted text-success p-4 rounded-md overflow-x-auto">
{`[
  {
    "tokenAddress": "0x4200000000000000000000000000000000000006",
    "tokenSymbol": "WETH",
    "tokenName": "Wrapped Ether",
    "balance": "1.5",
    "decimals": 18,
    "usdValue": 3000
  },
  {
    "tokenAddress": "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",
    "tokenSymbol": "USDbC",
    "tokenName": "USD Base Coin",
    "balance": "250",
    "decimals": 6,
    "usdValue": 250
  }
]`}
            </pre>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-lg shadow-md border border-border">
        <h2 className="text-xl font-semibold mb-4">Implementación</h2>
        <p className="mb-4">
          Para implementar estas APIs en tu proyecto, puedes crear rutas API en Next.js que utilicen
          la biblioteca ethers.js para interactuar con las blockchains.
        </p>
        <Link href="/dashboard" className="btn-primary inline-block">
          Probar el Explorador
        </Link>
      </div>
    </div>
  );
}
