import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Units, WeightEntry } from '../../db/types';
import { formatShortDate } from '../../lib/dates';
import { trailingAverage } from '../../lib/stats';
import { displayWeight, weightUnitLabel } from '../../nutrition/units';
import { CHART, tooltipStyle } from './theme';

interface Props {
  weights: WeightEntry[];
  units: Units;
  /** Points before this day feed the trend but are not drawn. */
  fromDayKey?: string;
  window?: number;
}

export default function WeightChart({ weights, units, fromDayKey, window = 7 }: Props) {
  const unit = weightUnitLabel(units);
  const data = trailingAverage(
    weights.map((w) => ({ dayKey: w.dayKey, value: displayWeight(w.weightKg, units) })),
    window,
  )
    .filter((p) => !fromDayKey || p.dayKey >= fromDayKey)
    .map((p) => ({ ...p, label: formatShortDate(p.dayKey) }));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">Log your weight to see the trend.</p>
    );
  }
  const values = data.map((d) => d.value);
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);

  return (
    <div className="h-56 w-full" role="img" aria-label={`Weight over time in ${unit}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: CHART.axis }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fontSize: 11, fill: CHART.axis }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v: number) => String(Math.round(v * 10) / 10)}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v, name) => [`${v} ${unit}`, name === 'avg' ? '7-day trend' : 'Logged']}
          />
          <Legend
            verticalAlign="top"
            height={24}
            iconType="plainline"
            formatter={(v) => (v === 'avg' ? '7-day trend' : 'Logged')}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART.secondary}
            strokeWidth={1.5}
            dot={{ r: 3, strokeWidth: 0, fill: CHART.secondary }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="avg"
            stroke={CHART.primary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
