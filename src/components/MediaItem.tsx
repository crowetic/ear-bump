"use client";

import { useSelector } from "react-redux";
import usePlayer from "../hooks/usePlayer";
import { Song } from "../types";
import { RootState } from "../state/store";
import radioImg from '../assets/img/radio-cassette.webp'



interface MediaItemProps {
  data: Song;
  onClick?: (id: string) => void;
}

const MediaItem: React.FC<MediaItemProps> = ({
  data,
  onClick,
}) => {
  const player = usePlayer();
  const imageCoverHash = useSelector((state: RootState) => state.global.imageCoverHash);
  const handleClick = () => {
    if (onClick) return onClick(data.id);
    player.startTrack(data);
  };


  return ( 
    <div
      onClick={handleClick}
      className="
        flex 
        items-center 
        gap-x-3 
        cursor-pointer 
        hover:bg-neutral-800/50 
        w-full
        min-w-0
        p-2 
        rounded-md
      "
    >
      <div 
        className="
          relative 
          rounded-md 
          min-h-[48px] 
          min-w-[48px] 
          overflow-hidden
        "
      >
        <img
          src={imageCoverHash[data?.id] || radioImg}
          alt="MediaItem"
          className="object-cover absolute"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-y-1 overflow-hidden">
        <p className="text-white truncate">{data?.title}</p>
        <p className="text-neutral-400 text-sm truncate">
          By {data?.author}
        </p>
      </div>
    </div>
  );
}
 
export default MediaItem;
