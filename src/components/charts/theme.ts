/** Shared chart colors follow the app theme, including dark mode. */
export const CHART = {
  primary: 'var(--ink)', // trend lines and bars
  secondary: '#769bc8', // raw daily points
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
