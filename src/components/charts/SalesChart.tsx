import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { rupiah } from '../../lib/formatting';
export function SalesChart({
  data,
  metric = 'revenue',
}: {
  data: { date: string; revenue: number; profit?: number; units?: number }[];
  metric?: 'revenue' | 'profit' | 'units';
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2b8b70" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2b8b70" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e8eeeb" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) =>
              metric === 'units' || Math.abs(Number(v)) < 1000
                ? String(v)
                : Number(v) >= 1000000
                  ? `${Number(v) / 1000000}jt`
                  : `${Number(v) / 1000}rb`
            }
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip formatter={(v) => (metric === 'units' ? String(v) : rupiah(String(v)))} />
          <Area
            type="monotone"
            dataKey={metric}
            name={metric === 'revenue' ? 'Penjualan' : metric === 'profit' ? 'Laba kotor' : 'Unit'}
            stroke="#248669"
            strokeWidth={2.5}
            fill="url(#revenue-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
