/** Chart colors validated for both light and dark surfaces (see docs/dataviz note in CONTRIBUTING). */
export const CHART = {
  primary: '#16a34a', // brand green: trend lines, bars
  secondary: '#3b82f6', // blue: raw daily points
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.9)',
  target: 'rgba(128,128,128,0.75)',
} as const;

export const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid rgba(128,128,128,0.25)',
    background: 'var(--chart-tooltip-bg)',
    color: 'inherit',
    fontSize: 12,
    padding: '6px 10px',
  },
  labelStyle: { fontWeight: 600, marginBottom: 2 },
  itemStyle: { padding: 0 },
} as const;
