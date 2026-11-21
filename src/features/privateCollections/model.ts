export const PRIVATE_COLLECTIONS_STATUS = 'coming-soon' as const;

export interface SubscriptionTier {
  id: string;
  label: string;
  // Decimal values and supported asset IDs must be validated by the future payment adapter.
  price: string;
  assetId: number;
  termDays: number;
}

export interface PrivateCollectionDraft {
  schema: 'earbump.private-collection.v1';
  id: string;
  artistAddress: string;
  publisher: string;
  title: string;
  groupId: number;
  visibility: 'private';
  tiers: SubscriptionTier[];
}

// Only a trusted entitlement adapter may produce this evidence. This type is not a signature verifier.
export interface VerifiedSubscription {
  status: 'active' | 'pending' | 'expired' | 'revoked';
  verified: boolean;
  receiptId: string;
  issuerAddress: string;
  accountAddress: string;
  collectionId: string;
  groupId: number;
  tierId: string;
  startsAt: number;
  expiresAt: number;
}

export type CollectionAccess = { allowed: true } | {
  allowed: false;
  reason: 'invalid-collection' | 'authentication-required' | 'membership-required' | 'subscription-required';
};

const hasText = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim());

export const isValidPrivateCollection = (collection: PrivateCollectionDraft) => {
  if (!collection || !Array.isArray(collection.tiers) || !collection.tiers.every(tier => tier && typeof tier === 'object')) return false;
  const ids = new Set(collection.tiers?.map((tier) => tier.id));
  return collection.schema === 'earbump.private-collection.v1' && collection.visibility === 'private'
    && [collection.id, collection.artistAddress, collection.publisher, collection.title].every(hasText)
    && Number.isSafeInteger(collection.groupId) && collection.groupId > 0
    && Array.isArray(collection.tiers) && collection.tiers.length > 0 && ids.size === collection.tiers.length
    && collection.tiers.every((tier) => hasText(tier.id) && hasText(tier.label)
      && typeof tier.price === 'string' && /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(tier.price)
      && Number.isSafeInteger(tier.assetId) && tier.assetId >= 0
      && Number.isSafeInteger(tier.termDays) && tier.termDays > 0);
};

export const evaluateCollectionAccess = (
  collection: PrivateCollectionDraft,
  accountAddress: string | undefined,
  // Supplied by a verified closed-group membership adapter, never a user-editable setting.
  membership: { accountAddress: string; groupId: number; isClosedGroup: boolean; isMember: boolean } | undefined,
  subscription: VerifiedSubscription | undefined,
  at: number
): CollectionAccess => {
  if (!isValidPrivateCollection(collection)) return { allowed: false, reason: 'invalid-collection' };
  if (!hasText(accountAddress)) return { allowed: false, reason: 'authentication-required' };
  if (membership?.isClosedGroup !== true || membership.isMember !== true || membership.accountAddress !== accountAddress
    || membership.groupId !== collection.groupId) return { allowed: false, reason: 'membership-required' };
  if (subscription?.verified !== true || subscription.status !== 'active' || !hasText(subscription.receiptId)
    || subscription.issuerAddress !== collection.artistAddress || subscription.accountAddress !== accountAddress
    || subscription.collectionId !== collection.id || subscription.groupId !== collection.groupId
    || !collection.tiers.some((tier) => tier.id === subscription.tierId)
    || !Number.isFinite(at) || !Number.isFinite(subscription.startsAt) || !Number.isFinite(subscription.expiresAt)
    || subscription.startsAt > at || subscription.expiresAt <= at || subscription.expiresAt <= subscription.startsAt) {
    return { allowed: false, reason: 'subscription-required' };
  }
  return { allowed: true };
};
