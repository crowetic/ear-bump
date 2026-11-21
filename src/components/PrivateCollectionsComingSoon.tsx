import { Link } from 'react-router-dom';
import { HiLockClosed } from 'react-icons/hi';

const PrivateCollectionsComingSoon = () => (
  <section aria-labelledby="private-collections-heading" className="mx-6 my-6 rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-950 to-neutral-800 p-6">
    <div className="flex flex-wrap items-center gap-3">
      <HiLockClosed aria-hidden="true" className="text-emerald-400" size={24} />
      <h2 id="private-collections-heading" className="text-xl font-semibold text-white">Private Collections</h2>
      <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">Coming Soon</span>
    </div>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300">Music for your inner circle. Artists will be able to release exclusive tracks and collections to a private group, with subscriber access inspired by Subwire.</p>
    <Link to="/private-collections" className="mt-4 inline-block rounded-full border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400">Explore what’s coming</Link>
  </section>
);

export default PrivateCollectionsComingSoon;
