import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyCalories } from '../../db/hooks';
import { formatShortDate } from '../../lib/dates';
import { CHART, tooltipStyle } from './theme';

interface Props {
  days: DailyCalories[];
  target: number;
}

export default function CaloriesChart({ days, target }: Props) {
  const data = days.map((d) => ({
    ...d,
    label: formatShortDate(d.dayKey),
    kcal: Math.round(d.kcal),
  }));
  const logged = data.filter((d) => d.kcal > 0);
  const avg = logged.length
    ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length)
    : 0;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="text-gray-500">
          Average on logged days{' '}
          <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {avg} kcal
          </span>
        </span>
        {target > 0 && (
          <span className="text-gray-500">
            Target <span className="tabular-nums">{target}</span>
          </span>
        )}
      </div>
      <div
        className="h-52 w-full"
        role="img"
        aria-label="Calories eaten per day against your target"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barCategoryGap={days.length > 10 ? 2 : 6}
          >
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART.axis }}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART.axis }}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
            />
            <Tooltip
              {...tooltipStyle}
              cursor={{ fill: 'rgba(128,128,128,0.12)' }}
              formatter={(v) => [`${v} kcal`, 'Eaten']}
            />
            {target > 0 && <ReferenceLine y={target} stroke={CHART.target} strokeDasharray="4 4" />}
            <Bar
              dataKey="kcal"
              fill={CHART.primary}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
