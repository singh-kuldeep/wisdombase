import os
import sys
import unittest
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from rag import MATCH_THRESHOLD, RELATIVE_SIMILARITY_CUTOFF, retrieve


class RagRetrievalTests(unittest.TestCase):
    def test_retrieve_filters_unrelated_low_similarity_candidates(self):
        mock_supabase = MagicMock()

        # Simulate match_chunks RPC output:
        # Match 1: relevant entry ("i like to eat mango", similarity 0.78)
        # Match 2 & 3: unrelated entries (career details, similarity 0.30 - below 0.35 threshold & below relative cutoff)
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [
            {"id": "c1", "entry_id": "e1", "content": "i like to eat mango", "similarity": 0.78},
            {"id": "c2", "entry_id": "e2", "content": "I joined zeno health on 2021...", "similarity": 0.30},
            {"id": "c3", "entry_id": "e3", "content": "Suraj jaiswal CV...", "similarity": 0.28},
        ]
        mock_supabase.rpc.return_value = mock_rpc

        mock_table = MagicMock()
        mock_table.select.return_value.in_.return_value.execute.return_value.data = [
            {"id": "e1", "title": "Untitled", "created_at": "2026-08-19T10:00:00Z", "group_name": "Personal"},
        ]
        mock_supabase.table.return_value = mock_table

        results = retrieve(mock_supabase, "user-123", "i like to eat mango")

        # Only entry 1 should be returned; entries 2 and 3 must be filtered out
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["entry_id"], "e1")
        self.assertEqual(results[0]["snippet"], "i like to eat mango")


if __name__ == "__main__":
    unittest.main()
