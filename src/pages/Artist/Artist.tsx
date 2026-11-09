import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import TrackCollection from '../../components/TrackCollection';
import useSongCatalog from '../../hooks/useSongCatalog';
import { artistName, normalizeName } from '../../utils/songMetadata';

export const Artist = () => {
  const { name = '' } = useParams();
  const catalog = useSongCatalog();
  const songs = useMemo(() => catalog.filter((song) => normalizeName(artistName(song)) === normalizeName(name)), [catalog, name]);
  return <TrackCollection title={name} kind="Artist" songs={songs} />;
};
