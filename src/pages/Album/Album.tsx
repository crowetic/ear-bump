import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import TrackCollection from '../../components/TrackCollection';
import useSongCatalog from '../../hooks/useSongCatalog';
import { artistName, formatDuration, normalizeName } from '../../utils/songMetadata';

export const Album = () => {
  const { name = '' } = useParams();
  const catalog = useSongCatalog();
  const songs = useMemo(() => catalog.filter((song) => normalizeName(song.album || '') === normalizeName(name))
    .sort((a, b) => (a.discNumber || 1) - (b.discNumber || 1) || (a.trackNumber ?? Infinity) - (b.trackNumber ?? Infinity)), [catalog, name]);
  const artists = [...new Set(songs.map(artistName).filter(Boolean))];
  const duration = songs.reduce((total, song) => total + (song.duration || 0), 0);
  const allDurationsKnown = songs.length > 0 && songs.every((song) => song.duration !== undefined);

  return <TrackCollection title={name} kind="Album" songs={songs} subtitle={
    <>
      <p>{artists.map((artist, index) => <span key={artist}>
        {index > 0 && ', '}<Link className="hover:underline" to={`/artist/${encodeURIComponent(artist)}`}>{artist}</Link>
      </span>)}</p>
      <p className="mt-2 text-sm">{allDurationsKnown ? `${formatDuration(duration)} total` : duration > 0 ? `${formatDuration(duration)} known duration (some tracks unavailable)` : 'Duration unavailable'}</p>
    </>
  } />;
};
