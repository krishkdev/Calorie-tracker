import { useState } from 'react';
import type { FoodItem, ProductInfo } from '../db/types';
import { buildItem, type ServingMode } from '../barcode/serving';

interface Props {
  product: ProductInfo;
  onAdd: (item: Partial<FoodItem> & { name: string }) => void;
}

/** Pick how much of a packaged product was eaten; produces one FoodItem. */
export default function ServingPicker({ product, onAdd }: Props) {
  const canServing = Boolean(product.perServing);
  const [mode, setMode] = useState<ServingMode>(canServing ? 'serving' : 'grams');
  const [amount, setAmount] = useState<number>(canServing ? 1 : (product.servingGrams ?? 100));

  const item = buildItem(product, mode, amount);

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt=""
            className="h-16 w-16 flex-none rounded-lg object-contain"
          />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{product.name}</p>
          {product.brand && <p className="truncate text-sm text-gray-500">{product.brand}</p>}
          <p className="text-xs text-gray-500">
            Per 100 g: {product.per100g.kcal} kcal · P {product.per100g.proteinG} · C{' '}
            {product.per100g.carbsG} · F {product.per100g.fatG}
          </p>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-gray-200 p-1 dark:bg-gray-800"
        role="radiogroup"
        aria-label="Amount type"
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'serving'}
          disabled={!canServing}
          className={`rounded-lg py-2 text-sm font-medium disabled:opacity-40 ${mode === 'serving' ? 'bg-white shadow dark:bg-gray-900' : ''}`}
          onClick={() => {
            setMode('serving');
            setAmount(1);
          }}
        >
          Servings{product.servingSize ? ` (${product.servingSize})` : ''}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'grams'}
          className={`rounded-lg py-2 text-sm font-medium ${mode === 'grams' ? 'bg-white shadow dark:bg-gray-900' : ''}`}
          onClick={() => {
            setMode('grams');
            setAmount(product.servingGrams ?? 100);
          }}
        >
          Grams
        </button>
      </div>

      <label className="block">
        <span className="label">
          {mode === 'serving' ? 'Number of servings' : 'Amount in grams'}
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step={mode === 'serving' ? '0.5' : '5'}
          className="input text-center text-lg"
          value={amount}
          onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      </label>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          P {item.proteinG} · C {item.carbsG} · F {item.fatG}
        </p>
        <p className="text-2xl font-bold tabular-nums">{item.kcal} kcal</p>
      </div>

      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={amount <= 0}
        onClick={() => onAdd(item)}
      >
        Add to meal
      </button>
    </div>
  );
}
