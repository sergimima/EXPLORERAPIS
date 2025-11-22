'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-8">Blockchain Explorer API</h1>
      
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <p className="text-lg mb-6">
          Bienvenido a tu explorador de blockchain. Esta herramienta te permite consultar datos
          en diferentes blockchains, como Base y Base Testnet.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Dashboard Unificado - Destacado */}
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-lg text-white shadow-lg md:col-span-2">
            <h2 className="text-2xl font-bold mb-3 flex items-center">
              <span className="mr-2">🚀</span>
              Dashboard Completo
            </h2>
            <p className="mb-4 text-blue-50">
              Accede a todas las funcionalidades en un solo lugar: tokens, balances, vesting contracts y analytics avanzado.
            </p>
            <Link href="/dashboard" className="inline-block bg-white text-blue-600 font-semibold px-6 py-3 rounded-md hover:bg-blue-50 transition-colors">
              Ir al Dashboard →
            </Link>
          </div>

          {/* Accesos directos individuales */}
          <div className="bg-blue-50 p-4 rounded-md">
            <h2 className="text-xl font-semibold mb-2">Explorador de Tokens</h2>
            <p className="mb-4">Consulta los tokens enviados a una wallet y filtra por tipos específicos.</p>
            <Link href="/explorer/tokens" className="btn-primary">
              Ir al Explorador
            </Link>
          </div>

          <div className="bg-purple-50 p-4 rounded-md">
            <h2 className="text-xl font-semibold mb-2">Resumen de Vestings</h2>
            <p className="mb-4">Verifica el estado de los contratos de vesting y los tokens liberables.</p>
            <Link href="/explorer/vestings" className="btn-primary">
              Ver Vestings
            </Link>
          </div>

          <div className="bg-orange-50 p-4 rounded-md">
            <h2 className="text-xl font-semibold mb-2">Análisis de Token VTN</h2>
            <p className="mb-4">Analiza movimientos grandes, holders y actividad del token para entender fluctuaciones de precio.</p>
            <Link href="/explorer/analytics" className="btn-primary">
              Ver Análisis
            </Link>
          </div>

          <div className="bg-green-50 p-4 rounded-md">
            <h2 className="text-xl font-semibold mb-2">Documentación API</h2>
            <p className="mb-4">Consulta la documentación de nuestras APIs para integrarlas en tus proyectos.</p>
            <Link href="/docs" className="btn-primary">
              Ver Documentación
            </Link>
          </div>
        </div>
        
        <div className="bg-gray-100 p-4 rounded-md">
          <h2 className="text-xl font-semibold mb-2">Redes Soportadas</h2>
          <ul className="list-disc pl-6">
            <li className="mb-1">Base Mainnet</li>
            <li className="mb-1">Base Testnet (Goerli)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
