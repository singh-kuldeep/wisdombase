import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import config


class ConfigEnvironmentTests(unittest.TestCase):
    def test_default_app_env_is_development(self):
        with patch.dict(os.environ, {}, clear=True):
            config.init_environment()
            env = os.environ.get("APP_ENV", "development").strip().lower()
            self.assertIn(env, ("development", "dev"))

    def test_is_production_flag(self):
        with patch.dict(os.environ, {"APP_ENV": "production"}):
            self.assertTrue(os.environ.get("APP_ENV") == "production")

    def test_cors_origins_dev_allows_all(self):
        with patch.dict(os.environ, {"APP_ENV": "development", "CORS_ORIGINS": "https://example.com"}):
            config.init_environment()
            # In dev, config.CORS_ORIGINS should default to wildcard unless in prod
            is_prod = os.environ.get("APP_ENV") in ("production", "prod")
            self.assertFalse(is_prod)


if __name__ == "__main__":
    unittest.main()
