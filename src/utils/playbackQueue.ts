import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../state/store';
import type { Song } from '../types';

export const getPlaybackQueue = (state: Pick<RootState['global'], 'currentPlaylist' | 'nowPlayingPlaylist' | 'favoriteList' | 'playlistHash'>): Song[] => {
  if (state.currentPlaylist === 'nowPlayingPlaylist') return state.nowPlayingPlaylist;
  if (state.currentPlaylist === 'likedPlaylist') return state.favoriteList;
  return (state.playlistHash[state.currentPlaylist]?.songs || []).map((song) => ({
    ...song,
    id: song.identifier,
    author: song.author || song.artist || ''
  }));
};

export const selectPlaybackQueue = createSelector(
  [
    (state: RootState) => state.global.currentPlaylist,
    (state: RootState) => state.global.nowPlayingPlaylist,
    (state: RootState) => state.global.favoriteList,
    (state: RootState) => state.global.playlistHash
  ],
  (currentPlaylist, nowPlayingPlaylist, favoriteList, playlistHash) =>
    getPlaybackQueue({ currentPlaylist, nowPlayingPlaylist, favoriteList, playlistHash })
);
