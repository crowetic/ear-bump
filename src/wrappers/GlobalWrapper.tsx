import React, {  useCallback, useEffect,  useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { addUser } from "../state/features/authSlice";
import NavBar from "../components/layout/Navbar/Navbar";
import PageLoader from "../components/common/PageLoader";
import { RootState } from "../state/store";
import { Favorites, PlayList, hydrateAccountStorage } from "../state/features/globalSlice";
import { migrateLegacyFavorites, readScopedStorage, updateScopedStorage } from '../utils/scopedStorage';

import { PlaybackHistoryEntry } from '../utils/playbackHistory';
import { RequestQueue } from "../utils/queue";


interface Props {
  children: React.ReactNode;
  setTheme: (val: string) => void;
}

export const queueFetchAvatars = new RequestQueue();

const GlobalWrapper: React.FC<Props> = ({ children, setTheme }) => {

  const dispatch = useDispatch();

  const [userAvatar, setUserAvatar] = useState<string>("");
  const { user } = useSelector((state: RootState) => state.auth);
  const recentlyPlayed = useSelector((state: RootState) => state.global.recentlyPlayed);
  const accountStorageReady = useSelector((state: RootState) => state.global.accountStorageReady);
  const songListLibrary = useSelector((state: RootState) => state.global.songListLibrary);  
  const songHash = useSelector((state: RootState) => state.global.songHash);
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const songListRecent = useSelector((state: RootState) => state.global.imageCoverHash);
  useEffect(() => {
    if (!user?.name) return;

    getAvatar();
  }, [user?.name]);

 

 

  const getAvatar = async () => {
    try {
      let url = await qortalRequest({
        action: "GET_QDN_RESOURCE_URL",
        name: user?.name,
        service: "THUMBNAIL",
        identifier: "qortal_avatar"
      });

      if (url === "Resource does not exist") return;

      setUserAvatar(url);
    } catch (error) {
      console.error(error);
    }
  };

  const {
    isLoadingGlobal,
  } = useSelector((state: RootState) => state.global);

  async function getNameInfo(address: string) {
    const response = await fetch("/names/address/" + address);
    const nameData = await response.json();

    if (nameData?.length > 0) {
      return nameData[0].name;
    } else {
      return "";
    }
  }




  const askForAccountInformation = React.useCallback(async () => {
    try {
      let account = await qortalRequest({
        action: "GET_USER_ACCOUNT"
      });

      const name = await getNameInfo(account.address);
      dispatch(addUser({ ...account, name }));
    } catch (error) {
      console.error(error);
    }
  }, []);


  useEffect(() => {
    askForAccountInformation();
  }, [askForAccountInformation]);

  useEffect(() => {
    const address = user?.address;
    if (!address) return;
    let cancelled = false;
    const load = async () => {
      try {
        await migrateLegacyFavorites(address);
        const [favorites, playlists, history] = await Promise.all([
          readScopedStorage<Favorites>('favorites', address),
          readScopedStorage<PlayList[]>('favoritesPlaylist', address),
          readScopedStorage<PlaybackHistoryEntry[]>('recentlyPlayed', address)
        ]);
        if (!cancelled) dispatch(hydrateAccountStorage({
          address, favorites: favorites || { songs: {}, playlists: {} }, playlists: playlists || [], history: history || []
        }));
      } catch (error) {
        console.error('Could not load account storage', error);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user?.address, dispatch]);

  useEffect(() => {
    if (!user?.address || !accountStorageReady) return;
    void updateScopedStorage<PlaybackHistoryEntry[]>('recentlyPlayed', user.address, () => recentlyPlayed)
      .catch((error) => console.error('Could not save playback history', error));
  }, [user?.address, accountStorageReady, recentlyPlayed]);

  return (
    <>
      {isLoadingGlobal && <PageLoader />}
      {children}
    </>
  );
};

export default GlobalWrapper;
