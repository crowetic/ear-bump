import { Link } from 'react-router-dom';
import { version } from '../../../package.json';
import changelog from '../../../CHANGELOG.md?raw';

const blocks = changelog.replace(/^# .*\n+/, '').trim().split(/\n{2,}/);

// Render the supported Markdown blocks as text in native elements; never inject HTML.
export const Changelog = () => (
  <div className="h-full overflow-y-auto rounded-lg bg-neutral-900 p-6 text-neutral-200">
    <Link to="/" className="text-sm text-emerald-400 hover:underline">Back to music</Link>
    <h1 className="mt-4 text-3xl font-semibold text-white">Ear-Bump changelog</h1>
    <p className="mt-2 text-sm text-neutral-400">Current version: {version}</p>
    <div className="mt-6 max-w-3xl space-y-5 text-sm leading-relaxed">
      {blocks.map((block, index) => {
        if (block.startsWith('## ')) return <h2 key={index} className="border-t border-neutral-700 pt-5 text-lg font-semibold text-white">{block.slice(3).replace(/^\[([^\]]+)\]/, '$1')}</h2>;
        if (block.startsWith('- ')) return <ul key={index} className="list-disc space-y-2 pl-5 text-neutral-300">
          {block.split(/\n(?=- )/).map((item, itemIndex) => <li key={itemIndex}>{item.replace(/^- /, '').replace(/\n/g, ' ')}</li>)}
        </ul>;
        return <p key={index} className="text-neutral-300">{block.replace(/\n/g, ' ')}</p>;
      })}
    </div>
  </div>
);
