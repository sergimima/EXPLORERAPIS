'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTheme } from '@/components/ThemeProvider';

interface DailyVolumeEntry {
  date: string;
  displayDate: string;
  totalVolume: number;
  exchangeVolume: number;
  whaleVolume: number;
  normalVolume: number;
  transactionCount: number;
}

interface DailyVolumeChartProps {
  data: DailyVolumeEntry[];
  days: number;
  tokenSymbol?: string;
  selectedDate?: string | null;
  onDayClick?: (date: string | null) => void;
}

export default function DailyVolumeChart({ data, days, tokenSymbol = 'tokens', selectedDate, onDayClick }: DailyVolumeChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const chartData = data.slice(-days);

  const handleBarClick = (barData: any) => {
    if (!onDayClick) return;
    const clickedDate = barData?.date;
    if (clickedDate === selectedDate) {
      onDayClick(null); // Deselect
    } else {
      onDayClick(clickedDate);
    }
  };

  const formatYAxis = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return value.toFixed(0);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload as DailyVolumeEntry;
      return (
        <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
          <p className="font-semibold text-card-foreground mb-1">{entry.displayDate}</p>
          <p className="text-sm text-muted-foreground mb-2">
            {entry.transactionCount} transferencias
          </p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="inline-block w-3 h-3 rounded mr-2" style={{ backgroundColor: '#EF4444' }}></span>
              Exchange: {entry.exchangeVolume.toLocaleString()} {tokenSymbol}
            </p>
            <p className="text-sm">
              <span className="inline-block w-3 h-3 rounded mr-2" style={{ backgroundColor: '#F59E0B' }}></span>
              Whale: {entry.whaleVolume.toLocaleString()} {tokenSymbol}
            </p>
            <p className="text-sm">
              <span className="inline-block w-3 h-3 rounded mr-2" style={{ backgroundColor: '#3B82F6' }}></span>
              Normal: {entry.normalVolume.toLocaleString()} {tokenSymbol}
            </p>
          </div>
          <p className="text-sm font-medium mt-2 pt-2 border-t border-border text-card-foreground">
            Total: {entry.totalVolume.toLocaleString()} {tokenSymbol}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-card-foreground">Volumen Diario por Tipo</h3>
        {selectedDate && (
          <button
            onClick={() => onDayClick?.(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cerrar detalle
          </button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          onClick={(state: any) => {
            if (state?.activePayload?.[0]?.payload) {
              handleBarClick(state.activePayload[0].payload);
            }
          }}
          style={{ cursor: onDayClick ? 'pointer' : undefined }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
          <XAxis dataKey="displayDate" stroke={isDark ? '#9CA3AF' : '#6B7280'} />
          <YAxis tickFormatter={formatYAxis} stroke={isDark ? '#9CA3AF' : '#6B7280'} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                exchangeVolume: 'Exchange',
                whaleVolume: 'Whale',
                normalVolume: 'Normal',
              };
              return labels[value] || value;
            }}
          />
          <Bar dataKey="exchangeVolume" stackId="volume" fill="#EF4444" radius={[0, 0, 0, 0]} opacity={selectedDate ? 0.4 : 1} />
          <Bar dataKey="whaleVolume" stackId="volume" fill="#F59E0B" radius={[0, 0, 0, 0]} opacity={selectedDate ? 0.4 : 1} />
          <Bar dataKey="normalVolume" stackId="volume" fill="#3B82F6" radius={[8, 8, 0, 0]} opacity={selectedDate ? 0.4 : 1} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#EF4444' }}></div>
            <span>Exchange (involucra CEX)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#F59E0B' }}></div>
            <span>Whale (transferencias grandes)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3B82F6' }}></div>
            <span>Normal</span>
          </div>
        </div>
        {onDayClick && !selectedDate && (
          <p className="text-xs text-muted-foreground mt-2">Click en una barra para ver las transferencias de ese dia</p>
        )}
      </div>
    </div>
  );
}
