import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import FoodItemRow from '../components/FoodItemRow';
import { MEAL_LABELS, MEAL_ORDER } from '../lib/meals';
import { useEntry, useSettings } from '../db/hooks';
import { addEntry, addFavorite, deleteEntry, normalizeItem, updateEntry } from '../db/repo';
import type { FoodEntry, FoodItem, MealType } from '../db/types';
import { guessMeal, safeDayKey, todayKey } from '../lib/dates';
import { newId } from '../lib/id';
import { entryTotals } from '../nutrition/totals';

/** State other screens can pass in via navigate('/entry/new', { state }). */
export interface ReviewState {
  items?: Partial<FoodItem>[];
  note?: string;
  photoThumb?: Blob;
  meal?: MealType;
  dayKey?: string;
}

function blankItem(): FoodItem {
  return normalizeItem({ id: newId(), name: '', portion: '', quantity: 1, source: 'manual' });
}

/**
 * Route component: resolves the "new" vs "edit" case and waits for the stored
 * entry before mounting the form, so the form can take plain initial values.
 */
export default function ReviewEntry() {
  const { id } = useParams();
  const existing = useEntry(id);
  const location = useLocation();
  const [params] = useSearchParams();
  const settings = useSettings();

  if (id) {
    if (existing === undefined) return null; // loading
    if (existing === null) return <p className="text-gray-500">This entry no longer exists.</p>;
    return (
      <EntryForm
        key={existing.id}
        entryId={existing.id}
        initialMeal={existing.meal}
        initialDayKey={existing.dayKey}
        initialNote={existing.note ?? ''}
        initialItems={existing.items}
      />
    );
  }

  const incoming = (location.state ?? {}) as ReviewState;
  const initialItems = incoming.items?.length
    ? incoming.items.map((i) => normalizeItem({ ...i, name: i.name ?? '' }))
    : [blankItem()];
  return (
    <EntryForm
      initialMeal={
        incoming.meal ??
        (params.get('meal') as MealType | null) ??
        guessMeal(new Date(), settings.mealCutoffs)
      }
      initialDayKey={safeDayKey(incoming.dayKey ?? params.get('day'))}
      initialNote={incoming.note ?? ''}
      initialItems={initialItems}
      photoThumb={incoming.photoThumb}
    />
  );
}

interface FormProps {
  entryId?: FoodEntry['id'];
  initialMeal: MealType;
  initialDayKey: string;
  initialNote: string;
  initialItems: FoodItem[];
  photoThumb?: Blob;
}

function EntryForm({
  entryId,
  initialMeal,
  initialDayKey,
  initialNote,
  initialItems,
  photoThumb,
}: FormProps) {
  const id = entryId;
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [dayKey, setDayKey] = useState(initialDayKey);
  const [note] = useState(initialNote);
  const [items, setItems] = useState<FoodItem[]>(initialItems);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => entryTotals(items), [items]);
  const valid = items.length > 0 && items.every((i) => i.name.trim().length > 0 && i.quantity > 0);

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      if (isEdit && id) {
        await updateEntry(id, { meal, dayKey, items, note: note || undefined });
      } else {
        await addEntry({ meal, dayKey, items, note: note || undefined, photoThumb });
      }
      navigate(`/home?day=${dayKey}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id || !confirm('Delete this entry?')) return;
    await deleteEntry(id);
    navigate(`/home?day=${dayKey}`, { replace: true });
  }

  // Inline instead of prompt()/alert(): installed PWAs may suppress native dialogs.
  const [favName, setFavName] = useState<string | null>(null);
  const [favStatus, setFavStatus] = useState<string | null>(null);

  function openFavorite() {
    setFavStatus(null);
    setFavName(
      items
        .map((i) => i.name.trim())
        .filter(Boolean)
        .join(', ')
        .slice(0, 40),
    );
  }

  async function saveFavorite() {
    const name = favName?.trim();
    if (!name) return;
    await addFavorite(name, items);
    setFavName(null);
    setFavStatus(`Saved "${name}" to favorites.`);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <header className="flex items-center justify-between">
        <button type="button" className="text-brand-600" onClick={() => navigate(-1)}>
          ‹ Back
        </button>
        <h1 className="text-lg font-bold">{isEdit ? 'Edit entry' : 'Review & save'}</h1>
        <span className="w-12" />
      </header>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Meal</span>
          <select
            className="input"
            value={meal}
            onChange={(e) => setMeal(e.target.value as MealType)}
          >
            {MEAL_ORDER.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Date</span>
          <input
            type="date"
            className="input"
            value={dayKey}
            max={todayKey()}
            onChange={(e) => e.target.value && setDayKey(safeDayKey(e.target.value))}
          />
        </label>
      </div>

      {note && (
        <p className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          “{note}”
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <FoodItemRow
            key={item.id}
            item={item}
            onChange={(next) => setItems((list) => list.map((i) => (i.id === item.id ? next : i)))}
            onRemove={() => setItems((list) => list.filter((i) => i.id !== item.id))}
          />
        ))}
      </ul>

      <button
        type="button"
        className="btn btn-secondary w-full"
        onClick={() => setItems((l) => [...l, blankItem()])}
      >
        + Add another item
      </button>

      <div className="card flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-xs text-gray-500">
            P {totals.proteinG} · C {totals.carbsG} · F {totals.fatG}
          </p>
        </div>
        <p className="text-2xl font-bold tabular-nums">{totals.kcal} kcal</p>
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={!valid || saving}>
        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save entry'}
      </button>

      {favName !== null && (
        <div className="card space-y-2">
          <label className="block">
            <span className="label">Favorite name</span>
            <input
              className="input"
              value={favName}
              autoFocus
              maxLength={60}
              onChange={(e) => setFavName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void saveFavorite();
                }
              }}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={!favName.trim()}
              onClick={() => void saveFavorite()}
            >
              Save favorite
            </button>
            <button
              type="button"
              className="btn btn-secondary flex-1"
              onClick={() => setFavName(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {favStatus && (
        <p className="text-center text-sm text-gray-600 dark:text-gray-400" role="status">
          {favStatus}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-secondary flex-1"
          disabled={!valid || favName !== null}
          onClick={openFavorite}
        >
          ☆ Save as favorite
        </button>
        {isEdit && (
          <button type="button" className="btn btn-danger flex-1" onClick={() => void remove()}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
