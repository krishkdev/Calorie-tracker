import Dexie, { type EntityTable } from 'dexie';
import type { CachedProduct, Favorite, FoodEntry, Profile, Settings, WeightEntry } from './types';

export class AppDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  entries!: EntityTable<FoodEntry, 'id'>;
  weights!: EntityTable<WeightEntry, 'id'>;
  favorites!: EntityTable<Favorite, 'id'>;
  productCache!: EntityTable<CachedProduct, 'barcode'>;

  constructor(name = 'calorie-tracker') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      entries: 'id, dayKey, loggedAt, [dayKey+meal]',
      weights: 'id, &dayKey, loggedAt',
      favorites: 'id, name, lastUsedAt, useCount',
      productCache: 'barcode, fetchedAt',
    });
  }
}

export const db = new AppDB();
