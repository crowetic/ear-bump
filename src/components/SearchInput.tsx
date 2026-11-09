import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Input from './Input';
import { resetQueriedList, setQueriedValue } from '../state/features/globalSlice';
import { RootState } from '../state/store';

const SearchInput = () => {
  const dispatch = useDispatch();
  const query = useSelector((state: RootState) => state.global.queriedValue);
  const [value, setValue] = useState(query);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (value === query) return;
      dispatch(resetQueriedList());
      dispatch(setQueriedValue(value));
    }, 300);
    return () => clearTimeout(timeout);
  }, [value, query, dispatch]);

  return <Input aria-label="Search music" placeholder="Search songs, artists, albums or playlists"
    value={value} onChange={(event) => setValue(event.target.value)} />;
};

export default SearchInput;
