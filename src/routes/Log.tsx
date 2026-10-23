import Icon, { type IconName } from '../components/Icon';
import { getPreset, isProviderConfigured } from '../ai/presets';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useFavorites, useSettingsLoaded } from '../db/hooks';
import { DEFAULT_SETTINGS } from '../db/defaults';
import { addEntry, deleteFavorite, touchFavorite } from '../db/repo';
import type { Favorite } from '../db/types';
import { guessMeal, safeDayKey } from '../lib/dates';
import { mealFromParam } from '../lib/meals';
import { entryTotals } from '../nutrition/totals';

export default function Log() {
  const [params] = useSearchParams();
  const loaded = useSettingsLoaded();
  const settings = loaded ?? DEFAULT_SETTINGS;
  const navigate = useNavigate();
  const favorites = useFavorites(12) ?? [];
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  const vision = settings.provider.supportsVision;
  const preset = getPreset(settings.provider.preset);
  // Assume configured until settings arrive so the setup copy never flashes.
  const configured = loaded ? isProviderConfigured(settings.provider) : true;
  const canPhoto = vision && configured;

  const [logging, setLogging] = useState<string | null>(null);

  async function logFavorite(fav: Favorite) {
    if (logging) return; // a second tap must not log the meal twice
    setLogging(fav.id);
    try {
      await addEntry({
        dayKey: safeDayKey(params.get('day')),
        meal: mealFromParam(params.get('meal')) ?? guessMeal(new Date(), settings.mealCutoffs),
        items: fav.items.map((i) => ({ ...i, source: 'favorite' as const })),
      });
      await touchFavorite(fav.id);
      navigate(`/home?day=${safeDayKey(params.get('day'))}`);
    } finally {
      setLogging(null);
    }
  }

  async function removeFavorite(fav: Favorite) {
    if (confirm(`Remove "${fav.name}" from favorites?`)) await deleteFavorite(fav.id);
  }

  return (
    <div className="space-y-4">
      <header className="screen-heading">
        <h1>Log your food.</h1>
        <p>
          A photo, a few words, or the numbers.
          <br />
          Make it work for you.
        </p>
      </header>
      <section className="photo-hero" aria-labelledby="photo-title">
        <div className="hero-camera">
          <Icon name="camera" size={42} />
        </div>
        <p className="eyebrow">PHOTO LOGGING</p>
        <h2 id="photo-title">
          Snap it.
          <br />
          Know your plate.
        </h2>
        <p>
          {canPhoto
            ? 'Your AI estimates the calories and macros. You review every detail before saving.'
            : configured
              ? `${settings.provider.model} (${preset.name}) can't read images. Pick a vision model in Settings, or describe your meal instead.`
              : `Add your ${preset.name} key in Settings to start. Free tiers work. No subscription needed.`}
        </p>
        <Link to={canPhoto ? `/log/photo${suffix}` : '/settings'} className="btn">
          <Icon name={canPhoto ? 'camera' : 'settings'} size={18} />
          {canPhoto ? 'Take a photo' : configured ? 'Choose a vision model' : 'Add your API key'}
          <Icon name="arrow" size={16} />
        </Link>
      </section>
      <div className="log-options">
        <Tile to={`/log/text${suffix}`} title="Describe it" hint="In your own words" icon="edit" />
        <Tile to={`/log/barcode${suffix}`} title="Scan barcode" hint="Packaged food" icon="scan" />
        <Tile
          to={`/entry/new${suffix}`}
          title="Add manually"
          hint="You know the numbers"
          icon="plus"
        />
      </div>
      <p className="privacy-footnote">
        <Icon name="shield" size={13} />
        Your log stays here. AI runs with your chosen provider.
      </p>

      <section aria-labelledby="favorites-heading" className="space-y-2">
        <h2 id="favorites-heading" className="text-xl font-semibold">
          Favorites
        </h2>
        {favorites.length === 0 ? (
          <div className="favorites-empty">
            <Icon name="heart" size={24} />
            <p>Your go-to meals, one tap away.</p>
            <small>
              Save a meal as a favorite after logging it.
              <br />
              It’ll be waiting here next time.
            </small>
          </div>
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
                    disabled={logging !== null}
                    onClick={() => void logFavorite(fav)}
                  >
                    {logging === fav.id ? 'Logging…' : 'Log'}
                  </button>
                  <button
                    type="button"
                    className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:text-red-600"
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
}: {
  to: string;
  title: string;
  hint: string;
  icon: IconName;
}) {
  return (
    <Link to={to} className="card log-option">
      <Icon name={icon} size={24} />
      <span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
    </Link>
  );
}
