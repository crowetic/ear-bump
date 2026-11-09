import { useCallback, useContext } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import {
  RepeatMode, setAddToDownloads, setIsPlaying, setPlaybackPosition,
  setRepeat, setShuffle, setVolumePlayer, startPlayback, restartPlayback, recordPlaybackHistory
} from '../state/features/globalSlice';
import { AppDispatch, RootState } from '../state/store';
import { Song } from '../types';
import { artistName } from '../utils/songMetadata';
import { MyContext } from '../wrappers/DownloadWrapper';
import { getPlaybackQueue, selectPlaybackQueue } from '../utils/playbackQueue';

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
  const queue = useSelector(selectPlaybackQueue);
  const playbackRequest = useSelector((state: RootState) => state.global.playbackRequest);

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
    const songs = getPlaybackQueue(state);
    if (ended && state.repeat === 'one' && state.currentSong) {
      dispatch(restartPlayback());
      return state.currentSong;
    }
    if (songs.length === 0) return;

    const currentIndex = songs.findIndex((item) => item.id === state.currentSong);
    if (ended && state.repeat === 'off' && currentIndex === songs.length - 1) return;
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
      nextIndex = direction === 1 ? 0 : songs.length - 1;
    }
    const nextSong = songs[nextIndex];
    startTrack(nextSong);
    return nextSong.id;
  }, [dispatch, startTrack, store]);

  const recordPlayback = useCallback((song: Song) => {
    const { global, auth } = store.getState();
    if (!auth.user?.address || global.currentSong !== song.id || global.lastHistoryRequest === global.playbackRequest) return;
    dispatch(recordPlaybackHistory({
      address: auth.user.address, request: global.playbackRequest,
      entry: { id: song.id, songId: song.id, title: song.title, author: song.author,
        artist: artistName(song), album: song.album || '', name: song.name, service: song.service,
        duration: song.duration, trackNumber: song.trackNumber, discNumber: song.discNumber,
        playedAt: Date.now(), thumbnail: global.imageCoverHash[song.id] }
    }));
  }, [dispatch, store]);

  const playNext = useCallback((ended = false) => playAdjacent(1, ended), [playAdjacent]);
  const playPrevious = useCallback(() => playAdjacent(-1), [playAdjacent]);
  const updateIsPlaying = useCallback((value: boolean) => dispatch(setIsPlaying(value)), [dispatch]);
  const setPosition = useCallback((value: number) => dispatch(setPlaybackPosition(value)), [dispatch]);
  const setVolume = useCallback((value: number) => dispatch(setVolumePlayer(value)), [dispatch]);
  const updateShuffle = useCallback((value: boolean) => dispatch(setShuffle(value)), [dispatch]);
  const updateRepeat = useCallback((value: RepeatMode) => dispatch(setRepeat(value)), [dispatch]);

  return {
    currentSong, isPlaying, position, volume, shuffle, repeat, queue, playbackRequest, recordPlayback,
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
