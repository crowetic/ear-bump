import type { Song } from '../types';

export interface ResourceMetadata {
  title?: string;
  description?: string;
  author?: string;
  artist?: string;
  album?: string;
  duration?: number | string;
  trackNumber?: number | string;
  discNumber?: number | string;
  genre?: string | null;
  category?: string | null;
  categoryName?: string | null;
  tags?: string[] | null;
  mood?: string;
  vibe?: string;
  bpm?: number | string;
  tempo?: number | string;
  releaseDate?: string;
  publishedDate?: string;
  explicit?: boolean | string;
  language?: string;
  notes?: string;
}

const positiveNumber = (value: string | number | undefined) => {
  if (value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
};

export const isoDate = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(Date.parse(value))) return undefined;
  // Date.parse accepts impossible calendar dates such as February 30.
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  return calendar.toISOString().slice(0, 10) === value.slice(0, 10) ? value : undefined;
};

export const descriptionFields = (description = '') => {
  const fields: Record<string, string> = {};
  const encoded = /(?:^|;)v=(?:2|earbump1)(?:;|$)/.test(description);
  for (const pair of description.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const value = pair.slice(separator + 1).trim();
    try { fields[pair.slice(0, separator).trim().toLowerCase()] = encoded ? decodeURIComponent(value) : value; }
    catch { fields[pair.slice(0, separator).trim().toLowerCase()] = value; }
  }
  return fields;
};

export const getSongMetadata = (metadata: ResourceMetadata | null = {}) => {
  metadata = metadata || {};
  const fields = descriptionFields(metadata.description);
  const artist = metadata.artist || fields.artist || metadata.author || fields.author || '';
  const duration = metadata.duration ?? fields.duration;
  const seconds = typeof duration === 'string' && duration.includes(':')
    ? duration.split(':').reduce((total, part) => total * 60 + Number(part), 0) : duration;
  const bpm = positiveNumber(metadata.bpm ?? metadata.tempo ?? fields.bpm ?? fields.tempo);
  const explicit = metadata.explicit ?? fields.explicit;
  return {
    description: metadata.description,
    title: metadata.title || fields.title || '',
    author: metadata.author || fields.author || artist,
    artist,
    album: metadata.album || fields.album || undefined,
    genre: (metadata.genre || fields.genre || '').trim() || undefined,
    category: (metadata.category || fields.category || '').trim() || undefined,
    categoryName: (metadata.categoryName || fields.categoryname || '').trim() || undefined,
    tags: metadata.tags?.filter((tag) => typeof tag === 'string' && tag.trim()),
    mood: (metadata.mood || metadata.vibe || fields.mood || fields.vibe || '').trim() || undefined,
    bpm: bpm && bpm > 0 ? bpm : undefined,
    releaseDate: isoDate(metadata.releaseDate || metadata.publishedDate || fields.releasedate || fields.publisheddate),
    explicit: explicit === true || explicit === 'true' ? true : explicit === false || explicit === 'false' ? false : undefined,
    language: metadata.language || fields.language || undefined,
    notes: metadata.notes || fields.notes || undefined,
    duration: positiveNumber(seconds),
    trackNumber: positiveNumber(metadata.trackNumber ?? fields.tracknumber ?? fields.track),
    discNumber: positiveNumber(metadata.discNumber ?? fields.discnumber ?? fields.disc)
  };
};

export const artistName = (song: Song) => (song.artist || song.author || '').trim();
export const normalizeName = (name: string) => name.trim().toLocaleLowerCase();
// Broad QDN categories such as MUSIC are not music genres.
export const songCategory = (song: Song) => {
  const genre = song.genre?.trim() || '';
  return normalizeName(genre) === 'uncategorized' ? '' : genre;
};
export const songReleaseDate = (song: Song) => isoDate(song.releaseDate)
  || (song.created && Number.isFinite(song.created) && Math.abs(song.created) < 8.64e15 ? new Date(song.created).toISOString().slice(0, 10) : undefined);
export const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};
