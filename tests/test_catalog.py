import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('catalog', Path(__file__).parents[1] / 'scripts/catalog.py')
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


class FakeClient:
    def __init__(self, pages):
        self.pages = iter(pages)
        self.urls = []

    def get(self, url, **kwargs):
        self.urls.append(url)
        return next(self.pages)


def row(identifier):
    return {'name': 'Publisher', 'service': 'AUDIO', 'identifier': 'earbump_song_' + identifier}


class CatalogTests(unittest.TestCase):
    def test_short_pages_are_not_treated_as_end(self):
        client = FakeClient([[row('a')], [row('b')], []])
        self.assertEqual(len(catalog.scan(client, 'https://example.test', 'earbump_song_')), 2)
        self.assertIn('offset=1', client.urls[1])
        self.assertIn('offset=2', client.urls[2])

    def test_repeated_qdn_page_fails_instead_of_truncating(self):
        with self.assertRaisesRegex(ValueError, 'Repeated QDN'):
            catalog.scan(FakeClient([[row('a')], [row('a')]]), 'https://example.test', 'earbump_song_')

    def test_musicbrainz_search_exhausts_reported_count(self):
        client = FakeClient([{'count': 2, 'recordings': [{'id': 'a'}]}, {'count': 2, 'recordings': [{'id': 'b'}]}])
        self.assertEqual(len(catalog.search(client, 'recording', 'example')), 2)
        self.assertIn('offset=1', client.urls[1])

    def test_musicbrainz_premature_empty_page_is_failure(self):
        client = FakeClient([{'count': 2, 'recordings': [{'id': 'a'}]}, {'count': 2, 'recordings': []}])
        with self.assertRaisesRegex(ValueError, 'before reported total'):
            catalog.search(client, 'recording', 'example')

    def test_exact_artist_and_title_required(self):
        recording = {'id': 'a', 'title': 'Song', 'artist-credit': [{'name': 'Artist'}]}
        self.assertEqual(catalog.matching_recordings([recording], 'Artist', 'song'), [recording])
        self.assertEqual(catalog.matching_recordings([recording], 'Other Artist', 'Song'), [])
        self.assertEqual(catalog.matching_recordings([recording], 'Artist', 'Song (remix)'), [])

    def test_non_genre_tags_and_tied_genres_do_not_become_assignments(self):
        self.assertIsNone(catalog.choose_genre([{'tags': [{'name': 'american', 'count': 5}]}], {'rock'}))
        self.assertIsNone(catalog.choose_genre([{'tags': [{'name': 'rock', 'count': 2}, {'name': 'pop', 'count': 2}]}], {'rock', 'pop'}))
        self.assertEqual(catalog.choose_genre([{'tags': [{'name': 'rock', 'count': 3}]}], {'rock'}), 'rock')

    def test_encoded_descriptions_preserve_artist(self):
        self.assertEqual(catalog.fields({'metadata': {'description': 'v=2;author=Bj%C3%B6rk;genre=Art%20Pop'}})['author'], 'Björk')


if __name__ == '__main__':
    unittest.main()
