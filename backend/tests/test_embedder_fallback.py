import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from embedder import _model, embed_many, embed_one


class EmbeddingFallbackTests(unittest.TestCase):
    def setUp(self):
        _model.cache_clear()

    def tearDown(self):
        _model.cache_clear()

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

    def test_embed_one_uses_sentence_transformers_when_available(self):
        mock_st = MagicMock()
        mock_model_instance = MagicMock()
        mock_model_instance.encode.return_value.tolist.return_value = [0.1] * 384
        mock_st.SentenceTransformer.return_value = mock_model_instance

        with patch.dict(sys.modules, {"sentence_transformers": mock_st}):
            vec = embed_one("hello world")

        self.assertEqual(len(vec), 384)
        self.assertEqual(vec[0], 0.1)


if __name__ == "__main__":
    unittest.main()

