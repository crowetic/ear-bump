import { useEffect, useMemo, useState } from 'react';
import type { Song } from '../types';
import { applyLegacyGenres, genrePublisher } from '../utils/legacyGenres';
import { fetchSongPage, loadSongDescriptor, normalizeSongResource, SONG_PREFIXES } from '../utils/songResources';
import useLegacyGenres from './useLegacyGenres';

// One metadata-only catalog scan per app session; never downloads the audio files.
let snapshot = { songs: [] as Song[], loading: true, error: '' };
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();
const publish = (songs: Song[] = [], error = '') => {
  const merged = new Map(snapshot.songs.map((song) => [JSON.stringify([song.name.toLowerCase(), song.id]), song]));
  for (const song of songs) merged.set(JSON.stringify([song.name.toLowerCase(), song.id]), song);
  snapshot = { ...snapshot, songs: [...merged.values()], error: error || snapshot.error };
  listeners.forEach((listener) => listener());
};
const discoverCatalog = () => {
  if (!pending) pending = (async () => {
    const results = await Promise.allSettled(SONG_PREFIXES.map(async (prefix) => {
      const seen = new Set<string>();
      for (let offset = 0; ;) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        let resources;
        try { resources = await fetchSongPage(prefix, offset, 100, '', controller.signal); }
        finally { clearTimeout(timeout); }
        if (!resources.length) return;
        for (const resource of resources) {
          const key = JSON.stringify([resource.name.toLowerCase(), resource.identifier]);
          if (seen.has(key)) throw new Error('Catalog changed during pagination. Reload to refresh.');
          seen.add(key);
        }
        offset += resources.length;
        const songs = resources.map(normalizeSongResource);
        publish(songs);
        // Limit descriptor concurrency. Compact fields remain useful if a document is propagating.
        const withDescriptors = songs.filter((song) => /(?:^|;)v=(?:2|earbump1)(?:;|$)/.test(song.metadataDescription || ''));
        for (let start = 0; start < withDescriptors.length; start += 4) {
          const details = await Promise.allSettled(withDescriptors.slice(start, start + 4).map(loadSongDescriptor));
          publish(details.flatMap((detail) => detail.status === 'fulfilled' ? [detail.value] : []),
            details.some((detail) => detail.status === 'rejected') ? 'Some full song details are unavailable. Available metadata is shown.' : '');
        }

      }
    }));
    snapshot = { ...snapshot, loading: false };
    publish([], results.some((result) => result.status === 'rejected')
      ? 'Some catalog sources could not be loaded. Available songs remain searchable.' : '');
  })();
  return pending;
};

const useCategorySongs = (enabled = true) => {
  const [catalog, setCatalog] = useState(snapshot);
  const legacy = useLegacyGenres();
  useEffect(() => {
    const update = () => setCatalog(snapshot);
    listeners.add(update);
    update();
    if (enabled) void discoverCatalog();
    return () => { listeners.delete(update); };
  }, [enabled]);
  const songs = useMemo(() => catalog.songs.map((song) => applyLegacyGenres(song, legacy.index)), [catalog.songs, legacy.index]);
  return { songs, loading: catalog.loading || legacy.loading, error: [catalog.error, legacy.error].filter(Boolean).join(' '),
    legacyConfigured: Boolean(genrePublisher) };
};
export default useCategorySongs;
