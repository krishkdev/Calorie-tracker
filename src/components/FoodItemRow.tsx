import { useState } from 'react';
import type { FoodItem } from '../db/types';
import { itemMacros } from '../nutrition/totals';

interface Props {
  item: FoodItem;
  onChange: (item: FoodItem) => void;
  onRemove: () => void;
}

/** One editable food line: name, portion, quantity stepper, and expandable base macros. */
export default function FoodItemRow({ item, onChange, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const eff = itemMacros(item);
  const set = <K extends keyof FoodItem>(key: K, value: FoodItem[K]) =>
    onChange({ ...item, [key]: value });
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <li className="card space-y-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <input
            className="input py-1.5 font-medium"
            value={item.name}
            placeholder="Food name"
            aria-label="Food name"
            onChange={(e) => set('name', e.target.value)}
          />
          <input
            className="input mt-1 py-1 text-sm"
            value={item.portion}
            placeholder="Portion, e.g. 1 cup (240 g)"
            aria-label="Portion"
            onChange={(e) => set('portion', e.target.value)}
          />
        </div>
        <button
          type="button"
          className="mt-1 h-8 w-8 flex-none rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
          aria-label={`Remove ${item.name || 'item'}`}
          onClick={onRemove}
        >
          ✕
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1" role="group" aria-label="Quantity">
          <button
            type="button"
            className="btn btn-secondary h-9 min-h-0 w-9 px-0"
            aria-label="Decrease quantity"
            onClick={() =>
              set('quantity', Math.max(0.25, round(item.quantity - step(item.quantity))))
            }
          >
            −
          </button>
          <input
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0"
            className="input w-16 py-1.5 text-center"
            value={item.quantity}
            aria-label="Quantity"
            onChange={(e) => set('quantity', num(e.target.value))}
          />
          <button
            type="button"
            className="btn btn-secondary h-9 min-h-0 w-9 px-0"
            aria-label="Increase quantity"
            onClick={() => set('quantity', round(item.quantity + step(item.quantity)))}
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="text-right text-sm"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="block font-semibold tabular-nums">{Math.round(eff.kcal)} kcal</span>
          <span className="block text-xs text-gray-500">
            P {r1(eff.proteinG)} · C {r1(eff.carbsG)} · F {r1(eff.fatG)} {open ? '▴' : '▾'}
          </span>
        </button>
      </div>

      {open && (
        <div className="grid grid-cols-4 gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
          <p className="col-span-4 text-xs text-gray-500">Per 1 × portion</p>
          <NumField label="kcal" value={item.kcal} onChange={(v) => set('kcal', v)} />
          <NumField label="Protein g" value={item.proteinG} onChange={(v) => set('proteinG', v)} />
          <NumField label="Carbs g" value={item.carbsG} onChange={(v) => set('carbsG', v)} />
          <NumField label="Fat g" value={item.fatG} onChange={(v) => set('fatG', v)} />
          {item.confidence !== undefined && (
            <p className="col-span-4 text-xs text-gray-500">
              AI confidence: {Math.round(item.confidence * 100)}%
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] text-gray-500">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        className="input px-2 py-1 text-sm"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </label>
  );
}

function step(q: number): number {
  return q < 1 ? 0.25 : q < 3 ? 0.5 : 1;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function r1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}
