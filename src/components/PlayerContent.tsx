import useSound from "use-sound";
import { useEffect, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { BsPauseFill, BsPlayFill } from "react-icons/bs";
import { HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2";
import { AiFillStepBackward, AiFillStepForward } from "react-icons/ai";
import CircularProgress from '@mui/material/CircularProgress';
import MediaItem from "./MediaItem";
import PlayerControls from "./PlayerControls";
import Slider from "./Slider";
import { Song } from "../types";
import usePlayer from "../hooks/usePlayer";
import LikeButton from "./LikeButton";
import { upsertNowPlayingPlaylist } from "../state/features/globalSlice";
import { RootState } from "../state/store";
import { AddToPlaylistButton } from "./AddToPlayistButton";

interface PlayerContentProps {
  song: Song;
  songUrl: string;
}

const PlayerContent: React.FC<PlayerContentProps> = ({ song, songUrl }) => {
  const {
    isPlaying, position, volume, playNext, playPrevious,
    setIsPlaying, setPosition, setVolume, playbackRequest, recordPlayback
  } = usePlayer();
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const [isLoaded, setIsLoaded] = useState(false);
  const accountStorageReady = useSelector((state: RootState) => state.global.accountStorageReady);
  const Icon = isPlaying ? BsPauseFill : BsPlayFill;
  const VolumeIcon = volume === 0 ? HiSpeakerXMark : HiSpeakerWave;

  const [play, { pause, sound }] = useSound(songUrl, {
    volume,
    onplay: () => {
      if (store.getState().global.currentSong !== song.id) return;
      recordPlayback(song);
      setIsLoaded(true);
      setIsPlaying(true);
    },
    onend: () => {
      if (store.getState().global.currentSong !== song.id) return;
      setIsPlaying(false);
      playNext(true);
    },
    onpause: () => {
      if (store.getState().global.currentSong === song.id) setIsPlaying(false);
    },
    format: ['mp3', 'wav', 'ogg']
  });

  useEffect(() => {
    if (!sound) return;
    sound.stop();
    sound.seek(store.getState().global.position);
    sound.play();
  }, [sound, store, playbackRequest]);

  useEffect(() => () => { sound?.unload(); }, [sound]);

  useEffect(() => {
    if (isPlaying && accountStorageReady) recordPlayback(song);
  }, [accountStorageReady, isPlaying, recordPlayback, song]);

  const handlePlay = () => {
    if (isPlaying) pause();
    else play();
  };

  const toggleMute = () => setVolume(volume === 0 ? 1 : 0);

  const handleProgressChange = (value: number) => {
    if (!sound) return;
    const nextPosition = value * sound.duration();
    sound.seek(nextPosition);
    setPosition(nextPosition);
  };

  useEffect(() => {
    if (!sound) return;
    const interval = setInterval(() => {
      const nextPosition = sound.seek();
      if (typeof nextPosition === 'number' && Number.isFinite(nextPosition)) {
        setPosition(nextPosition);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sound, setPosition]);

  useEffect(() => {
    dispatch(upsertNowPlayingPlaylist([song]));
  }, [dispatch, song]);

  return ( 
    <div className="relative grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-3 h-full">
        <div className="flex min-w-0 w-full justify-start">
          <div className="flex min-w-0 w-full items-center gap-x-1 lg:gap-x-4">
            <MediaItem data={song} />
            <AddToPlaylistButton song={song} />
            <LikeButton songId={song.id} name={song.name} service={song.service} songData={song} />
          </div>
        </div>

        <div 
          className="
            flex 
            md:hidden 
            col-auto 
            w-full 
            justify-end 
            items-center
          "
        >
          <PlayerControls />
          <div 
            onClick={handlePlay} 
            className="
              h-10
              w-10
              flex 
              items-center 
              justify-center 
              rounded-full 
              bg-white 
              p-1 
              cursor-pointer
            "
          >
            <Icon size={30} className="text-black" />
          </div>
         
        </div>

        <div 
          className="
            hidden
            h-full
            md:flex 
            justify-center 
            items-center 
            w-full 
            max-w-[722px] 
            gap-x-6
          "
        >
          <AiFillStepBackward
            onClick={playPrevious}
            size={30} 
            className="
              text-neutral-400 
              cursor-pointer 
              hover:text-white 
              transition
            "
          />
           {!isLoaded ? (
             <CircularProgress />
          ): (
            <div className="flex flex-col items-center 
            justify-center">
            <div 
            onClick={handlePlay} 
            className="
              flex 
              items-center 
              justify-center
              h-10
              w-10 
              rounded-full 
              bg-white 
              p-1 
              cursor-pointer
            "
          >
            <Icon size={30} className="text-black" />
    

          </div>
          <Slider 
              value={sound?.duration() ? Math.min(1, position / sound.duration()) : 0}
              onChange={(value) => handleProgressChange(value)}
              styles={{
                width: '250px',
    height: 'auto',
    padding: '10px 0px 5px 0px',
    cursor: 'pointer'
              }}
            />
          </div>
          )}
          
          <AiFillStepForward
            onClick={() => playNext()}
            size={30} 
            className="
              text-neutral-400 
              cursor-pointer 
              hover:text-white 
              transition
            " 
          />
        </div>

        <div className="hidden md:flex w-full items-center justify-end pr-2">
          <PlayerControls />
          <div className="flex items-center gap-x-2 w-[120px]">
            <VolumeIcon 
              onClick={toggleMute} 
              className="cursor-pointer" 
              size={34} 
            />
            <Slider 
              value={volume} 
              onChange={(value) => setVolume(value)}
            />
          </div>
        </div>

      </div>
   );
}
 
export default PlayerContent;
