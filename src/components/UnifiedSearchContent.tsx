import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { RootState } from '../state/store';
import useSongCatalog, { selectPlaylists } from '../hooks/useSongCatalog';
import useCatalogSearch from '../hooks/useCatalogSearch';
import { artistName, normalizeName } from '../utils/songMetadata';
import SearchContent from './SearchContent';

const tabs = ['Songs', 'Artists', 'Albums', 'Playlists'] as const;
type Tab = typeof tabs[number];

const UnifiedSearchContent = ({ query }: { query: string }) => {
  const [tab, setTab] = useState<Tab>('Songs');
  const catalog = useSongCatalog();
  const playlists = useSelector(selectPlaylists);
  const queriedSongs = useSelector((state: RootState) => state.global.songListQueried);
  const { loading, error, hasMore, loadMore } = useCatalogSearch(query);
  const results = useMemo(() => {
    const needle = normalizeName(query);
    const matches = (value: string) => normalizeName(value).includes(needle);
    const remoteIds = new Set(queriedSongs.map((song) => song.id));
    const songs = catalog.filter((song) => matches([song.title, artistName(song), song.album || ''].join(' ')) || remoteIds.has(song.id));
    const artists = [...new Map(catalog.map((song) => [normalizeName(artistName(song)), artistName(song)])).values()].filter((name) => name && matches(name));
    const albums = [...new Map(catalog.filter((song) => song.album).map((song) => [normalizeName(song.album || ''), song.album || ''])).values()].filter(matches);
    return { Songs: songs, Artists: artists, Albums: albums, Playlists: playlists.filter((playlist) => matches(`${playlist.title} ${playlist.description || ''} ${playlist.user || ''}`)) };
  }, [query, catalog, playlists, queriedSongs]);

  if (!query.trim()) return <p className="px-6 text-neutral-400">Search for songs, artists, albums and playlists.</p>;
  return (
    <div className="pb-6">
      <div role="tablist" aria-label="Search result types" className="flex flex-wrap gap-2 px-6 mb-5">
        {tabs.map((name) => (
          <button type="button" role="tab" id={`search-tab-${name}`} aria-controls={`search-panel-${name}`}
            aria-selected={tab === name} key={name} onClick={() => setTab(name)}
            className={`rounded-full px-4 py-2 ${tab === name ? 'bg-white text-black' : 'bg-neutral-800 text-white hover:bg-neutral-700'}`}>
            {name} ({results[name].length})
          </button>
        ))}
      </div>
      {loading && <p role="status" className="px-6 mb-3 text-neutral-400">Searching…</p>}
      {error && <p role="alert" className="px-6 mb-3 text-neutral-400">{error}</p>}
      <div role="tabpanel" id={`search-panel-${tab}`} aria-labelledby={`search-tab-${tab}`}>
        {results[tab].length === 0 ? <p className="px-6 text-neutral-400">No {tab.toLowerCase()} found.</p> : (
          <>
            {tab === 'Songs' && <SearchContent songs={results.Songs} />}
            {(tab === 'Artists' || tab === 'Albums') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 px-6">
                {(tab === 'Artists' ? results.Artists : results.Albums).map((name) => (
                  <Link key={name} to={`/${tab === 'Artists' ? 'artist' : 'album'}/${encodeURIComponent(name)}`}
                    className="rounded-md bg-neutral-400/5 p-4 hover:bg-neutral-400/10">
                    <p className="font-semibold text-white truncate">{name}</p>
                    <p className="text-sm text-neutral-400">{tab === 'Artists' ? 'Artist' : 'Album'}</p>
                  </Link>
                ))}
              </div>
            )}
            {tab === 'Playlists' && <div className="flex flex-col gap-2 px-6">
              {results.Playlists.map((playlist) => (
                <Link key={playlist.id} to={`/playlists/${encodeURIComponent(playlist.user || playlist.name || '')}/${encodeURIComponent(playlist.id)}`}
                  className="rounded-md p-3 hover:bg-neutral-800/50">
                  <p className="text-white">{playlist.title}</p>
                  <p className="text-sm text-neutral-400">{playlist.user}</p>
                </Link>
              ))}
            </div>}
          </>
        )}
      </div>
      {hasMore && <button type="button" onClick={loadMore} disabled={loading}
        className="mx-6 mt-5 rounded-full bg-neutral-800 px-4 py-2 text-white disabled:opacity-50">Load more results</button>}
    </div>
  );
};

export default UnifiedSearchContent;
