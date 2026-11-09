

import PlayButton from "./PlayButton";
import { Song } from "../types";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../state/store";
import radioImg from '../assets/img/radio-cassette.webp'
import { setNewPlayList } from "../state/features/globalSlice";
import {MdPlaylistAdd} from 'react-icons/md'
interface SongItemProps {
  data: Song;
  onClick: (id: string) => void;
}

const SongItem: React.FC<SongItemProps> = ({
  data,
  onClick
}) => {
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const newPlaylist = useSelector((state: RootState) => state?.global.newPlayList);


  const dispatch = useDispatch()

  const addSongToPlaylist = (song: Song)=> {
    if(!newPlaylist) return
    if(newPlaylist && newPlaylist?.songs?.find((item)=> song.id === item.identifier)){
      return
    }
  const playlist = {
    ...newPlaylist,
    songs: [...newPlaylist.songs, {
      identifier: song.id,
      name: song.name,
      service: 'AUDIO',
      title: song.title,
      author: song.author
    }]
  }
  dispatch(setNewPlayList(playlist))
  }
  return ( 
    <div
    onClick={() => onClick(data.id)}
    className="
      relative 
      group 
      flex 
      flex-col 
      items-center 
      justify-center 
      rounded-md 
      overflow-hidden 
      gap-x-4 
      bg-neutral-400/5 
      hover:bg-neutral-400/10 
      transition 
      p-3
    "
  >
    <div 
      className="
        relative 
        aspect-square 
        w-full
        h-full 
        rounded-md 
        overflow-hidden
      "
    >
      <img
        className="object-cover absolute"
        src={imageCoverHash[data.id] || radioImg}
        alt="Image"
      />
      {newPlaylist && (
        <button
        className="
        absolute top-3 left-3
          transition 
          opacity-0 
          rounded-full 
          flex 
          items-center 
          justify-center 
          bg-green-500 
          p-3
          drop-shadow-md 
          translate
          translate-y-1/4
          group-hover:opacity-100 
          group-hover:translate-y-0
          hover:scale-110
        "
      >
        <MdPlaylistAdd 
          className="text-black h-6 w-6" 
          onClick={(event: any) => {
            event.stopPropagation();
            addSongToPlaylist(data)
            // Handle the 'add to playlist' logic here
          }}
        />
      </button>
      )}
    
      
    </div>
    <div className="flex flex-col items-start w-full pt-4 gap-y-1">
      <p className="font-semibold truncate w-full">
        {data?.title}
      </p>
      <p 
        className="
          text-neutral-400 
          text-sm 
          pb-4 
          w-full 
          truncate
        "
      >
        By {data?.author}
      </p>
    </div>
    <div 
      className="
        absolute 
        bottom-24 
        right-5
      "
    >
      <PlayButton />
    </div>
  </div>
  
   );
}
 
export default SongItem;
