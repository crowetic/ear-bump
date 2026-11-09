import { useRef } from 'react';
import { AiOutlineHeart, AiFillHeart } from 'react-icons/ai';
import { toast } from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { RootState } from '../state/store';
import { Song } from '../types';
import useFavorites from '../hooks/useFavorites';

interface LikeButtonProps {
  songId: string;
  name: string;
  service: string;
  songData: Song;
}

const LikeButton: React.FC<LikeButtonProps> = ({ songId, name, service = 'AUDIO', songData }) => {
  const isLiked = useSelector((state: RootState) => !!state.global.favorites?.songs[songId]);
  const ready = useSelector((state: RootState) => state.global.accountStorageReady);
  const { toggleSong } = useFavorites();
  const isFavoriting = useRef(false);
  const Icon = isLiked ? AiFillHeart : AiOutlineHeart;

  const handleLike = async () => {
    if (isFavoriting.current) return;
    isFavoriting.current = true;
    try {
      await toggleSong({ ...songData, id: songId, name, service });
    } catch (error) {
      console.error(error);
      toast.error('Could not save your likes. Please try again.');
    } finally {
      isFavoriting.current = false;
    }
  };

  return (
    <button type="button" aria-label={isLiked ? 'Unlike song' : 'Like song'} aria-pressed={isLiked}
      disabled={!ready} title={ready ? undefined : 'Authenticate to save likes'}
      className="cursor-pointer hover:opacity-75 transition disabled:opacity-50"
      onClick={handleLike}>
      <Icon color={isLiked ? '#22c55e' : 'white'} size={25} />
    </button>
  );
};

export default LikeButton;
