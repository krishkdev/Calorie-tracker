import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchProduct, ProductNotFoundError } from '../barcode/openFoodFacts';
import BarcodeScanner from '../components/BarcodeScanner';
import ServingPicker from '../components/ServingPicker';
import type { FoodItem, MealType, ProductInfo } from '../db/types';
import { safeDayKey } from '../lib/dates';
import type { ReviewState } from './ReviewEntry';

export default function LogBarcode() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [manual, setManual] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(raw: string) {
    const c = raw.replace(/\D/g, '');
    if (!c) return;
    setCode(c);
    setError(null);
    setProduct(null);
    setLoading(true);
    try {
      setProduct(await fetchProduct(c));
    } catch (e) {
      if (e instanceof ProductNotFoundError)
        setError(
          `Barcode ${c} is not in Open Food Facts yet. Describe the food instead, or add it manually from the label.`,
        );
      else setError(e instanceof Error ? e.message : 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setCode(null);
    setProduct(null);
    setError(null);
  }

  function add(item: Partial<FoodItem> & { name: string }) {
    const state: ReviewState = {
      items: [item],
      meal: (params.get('meal') as MealType | null) ?? undefined,
      dayKey: params.get('day') ? safeDayKey(params.get('day')) : undefined,
    };
    navigate('/entry/new', { state });
  }

  const scanning = code === null;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <button type="button" className="text-brand-600" onClick={() => navigate(-1)}>
          ‹ Back
        </button>
        <h1 className="text-lg font-bold">Scan barcode</h1>
        <span className="w-12" />
      </header>

      {scanning ? (
        <>
          <BarcodeScanner onDetected={(c) => void lookup(c)} />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void lookup(manual);
            }}
          >
            <input
              className="input"
              inputMode="numeric"
              placeholder="Or type the barcode number"
              value={manual}
              aria-label="Barcode number"
              onChange={(e) => setManual(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary px-4" disabled={!manual.trim()}>
              Look up
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            Barcode <span className="font-mono">{code}</span>
            {' · '}
            <button type="button" className="text-brand-600 underline" onClick={reset}>
              scan again
            </button>
          </p>
          {loading && <p className="card text-center text-sm text-gray-500">Looking up product…</p>}
          {error && (
            <div className="card space-y-3">
              <p className="text-sm">{error}</p>
              <div className="flex gap-2">
                <Link to={`/log/text?${params.toString()}`} className="btn btn-secondary flex-1">
                  Describe it
                </Link>
                <Link to={`/entry/new?${params.toString()}`} className="btn btn-secondary flex-1">
                  Manual entry
                </Link>
              </div>
            </div>
          )}
          {product && <ServingPicker product={product} onAdd={add} />}
        </>
      )}

      <p className="text-center text-xs text-gray-500">
        Product data from{' '}
        <a
          className="underline"
          href="https://world.openfoodfacts.org"
          target="_blank"
          rel="noreferrer"
        >
          Open Food Facts
        </a>
        , a free community database. Missing a product? You can add it there.
      </p>
    </div>
  );
}
