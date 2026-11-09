import localforage from 'localforage';

const storage = localforage.createInstance({ name: 'ear-bump-favorites' });
const pendingUpdates = new Map<string, Promise<unknown>>();
let migration: Promise<void> = Promise.resolve();

export const getScopedKey = (baseKey: string, address: string) => {
  if (!address) throw new Error('An account address is required for storage');
  return `${baseKey}_${address}`;
};

// Claim legacy data for the first authenticated account only. Keep the original
// until its scoped copy is saved, so a failed/interrupted migration can retry.
export const migrateLegacyFavorites = (address: string): Promise<void> => {
  const next = migration.catch(() => undefined).then(async () => {
    const owner = await storage.getItem<string>('legacyFavoritesOwner');
    if (owner && owner !== address) return;
    if (!owner) await storage.setItem('legacyFavoritesOwner', address);
    for (const baseKey of ['favorites', 'favoritesPlaylist']) {
      const key = getScopedKey(baseKey, address);
      if (await storage.getItem(key) !== null) continue;
      const legacy = await storage.getItem(baseKey);
      if (legacy === null) continue;
      await storage.setItem(key, legacy);
      await storage.removeItem(baseKey);
    }
  });
  migration = next;
  return next;
};

export const readScopedStorage = async <T>(baseKey: string, address: string) => {
  const key = getScopedKey(baseKey, address);
  await pendingUpdates.get(key)?.catch(() => undefined);
  return storage.getItem<T>(key);
};

// Serialize read/modify/write operations for each account/key, including likes
// from different buttons and history events arriving while a write is pending.
export const updateScopedStorage = <T>(baseKey: string, address: string, update: (value: T | null) => T): Promise<T> => {
  const key = getScopedKey(baseKey, address);
  const next = (pendingUpdates.get(key) || Promise.resolve()).catch(() => undefined).then(async () => {
    const value = update(await storage.getItem<T>(key));
    await storage.setItem(key, value);
    return value;
  });
  pendingUpdates.set(key, next);
  const cleanup = () => { if (pendingUpdates.get(key) === next) pendingUpdates.delete(key); };
  next.then(cleanup, cleanup);
  return next;
};
