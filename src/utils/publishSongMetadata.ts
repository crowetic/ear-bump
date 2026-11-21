import type { Song } from '../types';

// AUDIO must remain binary. Custom fields live on its accompanying DOCUMENT.
export const compactSongDescription = (song: Pick<Song, 'genre' | 'author' | 'releaseDate'>, revision: string) => {
  let description = `v=earbump1;rev=${revision};genre=${encodeURIComponent(song.genre || '')}`;
  if (song.releaseDate) description += `;releaseDate=${encodeURIComponent(song.releaseDate)}`;
  if (description.length > 220) throw new Error('Please use a shorter genre name.');
  let author = '';
  for (const character of song.author) {
    const next = author + encodeURIComponent(character);
    if (description.length + ';author='.length + next.length > 240) break;
    author = next;
  }
  if (author) description += `;author=${author}`;
  return description;
};

export const readAudioDuration = (file: File): Promise<number | undefined> => new Promise((resolve) => {
  const audio = document.createElement('audio');
  const url = URL.createObjectURL(file);
  const done = (duration?: number) => {
    clearTimeout(timeout);
    audio.onloadedmetadata = audio.onerror = null;
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(url);
    resolve(duration);
  };
  const timeout = setTimeout(() => done(), 10000);
  audio.preload = 'metadata';
  audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) && audio.duration >= 0 ? audio.duration : undefined);
  audio.onerror = () => done();
  audio.src = url;
});
