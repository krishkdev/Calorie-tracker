import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFavorites, useSettings } from '../db/hooks';
import { addEntry, deleteFavorite, touchFavorite } from '../db/repo';
import type { Favorite, MealType } from '../db/types';
import { guessMeal, todayKey } from '../lib/dates';
import { entryTotals } from '../nutrition/totals';

export default function Log() {
  const [params] = useSearchParams();
  const settings = useSettings();
  const navigate = useNavigate();
  const favorites = useFavorites(12) ?? [];
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  const vision = settings.provider.supportsVision;

  async function logFavorite(fav: Favorite) {
    await addEntry({
      dayKey: params.get('day') ?? todayKey(),
      meal: (params.get('meal') as MealType | null) ?? guessMeal(new Date(), settings.mealCutoffs),
      items: fav.items.map((i) => ({ ...i, source: 'favorite' as const })),
    });
    await touchFavorite(fav.id);
    navigate('/home');
  }

  async function removeFavorite(fav: Favorite) {
    if (confirm(`Remove "${fav.name}" from favorites?`)) await deleteFavorite(fav.id);
  }

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

      <section aria-labelledby="favorites-heading" className="space-y-2">
        <h2 id="favorites-heading" className="font-semibold">
          Favorites
        </h2>
        {favorites.length === 0 ? (
          <p className="text-sm text-gray-500">
            Save any entry as a favorite from its review screen to log it again in one tap.
          </p>
        ) : (
          <ul className="space-y-2">
            {favorites.map((fav) => {
              const t = entryTotals(fav.items);
              return (
                <li key={fav.id} className="card flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{fav.name}</p>
                    <p className="text-xs text-gray-500">
                      {t.kcal} kcal · P {Math.round(t.proteinG)} · C {Math.round(t.carbsG)} · F{' '}
                      {Math.round(t.fatG)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary min-h-9 px-3 py-1 text-sm"
                    onClick={() => void logFavorite(fav)}
                  >
                    Log
                  </button>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full text-gray-400 hover:text-red-600"
                    aria-label={`Remove ${fav.name}`}
                    onClick={() => void removeFavorite(fav)}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
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
