import type { Song } from '../types';
import type { Status } from '../state/features/globalSlice';
import { descriptionFields, getSongMetadata, ResourceMetadata } from './songMetadata';

export const SONG_PREFIXES = ['earbump_song_', 'enjoymusic_song_', 'qmusic_track_'] as const;
export interface SongResource {
  identifier: string;
  name: string;
  service?: string;
  created?: number;
  updated?: number;
  status?: Status;
  metadata?: ResourceMetadata;
  genre?: string;
}
export const songSource = (id: string) => id.startsWith('earbump_song_') ? 'ear-bump' as const
  : id.startsWith('enjoymusic_song_') || id.startsWith('qmusic_track_') ? 'q-music' as const : undefined;

export const normalizeSongResource = (resource: SongResource): Song => {
  const song: Song = {
    ...getSongMetadata({ ...resource.metadata, genre: resource.genre || resource.metadata?.genre }),
    id: resource.identifier, name: resource.name, service: 'AUDIO', source: songSource(resource.identifier),
    status: resource.status, created: resource.created, updated: resource.updated,
    description: resource.metadata?.description || '', metadataDescription: resource.metadata?.description || '',
    audio: { name: resource.name, service: 'AUDIO', identifier: resource.identifier },
    coverArt: { name: resource.name, service: 'THUMBNAIL', identifier: resource.identifier }
  };
  song.title ||= resource.identifier;
  return song;
};

export const resourcePath = (service: string, name: string, identifier: string) =>
  `/arbitrary/${encodeURIComponent(service)}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;

export const fetchSongPage = async (prefix: string, offset: number, limit: number, query = '', signal?: AbortSignal) => {
  const params = new URLSearchParams({ mode: 'ALL', service: 'AUDIO', identifier: prefix,
    limit: String(limit), offset: String(offset), includemetadata: 'true', includestatus: 'true',
    reverse: 'true', excludeblocked: 'true', prefix: 'true' });
  if (query.trim()) params.set('query', query.trim());
  const response = await fetch(`/arbitrary/resources/search?${params}`, { signal });
  if (!response.ok) throw new Error('Song discovery is temporarily unavailable.');
  const resources: SongResource[] = await response.json();
  if (!Array.isArray(resources)) throw new Error('Invalid song discovery response.');
  return resources.filter((resource) => typeof resource.name === 'string' && typeof resource.identifier === 'string'
    && resource.identifier.startsWith(prefix));
};

export const fetchMetadataDocument = async (path: string, maxBytes = 256 * 1024, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, { signal: controller.signal });
    if (!response.ok || Number(response.headers.get('content-length')) > maxBytes) throw new Error('Song metadata is unavailable or too large.');
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) throw new Error('Song metadata is too large.');
    return JSON.parse(text);
  } finally { clearTimeout(timeout); }
};

const descriptors = new Map<string, Promise<Song>>();
export const loadSongDescriptor = (song: Song): Promise<Song> => {
  const fields = descriptionFields(song.metadataDescription || song.description);
  if (!fields.rev || !['2', 'earbump1'].includes(fields.v)) return Promise.resolve(song);
  const key = `${song.name.toLowerCase()}/${song.id}/${fields.rev}`;
  let promise = descriptors.get(key);
  if (!promise) {
    promise = (async () => {
      let identifier = song.id;
      if (fields.v === '2') {
        identifier = `qmusic_meta_${song.id}`;
        if (new TextEncoder().encode(identifier).length > 64) {
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(song.id));
          identifier = `qmusic_meta_${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 48)}`;
        }
      }
      const data = await fetchMetadataDocument(resourcePath('DOCUMENT', song.name, identifier));
      if (data?.schema !== (fields.v === '2' ? 'qmusic.song.v2' : 'earbump.song.v1')
        || data.identifier !== song.id || typeof data.publisher !== 'string'
        || data.publisher.toLowerCase() !== song.name.toLowerCase() || data.revision !== fields.rev
        || !data.fields || typeof data.fields !== 'object' || Array.isArray(data.fields)) {
        throw new Error('Song details do not match the audio revision.');
      }
      const metadata: ResourceMetadata = {};
      const strings = ['title', 'artist', 'author', 'album', 'genre', 'mood', 'vibe', 'language', 'notes', 'releaseDate', 'publishedDate', 'description'] as const;
      for (const field of strings) if (typeof data.fields[field] === 'string') metadata[field] = data.fields[field];
      for (const field of ['duration', 'bpm', 'tempo', 'trackNumber', 'discNumber'] as const) {
        if (typeof data.fields[field] === 'number') metadata[field] = data.fields[field];
      }
      if (typeof data.fields.explicit === 'boolean') metadata.explicit = data.fields.explicit;
      if (Array.isArray(data.fields.tags)) metadata.tags = data.fields.tags.filter((tag: unknown) => typeof tag === 'string');
      const populated = Object.fromEntries(Object.entries(getSongMetadata(metadata)).filter(([, value]) => value !== undefined && value !== ''));
      return { ...song, ...populated, description: metadata.description || metadata.notes || song.description, metadataDescription: song.metadataDescription || song.description,
        audio: { ...(song.audio || { name: song.name, service: 'AUDIO', identifier: song.id }), sha256: typeof data.audio?.sha256 === 'string' ? data.audio.sha256 : undefined,
          bytes: typeof data.audio?.bytes === 'number' ? data.audio.bytes : undefined,
          filename: typeof data.audio?.filename === 'string' ? data.audio.filename : undefined,
          mimeType: typeof data.audio?.mimeType === 'string' ? data.audio.mimeType : undefined },
        coverArt: { ...(song.coverArt || { name: song.name, service: 'THUMBNAIL', identifier: song.id }),
          sha256: typeof data.coverArt?.sha256 === 'string' ? data.coverArt.sha256 : undefined } };
    })();
    descriptors.set(key, promise);
  }
  return promise;
};
