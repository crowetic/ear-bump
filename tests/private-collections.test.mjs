import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const output = mkdtempSync(join(tmpdir(), 'ear-bump-private-test-'));
const require = createRequire(import.meta.url);
for (const file of ['model', 'gateway']) {
  writeFileSync(join(output, `${file}.js`), ts.transpileModule(readFileSync(new URL(`../src/features/privateCollections/${file}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
  }).outputText);
}
after(() => rmSync(output, { recursive: true }));
const { evaluateCollectionAccess, isValidPrivateCollection } = require(join(output, 'model.js'));
const { privateCollectionGateway, PrivateCollectionsUnavailableError } = require(join(output, 'gateway.js'));
const collection = { schema: 'earbump.private-collection.v1', id: 'collection-1', artistAddress: 'artist', publisher: 'Artist', title: 'Private release', groupId: 42, visibility: 'private', tiers: [{ id: 'supporter', label: 'Supporter', price: '1.00', assetId: 0, termDays: 30 }] };
const member = { accountAddress: 'listener', groupId: 42, isClosedGroup: true, isMember: true };
const proof = { status: 'active', verified: true, receiptId: 'confirmed-receipt', issuerAddress: 'artist', accountAddress: 'listener', collectionId: 'collection-1', groupId: 42, tierId: 'supporter', startsAt: 100, expiresAt: 200 };
const access = (changes = {}, at = 150) => evaluateCollectionAccess(collection, 'listener', member, { ...proof, ...changes }, at);

test('valid matching evidence passes the policy evaluator', () => assert.deepEqual(access(), { allowed: true }));
test('expiry, pending, revoked, future and unverified receipts fail closed', () => {
  for (const changes of [{ status: 'pending' }, { status: 'revoked' }, { status: 'expired' }, { verified: false }, { verified: 'true' }, { receiptId: {} }, { startsAt: 151 }, { expiresAt: NaN }, { receiptId: '' }]) assert.equal(access(changes).allowed, false);
  assert.equal(access({}, 200).allowed, false);
  assert.equal(access({}, NaN).allowed, false);
});
test('proof cannot be reused for another account, artist, collection, group or tier', () => {
  for (const changes of [{ accountAddress: 'other' }, { issuerAddress: 'impostor' }, { collectionId: 'other' }, { groupId: 43 }, { tierId: 'other' }]) assert.equal(access(changes).allowed, false);
});
test('authentication and verified closed-group membership are required', () => {
  assert.equal(evaluateCollectionAccess(collection, undefined, member, proof, 150).allowed, false);
  for (const changes of [{ isMember: false }, { isClosedGroup: false }, { accountAddress: 'other' }, { groupId: 43 }]) assert.equal(evaluateCollectionAccess(collection, 'listener', { ...member, ...changes }, proof, 150).allowed, false);
});
test('invalid collections, duplicated tiers and malformed prices are rejected', () => {
  for (const changes of [{ visibility: 'public' }, { groupId: 0 }, { tiers: [] }, { tiers: {} }, { tiers: [null] }, { artistAddress: {} }, { tiers: [...collection.tiers, ...collection.tiers] }, { tiers: [{ ...collection.tiers[0], price: '-1' }] }, { tiers: [{ ...collection.tiers[0], price: 1 }] }]) assert.equal(isValidPrivateCollection({ ...collection, ...changes }), false);
});
test('all production gateway operations remain unavailable', async () => {
  await assert.rejects(privateCollectionGateway.publishCollection(collection), PrivateCollectionsUnavailableError);
  await assert.rejects(privateCollectionGateway.openCollection('collection-1'), PrivateCollectionsUnavailableError);
  await assert.rejects(privateCollectionGateway.subscribe('collection-1', 'supporter'), PrivateCollectionsUnavailableError);
});
