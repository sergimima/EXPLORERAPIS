'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueFormatted: string;
  timestamp: number;
  blockNumber: number;
  isLargeTransfer: boolean;
}

interface ExchangeFlowChartProps {
  transfers: TokenTransfer[];
  days: number;
  tokenSymbol?: string;
}

const KNOWN_EXCHANGES = new Set([
  '0x3cd751e6b0078be393132286c442345e5dc49699',
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3',
  '0x503828976d22510aad0201ac7ec88293211d23da',
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe',
]);

function isExchange(address: string): boolean {
  return KNOWN_EXCHANGES.has(address.toLowerCase());
}

export default function ExchangeFlowChart({ transfers, days, tokenSymbol = 'tokens' }: ExchangeFlowChartProps) {
  // Agrupar por día y calcular net flow
  const flowByDay = new Map<string, number>();

  transfers.forEach(t => {
    const date = new Date(t.timestamp * 1000);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const fromIsExchange = isExchange(t.from);
    const toIsExchange = isExchange(t.to);
    const value = parseFloat(t.valueFormatted);

    if (!flowByDay.has(dateKey)) {
      flowByDay.set(dateKey, 0);
    }

    if (toIsExchange && !fromIsExchange) {
      // Entrando a exchange (positivo = presión de venta)
      flowByDay.set(dateKey, flowByDay.get(dateKey)! + value);
    } else if (fromIsExchange && !toIsExchange) {
      // Saliendo de exchange (negativo = menos presión)
      flowByDay.set(dateKey, flowByDay.get(dateKey)! - value);
    }
  });

  // Convertir a array y ordenar
  const data = Array.from(flowByDay.entries())
    .map(([date, netFlow]) => ({
      date,
      netFlow: parseFloat(netFlow.toFixed(0)),
      displayDate: new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days); // Solo últimos N días

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const netFlow = data.netFlow;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{data.displayDate}</p>
          <p className={`text-sm font-medium ${netFlow > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {netFlow > 0 ? '↑' : '↓'} {Math.abs(netFlow).toLocaleString()} {tokenSymbol}
          </p>
          <p className="text-xs text-gray-500">
            {netFlow > 0 ? 'Entrando a exchanges' : 'Saliendo de exchanges'}
          </p>
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Flujo Neto a Exchanges</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="displayDate" />
          <YAxis tickFormatter={formatYAxis} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#000" />
          <Bar dataKey="netFlow" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.netFlow > 0 ? '#EF4444' : '#10B981'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Entrando (presión de venta)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Saliendo (menos presión)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
