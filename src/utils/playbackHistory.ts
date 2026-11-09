import type { Song } from '../types';

// Retain the QDN locator as well as display metadata so history remains playable
// after reload, before the library or search results have been fetched again.
export interface PlaybackHistoryEntry extends Song {
  songId: string;
  artist: string;
  album: string;
  playedAt: number;
  thumbnail?: string;
}

export const mergePlaybackHistory = (...lists: PlaybackHistoryEntry[][]): PlaybackHistoryEntry[] => {
  const seen = new Set<string>();
  return lists.flat().sort((a, b) => b.playedAt - a.playedAt).filter((entry) => {
    if (seen.has(entry.songId)) return false;
    seen.add(entry.songId);
    return true;
  }).slice(0, 50);
};
