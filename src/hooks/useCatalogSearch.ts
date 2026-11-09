import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { PlayList, Status, setImageCoverHash, upsertPlaylists, upsertQueried } from '../state/features/globalSlice';
import { queueFetchAvatars } from '../wrappers/GlobalWrapper';
import { getSongMetadata, ResourceMetadata } from '../utils/songMetadata';

interface SearchResource {
  identifier: string;
  name: string;
  created: number;
  updated: number;
  status?: Status;
  metadata?: ResourceMetadata;
}

// Each query owns its requests. Cleanup aborts previous queries and pagination.
const useCatalogSearch = (query: string) => {
  const dispatch = useDispatch();
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const search = async (service: 'AUDIO' | 'PLAYLIST') => {
      const params = new URLSearchParams({
        mode: 'ALL', service, query: query.trim().toLowerCase().replace(/ /g, '_'),
        identifier: service === 'AUDIO' ? 'earbump_song_' : 'earbump_playlist_',
        limit: '20', offset: String(page * 20), includemetadata: 'true',
        reverse: 'true', excludeblocked: 'true', includestatus: 'true'
      });
      const response = await fetch(`/arbitrary/resources/search?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Search is temporarily unavailable.');
      const resources: SearchResource[] = await response.json();
      if (controller.signal.aborted) return 0;
      if (service === 'AUDIO') {
        dispatch(upsertQueried(resources.map((resource) => ({
          ...getSongMetadata(resource.metadata), id: resource.identifier, name: resource.name,
          service, status: resource.status
        }))));
        for (const resource of resources) {
          queueFetchAvatars.push(async () => {
            try {
              const url = await qortalRequest({ action: 'GET_QDN_RESOURCE_URL', service: 'THUMBNAIL', name: resource.name, identifier: resource.identifier });
              if (url && url !== 'Resource does not exist') dispatch(setImageCoverHash({ id: resource.identifier, url }));
            } catch { /* Missing covers use the existing placeholder. */ }
          });
        }
      } else {
        const playlists: PlayList[] = resources.map((resource) => ({
          id: resource.identifier, user: resource.name, title: resource.metadata?.title || resource.identifier,
          description: resource.metadata?.description || '', created: resource.created,
          updated: resource.updated, image: null, songs: []
        }));
        dispatch(upsertPlaylists(playlists));
      }
      return resources.length;
    };
    setLoading(true);
    setError('');
    void Promise.allSettled([search('AUDIO'), search('PLAYLIST')]).then((results) => {
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
