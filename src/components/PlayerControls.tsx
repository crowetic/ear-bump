import { useId, useState } from 'react';
import { BsRepeat, BsRepeat1, BsShuffle, BsMusicNoteList } from 'react-icons/bs';
import usePlayer from '../hooks/usePlayer';

const PlayerControls = () => {
  const { shuffle, repeat, setShuffle, setRepeat, queue, currentSong, startTrack } = usePlayer();
  const [queueOpen, setQueueOpen] = useState(false);
  const queueId = useId();
  const RepeatIcon = repeat === 'one' ? BsRepeat1 : BsRepeat;

  return (
    <div className="flex shrink-0 items-center gap-x-1 lg:gap-x-2">
      <button type="button" aria-label="Shuffle" aria-pressed={shuffle}
        title={shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
        onClick={() => setShuffle(!shuffle)}
        className={`p-1 lg:p-2 hover:opacity-75 ${shuffle ? 'text-green-500' : 'text-neutral-400'}`}>
        <BsShuffle size={20} />
      </button>
      <button type="button" aria-label={`Repeat: ${repeat}`} aria-pressed={repeat !== 'off'}
        title={`Repeat: ${repeat}`} onClick={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}
        className={`p-1 lg:p-2 hover:opacity-75 ${repeat !== 'off' ? 'text-green-500' : 'text-neutral-400'}`}>
        <RepeatIcon size={20} />
      </button>
      <button type="button" aria-label="Queue" aria-expanded={queueOpen} aria-controls={queueId}
        title="Queue" onClick={() => setQueueOpen(!queueOpen)}
        className={`p-1 lg:p-2 hover:opacity-75 ${queueOpen ? 'text-green-500' : 'text-neutral-400'}`}>
        <BsMusicNoteList size={20} />
      </button>
      {queueOpen && (
        <section id={queueId} aria-label="Playback queue"
          className="absolute bottom-full right-2 z-50 mb-2 max-h-[60vh] w-80 max-w-[95vw] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">Queue ({queue.length})</h2>
            <button type="button" aria-label="Close queue" onClick={() => setQueueOpen(false)} className="text-neutral-400 hover:text-white">✕</button>
          </div>
          {queue.length === 0 && <p className="text-neutral-400">Your queue is empty.</p>}
          <ol>
            {queue.map((song, index) => (
              <li key={`${song.id}-${index}`}>
                <button type="button" onClick={() => startTrack(song)} aria-current={song.id === currentSong ? 'true' : undefined}
                  className={`w-full rounded-md p-2 text-left hover:bg-neutral-800 ${song.id === currentSong ? 'bg-neutral-800 text-green-500' : 'text-white'}`}>
                  <span className="block truncate">{index + 1}. {song.title}</span>
                  <span className="block truncate text-sm text-neutral-400">{song.author}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
};

export default PlayerControls;
