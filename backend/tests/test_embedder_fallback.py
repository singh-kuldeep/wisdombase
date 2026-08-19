import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from embedder import embed_many, embed_one


class EmbeddingTests(unittest.TestCase):
    def test_embed_one_works_without_api_key_fallback(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "", "GOOGLE_API_KEY": "", "GOOGLE_GENERATIVE_AI_API_KEY": ""}):
            vec = embed_one("hello world")

        self.assertEqual(len(vec), 384)
        self.assertTrue(all(isinstance(x, float) for x in vec))
        self.assertTrue(all(-1.0 <= x <= 1.0 for x in vec))

    def test_embed_many_returns_one_vector_per_input(self):
        vecs = embed_many(["one", "two", "three"])
        self.assertGreaterEqual(len(vecs), 3)
        self.assertEqual(len(vecs[0]), 384)

    @patch("google.generativeai.embed_content")
    @patch("google.generativeai.configure")
    def test_embed_one_uses_gemini_api_when_key_present(self, mock_config, mock_embed):
        mock_embed.return_value = {"embedding": [0.1] * 384}

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_test_key"}):
            vec = embed_one("hello world")

        self.assertEqual(len(vec), 384)
        mock_config.assert_called_with(api_key="fake_test_key")
        mock_embed.assert_called_once()


if __name__ == "__main__":
    unittest.main()



