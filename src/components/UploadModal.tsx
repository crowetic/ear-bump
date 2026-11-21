import ShortUniqueId from 'short-unique-id';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import Compressor from 'compressorjs';
import { useDispatch, useSelector } from 'react-redux';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import useUploadModal from '../hooks/useUploadModal';
import { RootState } from '../state/store';
import { toBase64, objectToBase64 } from '../utils/toBase64';
import { addNewSong, setImageCoverHash } from '../state/features/globalSlice';
import { compactSongDescription, readAudioDuration } from '../utils/publishSongMetadata';
import { isoDate } from '../utils/songMetadata';
import type { Song } from '../types';

const uid = new ShortUniqueId();
interface UploadFields {
  title: string;
  author: string;
  album: string;
  description: string;
  genre: string;
  mood: string;
  bpm: string;
  duration: string;
  releaseDate: string;
  explicit: boolean;
  tags: string;
  song: FileList;
  image: FileList;
}

const compressImage = (image: File) => new Promise<Blob>((resolve, reject) => {
  new Compressor(image, { quality: 0.6, maxWidth: 300, mimeType: 'image/webp', success: resolve, error: reject });
});

const UploadModal = () => {
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const uploadModal = useUploadModal();
  const { register, handleSubmit, reset } = useForm<UploadFields>({
    defaultValues: { title: '', author: '', genre: '', album: '', description: '', mood: '', bpm: '',
      duration: '', releaseDate: '', explicit: false, tags: '' }
  });

  const onChange = (open: boolean) => { if (!open) { reset(); uploadModal.onClose(); } };
  const onSubmit: SubmitHandler<UploadFields> = async (values) => {
    if (!username) { toast.error('Please authenticate'); return; }
    const songFile = values.song?.[0];
    const imageFile = values.image?.[0];
    if (!songFile || !imageFile || !values.title.trim() || !values.author.trim() || !values.genre.trim()) {
      toast.error('Please add a title, artist, genre, audio file and cover.'); return;
    }
    setIsLoading(true);
    try {
      const imageData = await toBase64(new File([await compressImage(imageFile)], 'cover.webp', { type: 'image/webp' }));
      if (typeof imageData !== 'string') throw new Error('Invalid image.');
      const compressedImg = imageData.split(',')[1];
      const cleanTitle = values.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'song';
      const identifier = `earbump_song_${cleanTitle}_${uid(8)}`;
      const revision = uid(16);
      const now = Date.now();
      const releaseDate = values.releaseDate ? isoDate(values.releaseDate) : new Date(now).toISOString().slice(0, 10);
      if (!releaseDate) throw new Error('Please enter a valid release date.');
      const bpm = values.bpm.trim() ? Number(values.bpm) : undefined;
      const duration = values.duration.trim() ? Number(values.duration) : await readAudioDuration(songFile);
      if (bpm !== undefined && (!Number.isFinite(bpm) || bpm <= 0)) throw new Error('BPM must be a positive number.');
      if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) throw new Error('Duration must be zero or more seconds.');
      const song: Song = {
        id: identifier, name: username, service: 'AUDIO', source: 'ear-bump',
        title: values.title.trim(), author: values.author.trim(), artist: values.author.trim(),
        album: values.album.trim() || undefined, genre: values.genre.trim(), mood: values.mood.trim() || undefined,
        description: values.description.trim(), bpm, duration, releaseDate, explicit: values.explicit,
        tags: [...new Set(values.tags.split(',').map((tag) => tag.trim()).filter(Boolean))],
        created: now, updated: now,
        audio: { name: username, service: 'AUDIO', identifier, bytes: songFile.size, filename: songFile.name, mimeType: songFile.type },
        coverArt: { name: username, service: 'THUMBNAIL', identifier }
      };
      const description = compactSongDescription(song, revision);
      const fields = { title: song.title, artist: song.artist, author: song.author, album: song.album,
        description: song.description, genre: song.genre, mood: song.mood, bpm: song.bpm, duration: song.duration,
        releaseDate: song.releaseDate, explicit: song.explicit, tags: song.tags };
      const descriptor = { schema: 'earbump.song.v1', publisher: username, identifier, revision,
        fields, audio: song.audio, coverArt: song.coverArt };
      const documentData = await objectToBase64(descriptor);
      const result = await qortalRequest({ action: 'PUBLISH_MULTIPLE_QDN_RESOURCES', resources: [
        { name: username, service: 'AUDIO', file: songFile, title: song.title, description, identifier, filename: songFile.name },
        { name: username, service: 'DOCUMENT', data64: documentData, title: 'ear-bump song metadata', identifier },
        { name: username, service: 'THUMBNAIL', data64: compressedImg, identifier }
      ] });
      if (result?.error || result === false) throw new Error(typeof result?.message === 'string' ? result.message : 'Song publication failed.');
      dispatch(addNewSong({ ...song, metadataDescription: description }));
      dispatch(setImageCoverHash({ url: `data:image/webp;base64,${compressedImg}`, id: identifier }));
      toast.success('Song created!');
      reset();
      uploadModal.onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish the song.');
    } finally { setIsLoading(false); }
  };

  return <Modal title="Add a song" description="Add a title, artist, genre, audio file and cover. Other details are optional."
    isOpen={uploadModal.isOpen} onChange={onChange}>
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-4">
      {(['title', 'author', 'genre'] as const).map((field) => <label key={field} className="text-sm text-neutral-300">
        {field === 'author' ? 'Artist' : field === 'title' ? 'Song title' : 'Genre'} *
        <Input disabled={isLoading} {...register(field, { required: true, maxLength: field === 'title' ? 35 : 100 })} required />
      </label>)}
      <details className="text-sm text-neutral-300"><summary className="cursor-pointer text-emerald-300">More song details</summary>
        <div className="mt-3 flex flex-col gap-3">
          {(['album', 'description', 'mood', 'tags'] as const).map((field) => <label key={field}>
            {field === 'tags' ? 'Tags (comma separated)' : field.charAt(0).toUpperCase() + field.slice(1)}
            <Input disabled={isLoading} {...register(field, { maxLength: 2000 })} />
          </label>)}
          <label>BPM<Input disabled={isLoading} type="number" min="1" step="any" {...register('bpm')} /></label>
          <label>Duration (seconds; detected from audio if blank)<Input disabled={isLoading} type="number" min="0" step="any" {...register('duration')} /></label>
          <label>Release date (today if blank)<Input disabled={isLoading} type="date" {...register('releaseDate')} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" disabled={isLoading} {...register('explicit')} /> Explicit content</label>
        </div>
      </details>
      <label className="text-sm text-neutral-300">Audio file *<Input disabled={isLoading} type="file" accept="audio/*" {...register('song', { required: true })} required /></label>
      <label className="text-sm text-neutral-300">Cover image *<Input disabled={isLoading} type="file" accept="image/*" {...register('image', { required: true })} required /></label>
      <Button disabled={isLoading} type="submit">{isLoading ? 'Publishing…' : 'Create'}</Button>
    </form>
  </Modal>;
};
export default UploadModal;
