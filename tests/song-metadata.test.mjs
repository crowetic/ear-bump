import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Compile the pure application helpers into an isolated CommonJS temp directory.
// No app dependencies, test framework installation or production outputs are changed.
const output = mkdtempSync(join(tmpdir(), 'ear-bump-metadata-test-'));
const require = createRequire(import.meta.url);
process.env.VITE_LEGACY_GENRE_PUBLISHER = 'CatalogOwner';
for (const file of ['songMetadata', 'songResources', 'legacyGenres', 'publishSongMetadata']) {
  const source = readFileSync(new URL(`../src/utils/${file}.ts`, import.meta.url), 'utf8').replaceAll('import.meta.env.', 'process.env.').replaceAll('../../data/legacy/current/genres.json', new URL('../data/legacy/current/genres.json', import.meta.url).pathname);
  writeFileSync(join(output, `${file}.js`), ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
  }).outputText);
}
const metadata = require(join(output, 'songMetadata.js'));
const resources = require(join(output, 'songResources.js'));
const legacy = require(join(output, 'legacyGenres.js'));
const publishing = require(join(output, 'publishSongMetadata.js'));
const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
after(() => { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; rmSync(output, { recursive: true }); });
const base = { id: 'earbump_song_test_123', name: 'Publisher', service: 'AUDIO', title: 'Title', author: 'Artist', created: 1609459200000 };
const document = { schema: 'earbump.legacy-genres.v1', updatedAt: '2099-11-20T00:00:00Z', songs: [
  { name: 'publisher', service: 'AUDIO', identifier: base.id, title: 'Title', artist: 'Artist', genre: 'Trance',
    mood: 'energetic', bpm: 128, releaseDate: '2001-01-01', explicit: true, tags: ['dance'] }
] };

test('legacy descriptions and structured new metadata normalize without inventing fields', () => {
  const result = metadata.getSongMetadata({ description: 'title=Song;author=Artist;genre=Trance;mood=nice;duration=1:02:03;tempo=128', explicit: false });
  assert.equal(result.title, 'Song'); assert.equal(result.artist, 'Artist'); assert.equal(result.genre, 'Trance');
  assert.equal(result.duration, 3723); assert.equal(result.bpm, 128); assert.equal(result.explicit, false);
  assert.equal(metadata.songCategory({ ...base, category: 'MUSIC' }), '');
  assert.equal(metadata.songCategory({ ...base, genre: ' Uncategorized ' }), '');
  assert.equal(metadata.getSongMetadata({ vibe: 'chill', tempo: 0 }).mood, 'chill');
  assert.equal(metadata.getSongMetadata({ tempo: 0 }).bpm, undefined);
});
test('encoded Q-Music values decode while historical percent text stays literal', () => {
  const result = metadata.getSongMetadata({ title: 'Song', description: 'v=2;rev=a;author=Bj%C3%B6rk;album=One%3BTwo;genre=Rock%20%26%20Metal;publishedDate=2026-11-20;mood=%E0%A4%A' });
  assert.equal(result.artist, 'Björk'); assert.equal(result.album, 'One;Two'); assert.equal(result.genre, 'Rock & Metal');
  assert.equal(result.releaseDate, '2026-11-20'); assert.equal(result.mood, '%E0%A4%A');
  assert.equal(metadata.getSongMetadata({ description: 'title=100%25 Human' }).title, '100%25 Human');
});
test('invalid numeric/date values and unknown explicit do not become real metadata', () => {
  const result = metadata.getSongMetadata({ bpm: 'NaN', duration: -2, releaseDate: '2026-02-30', explicit: 'no' });
  assert.equal(result.bpm, undefined); assert.equal(result.duration, undefined);
  assert.equal(result.releaseDate, undefined); assert.equal(result.explicit, undefined);
  assert.equal(metadata.isoDate('2026-11-20T23:00:00-05:00'), '2026-11-20T23:00:00-05:00');
  assert.equal(metadata.songReleaseDate(base), '2021-01-01');
});
test('song metadata wins; legacy fills gaps and preserves false/zero and identity', () => {
  const index = legacy.parseLegacyGenres(document);
  const result = legacy.applyLegacyGenres({ ...base, genre: 'Rock', bpm: 140, explicit: false, duration: 0 }, index);
  assert.equal(result.genre, 'Rock'); assert.equal(result.bpm, 140); assert.equal(result.explicit, false); assert.equal(result.duration, 0);
  assert.equal(result.mood, 'energetic'); assert.equal(result.releaseDate, '2001-01-01');
  assert.equal(legacy.applyLegacyGenres(base, index).genre, 'Trance');
  assert.equal(legacy.applyLegacyGenres({ ...base, name: 'OtherPublisher' }, index).genre, undefined);
  assert.equal(legacy.applyLegacyGenres(base, new Map()).releaseDate, undefined);
});
test('legacy values are re-resolved and never persist as native publisher fields', () => {
  const classified = legacy.applyLegacyGenres(base, legacy.parseLegacyGenres(document));
  const revised = legacy.applyLegacyGenres(classified, legacy.parseLegacyGenres({ ...document, songs: [{ ...document.songs[0], genre: 'Jazz' }] }));
  assert.equal(revised.genre, 'Jazz');
  const native = legacy.songWithoutLegacyMetadata(classified);
  assert.equal(native.genre, undefined); assert.equal(native.title, base.title); assert.equal(native.author, base.author);
  assert.equal(legacy.applyLegacyGenres(classified, new Map()).genre, undefined);
});

test('legacy index rejects malformed/duplicate entries and sanitizes optional data', () => {
  assert.throws(() => legacy.parseLegacyGenres({ ...document, schema: 'other' }));
  assert.throws(() => legacy.parseLegacyGenres({ ...document, songs: [...document.songs, ...document.songs] }));
  assert.throws(() => legacy.parseLegacyGenres({ ...document, songs: [{ ...document.songs[0], genre: null }] }));
  assert.throws(() => legacy.parseLegacyGenres({ ...document, songs: [{ ...document.songs[0], service: 'DOCUMENT' }] }));
  const index = legacy.parseLegacyGenres({ ...document, songs: [{ ...document.songs[0], mood: {}, tags: ['valid', 1], bpm: 'wrong' }] });
  const result = legacy.applyLegacyGenres(base, index); assert.equal(result.mood, undefined); assert.equal(result.bpm, undefined); assert.deepEqual(result.tags, ['valid']);
});
test('legacy list fetch is shared once and cached without requiring browser storage', async () => {
  let calls = 0;
  globalThis.localStorage = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } };
  globalThis.fetch = async (path) => { calls++; assert.equal(path, '/arbitrary/DOCUMENT/CatalogOwner/earbump_legacy_genres_v1'); return Response.json(document); };
  const [a, b] = await Promise.all([legacy.loadLegacyGenres(), legacy.loadLegacyGenres()]);
  assert.equal(a, b); assert.equal(calls, 1); assert.equal(a.size, 1);
});
test('resource addressing encodes names and identifiers; adapters identify both apps', () => {
  assert.equal(resources.resourcePath('AUDIO', 'Artist / name', "song#?"), '/arbitrary/AUDIO/Artist%20%2F%20name/song%23%3F');
  const song = resources.normalizeSongResource({ name: 'Q-Music', identifier: 'enjoymusic_song_test', metadata: { title: 'Song', description: 'author=Artist;genre=Trap' } });
  assert.equal(song.source, 'q-music'); assert.equal(song.service, 'AUDIO'); assert.equal(song.artist, 'Artist'); assert.equal(song.audio.identifier, song.id);
  assert.equal(resources.songSource('qmusic_track_old'), 'q-music'); assert.equal(resources.songSource(base.id), 'ear-bump');
});
test('new song compact metadata stays within Core limit and round-trips delimiters', () => {
  const description = publishing.compactSongDescription({ genre: 'Rock & Metal', author: 'A;=B'.repeat(100), releaseDate: '2026-11-20' }, 'abc');
  assert.ok(new TextEncoder().encode(description).length <= 240);
  assert.equal(metadata.getSongMetadata({ description }).genre, 'Rock & Metal');
  assert.ok(!/%[0-9a-f]?$/i.test(description));
  assert.throws(() => publishing.compactSongDescription({ genre: '超'.repeat(100), author: 'A' }, 'abc'));
});
test('Q-Music full descriptor enriches compact metadata, retains audio locator and caches revisions', async () => {
  let calls = 0;
  const song = resources.normalizeSongResource({ name: 'Q-Music', identifier: 'enjoymusic_song_v2', metadata: { title: 'Short', description: 'v=2;rev=abc;genre=Rock;author=Artist' } });
  globalThis.fetch = async (path) => { calls++; assert.equal(path, '/arbitrary/DOCUMENT/Q-Music/qmusic_meta_enjoymusic_song_v2');
    return Response.json({ schema: 'qmusic.song.v2', publisher: 'q-music', identifier: song.id, revision: 'abc',
      fields: { title: 'Full title', author: 'Full artist', genre: 'Rock & Metal', notes: 'Full notes', publishedDate: '2026-11-20' },
      audio: { sha256: 'hash', bytes: 100 } }); };
  const full = await resources.loadSongDescriptor(song); const cached = await resources.loadSongDescriptor(song);
  assert.equal(calls, 1); assert.equal(full, cached); assert.equal(full.title, 'Full title'); assert.equal(full.genre, 'Rock & Metal');
  assert.equal(full.artist, 'Full artist'); assert.equal(full.description, 'Full notes'); assert.equal(full.releaseDate, '2026-11-20');
  assert.equal(full.audio.identifier, song.id); assert.equal(full.audio.sha256, 'hash'); assert.equal(full.metadataDescription, song.description);
});
test('new ear-bump descriptors retain full descriptions, tags and explicit false', async () => {
  const song = resources.normalizeSongResource({ name: base.name, identifier: base.id, metadata: { title: 'Title', description: 'v=earbump1;rev=new;genre=Trance' } });
  globalThis.fetch = async (path) => { assert.equal(path, `/arbitrary/DOCUMENT/${base.name}/${base.id}`);
    return Response.json({ schema: 'earbump.song.v1', publisher: base.name, identifier: base.id, revision: 'new',
      fields: { title: 'Title', artist: 'Artist', genre: 'Trance', mood: 'chill', bpm: 130, explicit: false, tags: ['tag'], description: 'A real description', duration: 180 } }); };
  const full = await resources.loadSongDescriptor(song); assert.equal(full.description, 'A real description');
  assert.equal(full.explicit, false); assert.equal(full.bpm, 130); assert.equal(full.duration, 180); assert.deepEqual(full.tags, ['tag']);
});
test('stale/wrong-owner descriptors fail without modifying compact metadata', async () => {
  const song = resources.normalizeSongResource({ name: 'Q-Music', identifier: 'enjoymusic_song_stale', metadata: { description: 'v=2;rev=current;genre=Trap' } });
  globalThis.fetch = async () => Response.json({ schema: 'qmusic.song.v2', publisher: 'Attacker', identifier: song.id, revision: 'old', fields: { genre: 'Wrong' } });
  await assert.rejects(resources.loadSongDescriptor(song), /revision/); assert.equal(song.genre, 'Trap');
});
test('long Q-Music metadata identifiers use the publisher SHA-256 convention', async () => {
  const song = resources.normalizeSongResource({ name: 'Q-Music', identifier: 'enjoymusic_song_' + 'a'.repeat(60), metadata: { description: 'v=2;rev=long' } });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(song.id));
  const hash = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('').slice(0, 48);
  globalThis.fetch = async (path) => { assert.equal(path, `/arbitrary/DOCUMENT/Q-Music/qmusic_meta_${hash}`);
    return Response.json({ schema: 'qmusic.song.v2', publisher: 'Q-Music', identifier: song.id, revision: 'long', fields: {} }); };
  await resources.loadSongDescriptor(song);
});
test('metadata size limit rejects oversized responses', async () => {
  globalThis.fetch = async () => new Response('x'.repeat(100), { headers: { 'content-length': '100' } });
  await assert.rejects(resources.fetchMetadataDocument('/test', 10), /large/);
});

test('newer bundled classifications beat stale cache or remote data', () => {
  const fresh = { ...document, updatedAt: '2100-01-01T00:00:00Z' };
  assert.equal(legacy.newestGenreDocument([document, fresh, null]).document, fresh);
});
test('shipped snapshot works when QDN and storage are unavailable', async () => {
  delete require.cache[require.resolve(join(output, 'legacyGenres.js'))];
  const fresh = require(join(output, 'legacyGenres.js'));
  globalThis.fetch = async () => { throw Error('offline'); };
  globalThis.localStorage = { getItem: () => { throw Error('blocked'); }, setItem: () => {} };
  const index = await fresh.loadLegacyGenres();
  const bundled = JSON.parse(readFileSync(new URL('../data/legacy/current/genres.json', import.meta.url)));
  assert.equal(index.size, bundled.songs.length);
});

test('legacy recovered title fills discovery identifier placeholder', () => {
  assert.equal(legacy.applyLegacyGenres({ ...base, title: base.id }, legacy.parseLegacyGenres(document)).title, 'Title');
});
