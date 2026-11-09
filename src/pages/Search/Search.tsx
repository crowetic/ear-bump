import Header from '../../components/Header';
import SearchInput from '../../components/SearchInput';
import UnifiedSearchContent from '../../components/UnifiedSearchContent';
import { useSelector } from 'react-redux';
import { RootState } from '../../state/store';

export const Search = () => {
  const query = useSelector((state: RootState) => state.global.queriedValue);
  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <Header className="from-bg-neutral-900">
        <div className="mb-2 flex flex-col gap-y-6">
          <h1 className="text-white text-3xl font-semibold">Search</h1>
          <SearchInput />
        </div>
      </Header>
      <UnifiedSearchContent key={query} query={query} />
    </div>
  );
};
