
import usePlayer from "./usePlayer";
import { Song } from "../types";

const useOnPlay = (songs: Song[], playlistId = 'nowPlayingPlaylist') => {
  const player = usePlayer();


  const onPlay = (id: string) => {


    const song = songs.find((item) => item.id === id);
    if (song) player.startTrack(song, playlistId, songs);
  }

  return onPlay;
};

export default useOnPlay;
