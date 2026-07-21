import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from embedder import embed_many, embed_one


class EmbeddingFallbackTests(unittest.TestCase):
    def test_embed_one_works_without_sentence_transformers(self):
        with patch.dict(sys.modules, {"sentence_transformers": None}):
            vec = embed_one("hello world")

        self.assertEqual(len(vec), 384)
        self.assertTrue(all(isinstance(x, float) for x in vec))
        self.assertTrue(all(-1.0 <= x <= 1.0 for x in vec))

    def test_embed_many_returns_one_vector_per_input(self):
        vecs = embed_many(["one", "two", "three"])
        self.assertEqual(len(vecs), 3)
        self.assertEqual(len(vecs[0]), 384)


if __name__ == "__main__":
    unittest.main()
