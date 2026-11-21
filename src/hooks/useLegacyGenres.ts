import { useEffect, useState } from 'react';
import { LegacyGenreIndex, loadLegacyGenres } from '../utils/legacyGenres';

const useLegacyGenres = () => {
  const [index, setIndex] = useState<LegacyGenreIndex>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void loadLegacyGenres().then((result) => { if (active) setIndex(result); })
      .catch(() => { if (active) setError('Legacy genres are unavailable. Unclassified songs appear under Uncategorized.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { index, loading, error };
};
export default useLegacyGenres;
