import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import SearchContent from '../../components/SearchContent';
import { RootState } from '../../state/store';

export const RecentlyPlayed = () => {
  const history = useSelector((state: RootState) => state.global.recentlyPlayed);
  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto pb-6">
      <Header>
        <Link to="/" className="text-neutral-200 hover:underline">Back to Home</Link>
        <h1 className="mt-6 text-white text-4xl font-bold">Recently Played</h1>
        <p className="mt-3 text-neutral-300">Your last {history.length} tracks</p>
      </Header>
      <div className="mt-5"><SearchContent songs={history} /></div>
    </div>
  );
};
