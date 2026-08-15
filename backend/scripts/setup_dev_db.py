"""Dev Database Utility Script.

Use this script to verify connection to your Dev Supabase instance, verify
schema requirements, or seed initial test data.

Usage:
    APP_ENV=development python scripts/setup_dev_db.py --check
    APP_ENV=development python scripts/setup_dev_db.py --seed --user-id <USER_UUID>
"""

import argparse
import sys
from pathlib import Path

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import config
from db import get_supabase


def seed_generic_entries_for_user(supabase, user_id: str) -> int:
    """Seed generic wisdom entries for a specified user into Supabase."""
    import seed_data
    from chunker import chunk_text
    from embedder import embed_many

    count = 0
    for item in seed_data.GENERIC_ENTRIES:
        content = item["content"]
        title = item.get("title")
        tags = item.get("tags")

        insert_data = {
            "user_id": user_id,
            "title": title,
            "content": content,
            "source": "generic",
            "group_name": getattr(seed_data, "GENERIC_GROUP", "Generic"),
            "tags": tags,
        }

        entry_resp = supabase.table("entries").insert(insert_data).execute()
        if entry_resp.data:
            entry_id = entry_resp.data[0]["id"]
            chunks = chunk_text(content)
            if chunks:
                embeddings = embed_many(chunks)
                rows = [
                    {
                        "entry_id": entry_id,
                        "user_id": user_id,
                        "content": chunk,
                        "embedding": embedding,
                        "chunk_index": i,
                    }
                    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
                ]
                supabase.table("chunks").insert(rows).execute()
            count += 1
    return count



def check_connection():
    print(f"[*] Environment: {config.APP_ENV}")
    print(f"[*] Checking Supabase connection to: {config.os.environ.get('SUPABASE_URL', 'NOT SET')}")
    try:
        supabase = get_supabase()
        # Query profiles or entries table to verify schema
        res = supabase.table("profiles").select("id").limit(1).execute()
        print(f"[✓] Supabase connection successful! (Response status: OK)")
        return True
    except Exception as e:
        print(f"[✕] Supabase connection failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="WisdomBase Dev Database Utility")
    parser.add_argument("--check", action="store_true", help="Check connection to dev database")
    parser.add_argument("--seed", action="store_true", help="Seed generic entries for a test user")
    parser.add_argument("--user-id", type=str, help="User UUID to seed data for")

    args = parser.parse_args()

    if not args.check and not args.seed:
        parser.print_help()
        sys.exit(1)

    if args.check:
        success = check_connection()
        if not success:
            sys.exit(1)

    if args.seed:
        if not args.user_id:
            print("[✕] Error: --user-id is required when seeding data.")
            sys.exit(1)
        supabase = get_supabase()
        print(f"[*] Seeding generic entries for user {args.user_id} in {config.APP_ENV} environment...")
        count = seed_generic_entries_for_user(supabase, args.user_id)
        print(f"[✓] Successfully seeded {count} entries.")


if __name__ == "__main__":
    main()
