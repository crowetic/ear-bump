import type { Song } from '../types';
import { getSongMetadata, ResourceMetadata, songCategory } from './songMetadata';
import { resourcePath, fetchMetadataDocument } from './songResources';

export interface LegacyGenreEntry extends ResourceMetadata {
  name: string; // Qortal publisher, not track title
  service: 'AUDIO';
  identifier: string;
  title: string;
  artist: string;
  genre: string;
  created?: number;
  confidence?: 'verified' | 'inferred';
  evidence?: string;
}
export interface LegacyGenreDocument {
  schema: 'earbump.legacy-genres.v1';
  updatedAt: string;
  songs: LegacyGenreEntry[];
}
export type LegacyGenreIndex = Map<string, LegacyGenreEntry>;
export const legacyKey = (song: { name: string; service: string; id?: string; identifier?: string }) =>
  JSON.stringify([song.service, song.name.toLowerCase(), song.identifier || song.id]);

export const parseLegacyGenres = (value: unknown): LegacyGenreIndex => {
  const document = value as LegacyGenreDocument;
  if (document?.schema !== 'earbump.legacy-genres.v1' || !Array.isArray(document.songs)
    || document.songs.length > 20000 || !Number.isFinite(Date.parse(document.updatedAt))) throw new Error('Invalid genre list.');
  const index: LegacyGenreIndex = new Map();
  for (const entry of document.songs) {
    if (!entry || entry.service !== 'AUDIO' || typeof entry.name !== 'string' || !entry.name.trim()
      || typeof entry.identifier !== 'string' || !entry.identifier.startsWith('earbump_song_')
      || typeof entry.title !== 'string' || typeof entry.artist !== 'string'
      || typeof entry.genre !== 'string' || !entry.genre.trim()) throw new Error('Invalid genre list entry.');
    // Only schema fields with the expected runtime types enter the metadata parser.
    const metadata: ResourceMetadata = {};
    for (const field of ['title', 'artist', 'album', 'genre', 'mood', 'vibe', 'description', 'releaseDate', 'language', 'notes'] as const) {
      if (typeof entry[field] === 'string') metadata[field] = entry[field];
    }
    for (const field of ['bpm', 'tempo', 'duration', 'trackNumber', 'discNumber'] as const) {
      if (typeof entry[field] === 'number') metadata[field] = entry[field];
    }
    if (typeof entry.explicit === 'boolean') metadata.explicit = entry.explicit;
    if (Array.isArray(entry.tags)) metadata.tags = entry.tags.filter((tag) => typeof tag === 'string');
    const key = legacyKey(entry);
    if (index.has(key)) throw new Error('Duplicate genre list entry.');
    index.set(key, { ...getSongMetadata(metadata), name: entry.name, service: 'AUDIO', identifier: entry.identifier,
      title: entry.title, artist: entry.artist, genre: entry.genre.trim() });
  }
  return index;
};

export const songWithoutLegacyMetadata = (song: Song): Song => {
  const fields = new Set(song.legacyFields || []);
  const native = Object.fromEntries(Object.entries(song).filter(([field]) => field !== 'legacyFields' && !fields.has(field))) as unknown as Song;
  return { ...native, title: native.title || '', author: native.author || '' };
};

export const applyLegacyGenres = (input: Song, index: LegacyGenreIndex): Song => {
  const song = songWithoutLegacyMetadata(input);
  const entry = index.get(legacyKey(song));
  const metadata = entry ? getSongMetadata(entry) : {};
  const fallback = Object.fromEntries(Object.entries(metadata).filter(([field, value]) => value !== undefined && value !== ''
    && (field === 'genre' ? !songCategory(song) : song[field as keyof Song] === undefined || song[field as keyof Song] === '' || (field === 'title' && song.title === song.id))));
  return { ...song, ...fallback, legacyFields: Object.keys(fallback) };
};

export const genrePublisher = (import.meta.env.VITE_LEGACY_GENRE_PUBLISHER || 'crodex').trim();
const identifier = import.meta.env.VITE_LEGACY_GENRE_IDENTIFIER || 'earbump_legacy_genres_v1';
// Ship the reviewed snapshot in a lazy chunk so ordinary/offline builds retain coverage.
const bundledGenres = () => import('../../data/legacy/current/app-genres.json').then((module) => module.default || module);
export const newestGenreDocument = (documents: unknown[]) => {
  const valid = documents.flatMap((document) => {
    try { return [{ document, index: parseLegacyGenres(document), date: Date.parse((document as LegacyGenreDocument).updatedAt) }]; }
    catch { return []; }
  }).sort((a, b) => b.date - a.date);
  if (!valid.length) throw new Error('No valid legacy genre snapshot is available.');
  return valid[0];
};
export const compactGenreDocument = (document: unknown, index: LegacyGenreIndex): LegacyGenreDocument => ({
  schema: 'earbump.legacy-genres.v1', updatedAt: (document as LegacyGenreDocument).updatedAt,
  songs: [...index.values()]
});
let pending: Promise<LegacyGenreIndex> | undefined;
export const loadLegacyGenres = () => {
  if (!pending) pending = (async () => {
    const bundled = await bundledGenres();
    const key = `ear-bump:legacy-genres:v1:${genrePublisher.toLowerCase()}:${identifier}`;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached && Date.now() - cached.savedAt < 24 * 60 * 60 * 1000) {
        const selected = newestGenreDocument([bundled, cached.document]);
        try { localStorage.setItem(key, JSON.stringify({ savedAt: cached.savedAt, document: compactGenreDocument(selected.document, selected.index) })); } catch { /* Session data remains available. */ }
        return selected.index;
      }
    } catch { /* Unavailable storage never disables the shipped snapshot. */ }
    let remote: unknown;
    try { remote = await fetchMetadataDocument(resourcePath('DOCUMENT', genrePublisher, identifier), 8 * 1024 * 1024, 5000); }
    catch { /* The reviewed bundled list remains available while QDN propagates. */ }
    const selected = newestGenreDocument([bundled, remote]);
    try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), document: compactGenreDocument(selected.document, selected.index) })); } catch { /* Session cache still works. */ }
    return selected.index;
  })();
  return pending;
};
