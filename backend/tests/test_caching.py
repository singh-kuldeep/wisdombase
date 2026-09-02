import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from embedder import (
    clear_embedding_cache,
    embed_many,
    embed_one,
    get_cache_stats,
)


class CachingTests(unittest.TestCase):
    def setUp(self):
        clear_embedding_cache()

    def test_embed_one_cache_hit(self):
        stats_initial = get_cache_stats()
        self.assertEqual(stats_initial["hits"], 0)
        self.assertEqual(stats_initial["misses"], 0)

        vec1 = embed_one("What is wisdombase?")
        stats_after_first = get_cache_stats()
        self.assertEqual(stats_after_first["hits"], 0)
        self.assertEqual(stats_after_first["misses"], 1)
        self.assertEqual(stats_after_first["size"], 1)

        vec2 = embed_one("What is wisdombase?")
        stats_after_second = get_cache_stats()
        self.assertEqual(stats_after_second["hits"], 1)
        self.assertEqual(stats_after_second["misses"], 1)
        self.assertEqual(vec1, vec2)

    def test_embed_many_batch_caching_and_deduplication(self):
        texts = ["chunk alpha", "chunk beta", "chunk alpha"]
        vecs1 = embed_many(texts)

        self.assertEqual(len(vecs1), 3)
        self.assertEqual(vecs1[0], vecs1[2])

        stats_first = get_cache_stats()
        # "chunk alpha" hits on index 2, "chunk alpha" (index 0) & "chunk beta" (index 1) are misses
        self.assertEqual(stats_first["hits"], 1)
        self.assertEqual(stats_first["misses"], 2)

        # Call again with same texts
        vecs2 = embed_many(texts)
        stats_second = get_cache_stats()
        self.assertEqual(stats_second["hits"], 4)  # 1 from first run + 3 from second run
        self.assertEqual(stats_second["misses"], 2)
        self.assertEqual(vecs1, vecs2)

    @patch("google.generativeai.embed_content")
    @patch("google.generativeai.configure")
    def test_gemini_api_called_only_for_cache_misses(self, mock_config, mock_embed):
        mock_embed.return_value = {"embedding": [[0.1] * 384]}

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_test_key"}):
            # First call for "unique question"
            embed_one("unique question")
            self.assertEqual(mock_embed.call_count, 1)

            # Second call for "unique question" -> should hit cache, API call count remains 1
            embed_one("unique question")
            self.assertEqual(mock_embed.call_count, 1)

            # Call for a new question -> API call count becomes 2
            embed_one("another question")
            self.assertEqual(mock_embed.call_count, 2)


if __name__ == "__main__":
    unittest.main()
