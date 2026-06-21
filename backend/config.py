"""Backend settings.

Project-wide configuration knobs live here. Edit the defaults below to change
behaviour, or override any of them with an environment variable of the same name
(handy for per-deployment tweaks on Railway without a code change).
"""

import os

from dotenv import load_dotenv

load_dotenv()


# How many questions each user may ask for FREE, answered with the shared backend
# Anthropic key, before they must add their own provider key in Settings. This is
# the "X" free questions per user. Change it here (or set FREE_QUESTION_LIMIT in
# the environment) to raise or lower the allowance.
FREE_QUESTION_LIMIT = int(os.environ.get("FREE_QUESTION_LIMIT", "20"))

# The shared Anthropic key used to answer those free questions, common to all
# users. Stored in the backend .env as ANTHROPIC_API_KEY (never sent to clients).
SHARED_ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
