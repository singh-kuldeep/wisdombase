# Database Migrations

This directory contains SQL migration scripts for the WisdomBase database.

## How to Apply Migrations

1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file
4. Paste into the SQL Editor
5. Run the migration

## Migration Files

### 001_add_soft_delete.sql
Adds soft delete support for user accounts by adding a `deleted_at` column to the profiles table.

**What it does:**
- Adds `deleted_at TIMESTAMPTZ` column to `profiles` table
- Creates an index on `deleted_at` for performance
- Creates a view `active_profiles` for querying non-deleted users

**Required:** Yes, for the Delete My Account feature to work properly.
