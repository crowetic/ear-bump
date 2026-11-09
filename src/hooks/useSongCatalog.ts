import { createSelector } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import type { RootState } from '../state/store';
import type { Song } from '../types';

export const selectPlaylists = createSelector(
  [
    (state: RootState) => state.global.playlists,
    (state: RootState) => state.global.myPlaylists,
    (state: RootState) => state.global.playlistQueried,
    (state: RootState) => state.global.favoritesPlaylist,
    (state: RootState) => state.global.playlistHash
  ],
  (published, owned, queried, liked, hash) => {
    const playlists = new Map([...published, ...owned, ...queried, ...(liked || []), ...Object.values(hash)].map((playlist) => [playlist.id, playlist]));
    return [...playlists.values()];
  }
);

export const selectSongCatalog = createSelector(
  [
    selectPlaylists,
    (state: RootState) => state.global.songListRecent,
    (state: RootState) => state.global.songListLibrary,
    (state: RootState) => state.global.songListQueried,
    (state: RootState) => state.global.favoriteList,
    (state: RootState) => state.global.nowPlayingPlaylist,
    (state: RootState) => state.global.recentlyPlayed
  ],
  (playlists, recent, library, queried, liked, queue, history): Song[] => {
    const songs = new Map<string, Song>();
    const references = playlists.flatMap((playlist) => (playlist.songs || []).map((song) => ({
      ...song, id: song.identifier, author: song.author || song.artist || ''
    })));
    for (const song of [...references, ...history, ...recent, ...library, ...queried, ...liked, ...queue]) {
      // Sparse playlist references must not erase richer QDN metadata.
      const populated = Object.fromEntries(Object.entries(song).filter(([, value]) => value !== undefined && value !== ''));
      songs.set(song.id, { ...songs.get(song.id), ...populated, service: song.service || 'AUDIO' } as Song);
    }
    return [...songs.values()];
  }
);

const useSongCatalog = () => useSelector(selectSongCatalog);
export default useSongCatalog;
