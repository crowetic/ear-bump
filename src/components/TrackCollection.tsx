import { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaPlay } from 'react-icons/fa';
import { RxCaretLeft } from 'react-icons/rx';
import Header from './Header';
import SearchContent from './SearchContent';
import useOnPlay from '../hooks/useOnPlay';
import { Song } from '../types';
import { RootState } from '../state/store';
import radioImg from '../assets/img/radio-cassette.webp';

interface TrackCollectionProps {
  title: string;
  kind: string;
  songs: Song[];
  subtitle?: ReactNode;
}

const TrackCollection = ({ title, kind, songs, subtitle }: TrackCollectionProps) => {
  const onPlay = useOnPlay(songs);
  const navigate = useNavigate();
  const location = useLocation();
  const covers = useSelector((state: RootState) => state.global.imageCoverHash);

  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto pb-6">
      <Header>
        <button type="button" onClick={() => location.key === 'default' ? navigate('/') : navigate(-1)}
          className="mb-6 flex items-center gap-1 text-neutral-200 hover:text-white">
          <RxCaretLeft size={24} /> Back
        </button>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
          <img src={covers[songs[0]?.id] || radioImg} alt={kind}
            className="h-32 w-32 lg:h-44 lg:w-44 rounded-md object-cover" />
          <div className="min-w-0 flex flex-col gap-y-3">
            <p className="font-semibold text-sm">{kind}</p>
            <h1 className="text-white text-4xl sm:text-5xl lg:text-7xl font-bold break-words">{title}</h1>
            {subtitle && <div className="text-neutral-200">{subtitle}</div>}
            <p className="text-sm text-neutral-300">{songs.length} {songs.length === 1 ? 'track' : 'tracks'}</p>
          </div>
        </div>
        <button type="button" disabled={songs.length === 0} onClick={() => songs[0] && onPlay(songs[0].id)}
          className="mt-6 flex items-center gap-3 rounded-full bg-green-500 px-6 py-3 font-bold text-black hover:scale-105 disabled:opacity-50 disabled:hover:scale-100">
          <FaPlay /> Play All
        </button>
      </Header>
      <div className="mt-5"><SearchContent songs={songs} /></div>
    </div>
  );
};

export default TrackCollection;
