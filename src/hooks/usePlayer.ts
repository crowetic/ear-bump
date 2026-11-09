import { useCallback, useContext } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import {
  RepeatMode, setAddToDownloads, setIsPlaying, setPlaybackPosition,
  setRepeat, setShuffle, setVolumePlayer, startPlayback
} from '../state/features/globalSlice';
import { AppDispatch, RootState } from '../state/store';
import { Song } from '../types';
import { MyContext } from '../wrappers/DownloadWrapper';

// All playback commands use Redux; this hook owns no separate player state.
const usePlayer = () => {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const { downloadVideo } = useContext(MyContext);
  const currentSong = useSelector((state: RootState) => state.global.currentSong);
  const isPlaying = useSelector((state: RootState) => state.global.isPlaying);
  const position = useSelector((state: RootState) => state.global.position);
  const volume = useSelector((state: RootState) => state.global.volume);
  const shuffle = useSelector((state: RootState) => state.global.shuffle);
  const repeat = useSelector((state: RootState) => state.global.repeat);

  const startTrack = useCallback((song: Song, playlistId?: string, songs?: Song[]) => {
    const { currentPlaylist, downloads } = store.getState().global;
    // Commit context and track together, before making audio available.
    dispatch(startPlayback({ id: song.id, playlistId: playlistId ?? currentPlaylist, songs }));

    const cached = downloads[song.id];
    const resource = {
      ...song,
      service: 'AUDIO',
      identifier: song.id,
      title: song.title || '',
      author: song.author || ''
    };
    if (song.status?.status === 'READY' || cached?.status?.status === 'READY') {
      dispatch(setAddToDownloads({
        ...cached,
        ...resource,
        status: song.status?.status === 'READY' ? song.status : cached.status,
        url: cached?.url || `/arbitrary/AUDIO/${song.name}/${song.id}`
      }));
    } else {
      downloadVideo(resource);
    }
  }, [dispatch, downloadVideo, store]);

  const playAdjacent = useCallback((direction: 1 | -1, ended = false) => {
    // Audio callbacks can outlive a render. Read the current context at event time.
    const state = store.getState().global;
    let songs: Song[];
    if (state.currentPlaylist === 'nowPlayingPlaylist') {
      songs = state.nowPlayingPlaylist;
    } else if (state.currentPlaylist === 'likedPlaylist') {
      songs = state.favoriteList;
    } else {
      songs = (state.playlistHash[state.currentPlaylist]?.songs || []).map((item) => ({
        ...item,
        id: item.identifier,
        author: item.author || item.artist || ''
      }));
    }
    if (songs.length === 0) return;
    if (ended && state.repeat === 'one') return state.currentSong || undefined;

    const currentIndex = songs.findIndex((item) => item.id === state.currentSong);
    let nextIndex = currentIndex + direction;
    if (state.shuffle && songs.length > 1) {
      const candidates = songs.filter((item) => item.id !== state.currentSong);
      if (candidates.length > 0) {
        const nextSong = candidates[Math.floor(Math.random() * candidates.length)];
        startTrack(nextSong);
        return nextSong.id;
      }
    }
    if (nextIndex < 0 || nextIndex >= songs.length) {
      if (state.repeat === 'off') return;
      // Preserve the existing previous-button behavior for liked/custom lists.
      nextIndex = direction === 1 || state.currentPlaylist !== 'nowPlayingPlaylist'
        ? 0 : songs.length - 1;
    }
    const nextSong = songs[nextIndex];
    startTrack(nextSong);
    return nextSong.id;
  }, [startTrack, store]);

  const playNext = useCallback((ended = false) => playAdjacent(1, ended), [playAdjacent]);
  const playPrevious = useCallback(() => playAdjacent(-1), [playAdjacent]);
  const updateIsPlaying = useCallback((value: boolean) => dispatch(setIsPlaying(value)), [dispatch]);
  const setPosition = useCallback((value: number) => dispatch(setPlaybackPosition(value)), [dispatch]);
  const setVolume = useCallback((value: number) => dispatch(setVolumePlayer(value)), [dispatch]);
  const updateShuffle = useCallback((value: boolean) => dispatch(setShuffle(value)), [dispatch]);
  const updateRepeat = useCallback((value: RepeatMode) => dispatch(setRepeat(value)), [dispatch]);

  return {
    currentSong, isPlaying, position, volume, shuffle, repeat,
    startTrack,
    playNext,
    playPrevious,
    setIsPlaying: updateIsPlaying,
    setPosition,
    setVolume,
    setShuffle: updateShuffle,
    setRepeat: updateRepeat
  };
};

export default usePlayer;
