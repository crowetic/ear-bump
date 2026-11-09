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
}

const positiveNumber = (value: string | number | undefined) => {
  if (value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
};

export const getSongMetadata = (metadata: ResourceMetadata | null = {}) => {
  metadata = metadata || {};
  const fields: Record<string, string> = {};
  for (const pair of (metadata.description || '').split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    fields[pair.slice(0, separator).trim().toLowerCase()] = pair.slice(separator + 1).trim();
  }
  const artist = metadata.artist || fields.artist || metadata.author || fields.author || '';
  const duration = metadata.duration ?? fields.duration;
  const seconds = typeof duration === 'string' && duration.includes(':')
    ? duration.split(':').reduce((total, part) => total * 60 + Number(part), 0) : duration;
  return {
    title: fields.title || metadata.title || '',
    author: metadata.author || fields.author || artist,
    artist,
    album: metadata.album || fields.album || undefined,
    duration: positiveNumber(seconds),
    trackNumber: positiveNumber(metadata.trackNumber ?? fields.tracknumber ?? fields.track),
    discNumber: positiveNumber(metadata.discNumber ?? fields.discnumber ?? fields.disc)
  };
};

export const artistName = (song: Song) => (song.artist || song.author || '').trim();
export const normalizeName = (name: string) => name.trim().toLocaleLowerCase();
export const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};
