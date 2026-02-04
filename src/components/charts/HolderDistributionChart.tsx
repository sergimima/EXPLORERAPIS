'use client';
import { useTheme } from '@/components/ThemeProvider';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface HolderInfo {
  address: string;
  balance: string;
  percentage: string;
  isExchange: boolean;
  isContract: boolean;
  label?: string;
}

interface HolderDistributionChartProps {
  holders: HolderInfo[];
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

export default function HolderDistributionChart({ holders }: HolderDistributionChartProps) {
  // Calcular distribución
  const top10 = holders.slice(0, 10).reduce((sum, h) => sum + parseFloat(h.percentage), 0);
  const top50 = holders.slice(10, 50).reduce((sum, h) => sum + parseFloat(h.percentage), 0);
  const rest = 100 - top10 - top50;

  const data = [
    { name: 'Top 10 Holders', value: parseFloat(top10.toFixed(2)), count: 10 },
    { name: 'Top 11-50 Holders', value: parseFloat(top50.toFixed(2)), count: 40 },
    { name: 'Resto', value: parseFloat(rest.toFixed(2)), count: '?' },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">
            {data.value}% del supply
          </p>
          <p className="text-xs text-gray-500">
            ({data.count} holders)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Distribución de Holders</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <span className="font-semibold">Concentración Top 10:</span> {top10.toFixed(1)}%
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {top10 > 70 ? '⚠️ Alta concentración' : top10 > 50 ? '⚠️ Concentración media' : '✅ Distribución saludable'}
        </p>
      </div>
    </div>
  );
}
