-- Migration: Add soft delete support for user accounts
-- Run this in Supabase SQL Editor to add soft delete functionality

-- Add deleted_at column to profiles table if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create an index on deleted_at for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);

-- Optional: Create a view for active (non-deleted) users
CREATE OR REPLACE VIEW public.active_profiles AS
SELECT * FROM public.profiles
WHERE deleted_at IS NULL;

-- Comments for documentation
COMMENT ON COLUMN public.profiles.deleted_at IS 'Timestamp when the user account was soft-deleted. NULL means active account.';
