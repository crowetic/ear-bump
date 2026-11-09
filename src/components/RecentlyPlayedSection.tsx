import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { RootState } from '../state/store';
import useOnPlay from '../hooks/useOnPlay';
import radioImg from '../assets/img/radio-cassette.webp';

const RecentlyPlayedSection = () => {
  const history = useSelector((state: RootState) => state.global.recentlyPlayed);
  const covers = useSelector((state: RootState) => state.global.imageCoverHash);
  const onPlay = useOnPlay(history);

  return (
    <section className="px-6 py-5" aria-labelledby="recently-played-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="recently-played-heading" className="text-white text-2xl font-semibold">Recently Played</h2>
        {history.length > 0 && <Link to="/recently-played" className="text-sm text-neutral-400 hover:text-white hover:underline">See all</Link>}
      </div>
      {history.length === 0 ? <p className="text-neutral-400">Play a song to start your listening history.</p> : (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {history.slice(0, 10).map((song) => (
            <button type="button" key={song.songId} onClick={() => onPlay(song.id)}
              className="w-40 shrink-0 rounded-md bg-neutral-400/5 p-3 text-left hover:bg-neutral-400/10">
              <img src={covers[song.id] || song.thumbnail || radioImg} alt="" className="mb-3 aspect-square w-full rounded-md object-cover" />
              <p className="truncate font-semibold text-white">{song.title}</p>
              <p className="truncate text-sm text-neutral-400">{song.artist}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default RecentlyPlayedSection;
