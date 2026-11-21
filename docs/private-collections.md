# Private Collections implementation plan

Status: **scaffolding / Coming Soon**. No private upload, subscription payment,
group mutation, key distribution or protected playback is active.

## Product contract

An artist creates a collection for a private group and offers subscriber tiers,
similar to the subscription-gated publishing concept described as Subwire.
Fans with an active entitlement and group membership receive access to exclusive
releases. This is a product analogy, not a claim that Subwire's protocol has
been inspected or implemented. Integrate a verified Subwire adapter later if
its actual schemas and entitlement authority are selected.

Use existing React, TypeScript, Redux, React Router and Qortal bridge conventions.
Keep ordinary public AUDIO uploads and private collections as separate paths.
A visibility boolean on a public playlist is insufficient: anyone with its
public AUDIO locator could retrieve the audio.

## Model and boundaries

`src/features/privateCollections/model.ts` defines artist-owned collection drafts,
subscriber tiers, verified subscription evidence and access decisions. The
public teaser may contain owner/group/tier marketing details only. Track names,
private descriptions, audio locators, covers and keys belong in an encrypted
manifest and encrypted media resources. Do not extend public `Song` snapshots,
Redux history, playlists or localStorage with private media/key material.

Collection identity binds the artist address and collection ID. Access binds the
same collection, account address, group ID and tier ID to a confirmed, verified
entitlement with a valid time window. Read-only membership facts and entitlement
facts must come from trusted adapters, not arbitrary browser JSON. Expired,
revoked, pending, malformed and mismatched proofs fail closed. Short-lived access
must be rechecked before decrypt/playback and on account/group changes.
The current pure evaluator is policy scaffolding, not a cryptographic verifier.

`gateway.ts` defines interfaces for artist draft publication, subscriber access
and private media. Its shipped implementation always throws Coming Soon, so no
consumer can accidentally interpret a stub as successful authorization or publish
plaintext. No environment switch enables these incomplete paths.

## Delivery phases and acceptance gates

1. **Delivered:** domain model, strict policy evaluator, unavailable gateway,
   unit tests, Home Coming Soon card and `/private-collections` explanation.
2. **Adapter research:** inspect the supported Hub/Core private publishing and
   group-key APIs, plus the actual Subwire entitlement model. Select closed group
   ownership rules and an authoritative subscription proof format. Document
   fee, term, renewal, refund, cancellation and rejoin behavior before any payment UI.
3. **Encrypted artist flow:** verify authenticated artist owns the publisher and
   manages the closed group. Encrypt each release and manifest before publishing;
   prevent accidental public AUDIO submission. Keep keys in the wallet/Hub bridge,
   never React state, app logs, Git, public metadata or browser persistence.
4. **Entitlements:** verify confirmed receipts, exact recipient/asset/amount and
   unique receipt identity; prevent reuse across accounts, tiers or collections.
   Decide manual renewal versus any approved recurring mechanism. Never imply
   unattended recurring transfers exist. Provision group/key access only after
   proof confirmation; model pending and failed operations explicitly.
5. **Listener flow:** authorize, decrypt in memory, expose short-lived object URLs,
   revoke URLs and clear private queue/buffers on logout, account switch,
   membership loss or expiry. Ensure normal search, public playlist exports,
   thumbnails, shared links and playback history cannot leak private locators.
6. **Release gate:** independent security review plus end-to-end tests for active,
   expired, revoked, refunded, wrong-account/group/tier/collection, open-group and
   key-rotation cases, interrupted publishing, membership churn and multiple devices.
   Activate only after owner-approved live verification and a changelog release.

Membership removal and key rotation protect future releases; they cannot erase
plaintext a former member already obtained. Define past-catalog access policy
explicitly. Payment status alone cannot revoke copied keys. Do not promise DRM.
Group membership is visible on chain; avoid promising subscriber anonymity.

Qortal's [Q-App documentation](https://github.com/Qortal/qortal/blob/master/Q-Apps.md)
lists private resource services, and the
[Q-Chat documentation](https://wiki.qortal.org/doku.php?id=q-chat) describes group
key updates on membership changes. These support the design direction; the
exact supported adapters still require verification before implementation.
