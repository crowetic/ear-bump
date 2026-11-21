import Header from '../../components/Header';
import PrivateCollectionsComingSoon from '../../components/PrivateCollectionsComingSoon';

export const PrivateCollections = () => (
  <div className="h-full w-full overflow-y-auto rounded-lg bg-neutral-900 pb-8">
    <Header><h1 className="text-3xl font-semibold text-white">Your music. Your inner circle.</h1></Header>
    <PrivateCollectionsComingSoon />
    <div className="grid gap-4 px-6 md:grid-cols-3">
      {[
        ['Create a private group', 'Bring your supporters together in an artist-led space.'],
        ['Offer subscriber access', 'Plan tiers for exclusive releases and early listening.'],
        ['Share private collections', 'Release music to your group with protected access.']
      ].map(([title, description]) => <section key={title} className="rounded-lg bg-white/5 p-5"><h2 className="font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-relaxed text-neutral-300">{description}</p></section>)}
    </div>
    <p className="px-6 pt-6 text-sm text-neutral-400">Private Collections are in development. Subscriptions and private releases are not available yet.</p>
  </div>
);
