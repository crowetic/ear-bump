import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { PlayList, upsertPlaylists, upsertQueried } from '../state/features/globalSlice';
import { ResourceMetadata } from '../utils/songMetadata';
import { fetchSongPage, loadSongDescriptor, normalizeSongResource, SONG_PREFIXES } from '../utils/songResources';

interface SearchResource {
  identifier: string;
  name: string;
  created: number;
  updated: number;
  metadata?: ResourceMetadata;
}

// Each query owns its requests. Cleanup guards both descriptor hydration and pagination.
const useCatalogSearch = (query: string) => {
  const dispatch = useDispatch();
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const searchSongs = async (prefix: string) => {
      const resources = await fetchSongPage(prefix, page * 20, 20, query, controller.signal);
      if (controller.signal.aborted) return 0;
      const songs = resources.map(normalizeSongResource);
      dispatch(upsertQueried(songs));
      for (let start = 0; start < songs.length; start += 4) {
        const details = await Promise.allSettled(songs.slice(start, start + 4).map(loadSongDescriptor));
        if (controller.signal.aborted) return 0;
        dispatch(upsertQueried(details.flatMap((detail) => detail.status === 'fulfilled' ? [detail.value] : [])));
        if (details.some((detail) => detail.status === 'rejected')) setError('Some full song details are unavailable. Available metadata is shown.');
      }
      return resources.length;
    };
    const searchPlaylists = async () => {
      const params = new URLSearchParams({ mode: 'ALL', service: 'PLAYLIST', identifier: 'earbump_playlist_',
        limit: '20', offset: String(page * 20), includemetadata: 'true', reverse: 'true', excludeblocked: 'true', query: query.trim() });
      const response = await fetch(`/arbitrary/resources/search?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Search is temporarily unavailable.');
      const resources: SearchResource[] = await response.json();
      if (controller.signal.aborted) return 0;
      const playlists: PlayList[] = resources.map((resource) => ({
        id: resource.identifier, user: resource.name, title: resource.metadata?.title || resource.identifier,
        description: resource.metadata?.description || '', created: resource.created,
        updated: resource.updated, image: null, songs: []
      }));
      dispatch(upsertPlaylists(playlists));
      return resources.length;
    };
    setLoading(true);
    setError('');
    void Promise.allSettled([...SONG_PREFIXES.map(searchSongs), ...(query.trim() ? [searchPlaylists()] : [])]).then((results) => {
      if (controller.signal.aborted) return;
      setHasMore(results.some((result) => result.status === 'fulfilled' && result.value === 20));
      if (results.some((result) => result.status === 'rejected')) setError('Some search results could not be loaded. Please try again.');
      setLoading(false);
    });
    return () => controller.abort();
  }, [query, page, dispatch]);

  return { loading, error, hasMore, loadMore: () => setPage((value) => value + 1) };
};
export default useCatalogSearch;
