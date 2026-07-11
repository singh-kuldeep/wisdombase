import os
import sys

# Ensure the backend root is on the Python path so `main.py` can be imported.
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

from main import app
