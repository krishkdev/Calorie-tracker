interface Props {
  consumed: number;
  target: number;
}

export default function CalorieRing({ consumed, target }: Props) {
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  const over = target > 0 && consumed > target;
  const remaining = Math.round(target - consumed);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-gray-200 dark:stroke-gray-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            className={`transition-[stroke-dashoffset] duration-500 ${
              over ? 'stroke-red-500' : 'stroke-brand-500'
            }`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tabular-nums">{Math.abs(remaining)}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {over ? 'kcal over' : 'kcal left'}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {Math.round(consumed)}
        </span>{' '}
        of {Math.round(target)} kcal eaten
      </p>
    </div>
  );
}
