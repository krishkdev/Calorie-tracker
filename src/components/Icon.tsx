import type { CSSProperties } from 'react';

export type IconName =
  | 'leaf'
  | 'home'
  | 'plus'
  | 'chart'
  | 'settings'
  | 'camera'
  | 'scan'
  | 'edit'
  | 'arrow'
  | 'chevron'
  | 'shield'
  | 'flame'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'spark'
  | 'sun'
  | 'moon'
  | 'bowl'
  | 'heart';

const paths: Record<IconName, React.ReactNode> = {
  leaf: (
    <>
      <path d="M20 4c-9-1-16 2-16 9a7 7 0 0 0 7 7c7 0 10-7 9-16Z" />
      <path d="M4 21 15 10M9 16v-5M9 16h5" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chart: (
    <>
      <path d="M4 4v16h16M8 15l4-5 4 2 4-7" />
    </>
  ),
  settings: (
    <>
      <path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  camera: (
    <>
      <path d="M8 6 9.5 3h5L16 6h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  scan: (
    <>
      <path d="M7 3H3v4M17 3h4v4M3 17v4h4M21 17v4h-4M7 8v8M10 8v8M14 8v8M17 8v8" />
    </>
  ),
  edit: (
    <>
      <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  flame: <path d="M12 3c1 5-5 6-5 10a5 5 0 0 0 10 0c0-2-1-4-2-5 0 4-3 4-3 4 2-4 2-6 0-9Z" />,
  protein: (
    <>
      <path d="m6 8 10 10a3 3 0 0 0 4-4L10 4a3 3 0 0 0-4 4ZM7 15l-3 3M3 16l5 5M4 17l3 3M9 12l3-3" />
    </>
  ),
  carbs: (
    <>
      <path d="M6 21 18 3M10 16C4 16 3 12 4 9c4 0 7 2 6 7ZM14 10c-5 0-6-3-5-6 4 0 6 2 5 6ZM11 16c1-5 4-6 8-5 0 4-3 6-8 5Z" />
    </>
  ),
  fat: <path d="M12 3c0 0-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12ZM9 16a3 3 0 0 0 3 3" />,
  fiber: (
    <>
      <path d="M12 21V9M12 9c-4 0-7-3-7-6 4 0 7 2 7 6ZM12 9c4 0 7-3 7-6-4 0-7 2-7 6ZM12 15c-4 0-6-2-7-5 4 0 6 1 7 5ZM12 15c4 0 6-2 7-5-4 0-6 1-7 5Z" />
    </>
  ),
  spark: (
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M5.6 18.4l2.2-2.2M16.2 7.8l2.2-2.2" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
  moon: <path d="M20 14A8 8 0 0 1 10 4 8 8 0 1 0 20 14Z" />,
  bowl: (
    <>
      <path d="M3 11h18a9 9 0 0 1-18 0ZM7 21h10M8 3v4M12 2v5M16 3v4" />
    </>
  ),
  heart: <path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 4 1 9 8 15 7-6 12-11 8-15Z" />,
};

export default function Icon({
  name,
  size = 22,
  className = '',
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
