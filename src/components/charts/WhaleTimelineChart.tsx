'use client';

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';

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

interface WhaleTimelineChartProps {
  transfers: TokenTransfer[];
  threshold?: number;
  tokenSymbol?: string;
}

export default function WhaleTimelineChart({ transfers, threshold = 10000, tokenSymbol = 'tokens' }: WhaleTimelineChartProps) {
  // Filtrar solo transferencias grandes
  const largeTransfers = transfers.filter(t => t.isLargeTransfer);

  // Preparar datos para el scatter plot
  const data = largeTransfers.map(t => ({
    timestamp: t.timestamp * 1000, // Convertir a ms
    amount: parseFloat(t.valueFormatted),
    hash: t.hash,
    from: `${t.from.slice(0, 6)}...${t.from.slice(-4)}`,
    to: `${t.to.slice(0, 6)}...${t.to.slice(-4)}`,
  })).slice(0, 100); // Limitar a 100 puntos

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const date = new Date(data.timestamp);
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">
            {data.amount.toLocaleString()} {tokenSymbol}
          </p>
          <p className="text-sm text-gray-600">
            {date.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">
            De: {data.from}
          </p>
          <p className="text-xs text-gray-500">
            A: {data.to}
          </p>
        </div>
      );
    }
    return null;
  };

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Timeline de Movimientos Grandes</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="timestamp"
            name="Fecha"
            tickFormatter={formatXAxis}
            domain={['auto', 'auto']}
          />
          <YAxis
            type="number"
            dataKey="amount"
            name="Cantidad"
            tickFormatter={formatYAxis}
          />
          <ZAxis range={[50, 400]} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter
            name="Transferencias"
            data={data}
            fill="#F59E0B"
            fillOpacity={0.6}
          />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <span className="font-semibold">Total mostrado:</span> {data.length} transferencias grandes
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Umbral: {threshold.toLocaleString()} {tokenSymbol}
        </p>
      </div>
    </div>
  );
}
