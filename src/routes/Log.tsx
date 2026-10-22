import { Link, useSearchParams } from 'react-router-dom';
import { useSettings } from '../db/hooks';

export default function Log() {
  const [params] = useSearchParams();
  const settings = useSettings();
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  const vision = settings.provider.supportsVision;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Log food</h1>
      <div className="grid grid-cols-2 gap-3">
        <Tile to={`/log/text${suffix}`} title="Describe it" hint="“2 eggs and toast”" icon="✍️" />
        <Tile
          to={`/log/photo${suffix}`}
          title="Photo"
          hint={vision ? 'Snap your plate' : 'Needs a vision model'}
          icon="📷"
          disabled={!vision}
        />
        <Tile to={`/log/barcode${suffix}`} title="Scan barcode" hint="Packaged food" icon="▮▯▮" />
        <Tile to={`/entry/new${suffix}`} title="Manual" hint="Type the numbers" icon="＋" />
      </div>
      {!vision && (
        <p className="text-xs text-gray-500">
          Your current model ({settings.provider.model || 'not set'}) can't read images.{' '}
          <Link to="/settings" className="text-brand-600 underline">
            Switch to a vision model
          </Link>{' '}
          to enable photo logging.
        </p>
      )}
    </div>
  );
}

function Tile({
  to,
  title,
  hint,
  icon,
  disabled,
}: {
  to: string;
  title: string;
  hint: string;
  icon: string;
  disabled?: boolean;
}) {
  const cls = `card flex min-h-28 flex-col justify-between ${disabled ? 'opacity-50' : 'active:bg-gray-50 dark:active:bg-gray-800'}`;
  const body = (
    <>
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
    </>
  );
  if (disabled) {
    return (
      <div className={cls} aria-disabled="true">
        {body}
      </div>
    );
  }
  return (
    <Link to={to} className={cls}>
      {body}
    </Link>
  );
}
