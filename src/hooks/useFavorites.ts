import { useStore } from 'react-redux';
import { RootState } from '../state/store';
import { Favorites, PlayList, setFavoritesFromStorage, setFavoritesFromStoragePlaylists, setFavSong, removeFavSong } from '../state/features/globalSlice';
import { Song } from '../types';
import { updateScopedStorage } from '../utils/scopedStorage';

const useFavorites = () => {
  const store = useStore<RootState>();
  const getAddress = () => {
    const state = store.getState();
    return state.global.accountStorageReady ? state.auth.user?.address : undefined;
  };

  const toggleSong = async (song: Song) => {
    const address = getAddress();
    if (!address) return;
    let removed = false;
    const favorites = await updateScopedStorage<Favorites>('favorites', address, (value) => {
      const next = value || { songs: {}, playlists: {} };
      removed = !!next.songs[song.id];
      if (removed) delete next.songs[song.id];
      else next.songs[song.id] = { identifier: song.id, name: song.name, service: song.service };
      return next;
    });
    if (store.getState().auth.user?.address !== address) return;
    const payload = { identifier: song.id, name: song.name, service: song.service, songData: song };
    store.dispatch(removed ? removeFavSong(payload) : setFavSong(payload));
    store.dispatch(setFavoritesFromStorage(favorites));
  };

  const togglePlaylist = async (playlist: PlayList) => {
    const address = getAddress();
    if (!address) return;
    const playlists = await updateScopedStorage<PlayList[]>('favoritesPlaylist', address, (value) => {
      const list = value || [];
      return list.some((item) => item.id === playlist.id)
        ? list.filter((item) => item.id !== playlist.id) : [playlist, ...list];
    });
    if (store.getState().auth.user?.address === address) store.dispatch(setFavoritesFromStoragePlaylists(playlists));
  };

  return { toggleSong, togglePlaylist };
};

export default useFavorites;
