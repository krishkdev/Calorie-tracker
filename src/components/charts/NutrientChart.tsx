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
import { METRICS, type Metric } from './metrics';
import { CHART, tooltipStyle } from './theme';

interface Props {
  days: DailyCalories[];
  target: number;
  metric?: Metric;
}

/** One bar per day for a nutrient against its target line. */
export default function NutrientChart({ days, target, metric = 'kcal' }: Props) {
  const meta = METRICS[metric];
  const data = days.map((d) => ({
    ...d,
    label: formatShortDate(d.dayKey),
    value: Math.round(d[metric]),
  }));
  const logged = data.filter((d) => d.logged);
  const avg = logged.length
    ? Math.round(logged.reduce((s, d) => s + d.value, 0) / logged.length)
    : 0;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="text-gray-500">
          Average on logged days{' '}
          <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {avg} {meta.unit}
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
        aria-label={`${meta.label} per day against your target`}
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
              formatter={(v) => [`${v} ${meta.unit}`, 'Eaten']}
            />
            {target > 0 && <ReferenceLine y={target} stroke={CHART.target} strokeDasharray="4 4" />}
            <Bar
              dataKey="value"
              fill={meta.color}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
