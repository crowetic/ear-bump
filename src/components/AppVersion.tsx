import { Link } from 'react-router-dom';
import { version } from '../../package.json';

const AppVersion = () => (
  <div className="shrink-0 bg-black px-3 py-2">
    <Link to="/changelog" aria-label={`Ear-Bump version ${version}. Open changelog`}
      className="inline-flex rounded-full border border-neutral-600 px-2 py-0.5 text-xs font-medium text-neutral-300 transition-colors hover:border-emerald-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
      v{version}
    </Link>
  </div>
);
export default AppVersion;
