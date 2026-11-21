import type { PrivateCollectionDraft } from './model';

export interface PrivateCollectionGateway {
  publishCollection(draft: PrivateCollectionDraft): Promise<void>;
  openCollection(collectionId: string): Promise<Blob>;
  subscribe(collectionId: string, tierId: string): Promise<void>;
}

export class PrivateCollectionsUnavailableError extends Error {
  constructor() {
    super('Private Collections are coming soon.');
    this.name = 'PrivateCollectionsUnavailableError';
  }
}

// Replace only after the encryption, entitlement and wallet adapters pass their release gates.
export const privateCollectionGateway: PrivateCollectionGateway = {
  publishCollection: async () => { throw new PrivateCollectionsUnavailableError(); },
  openCollection: async () => { throw new PrivateCollectionsUnavailableError(); },
  subscribe: async () => { throw new PrivateCollectionsUnavailableError(); }
};
