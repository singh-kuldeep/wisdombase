# Delete Account Feature Implementation

## Overview
Implemented a comprehensive delete account feature with soft delete for the user in the profiles table and hard delete for all user data.

## Changes Made

### 1. Database Schema Updates

**File: `backend/schema.sql`**
- Added `deleted_at TIMESTAMPTZ DEFAULT NULL` column to `profiles` table
- Added idempotent migration for existing databases

**File: `backend/migrations/001_add_soft_delete.sql` (NEW)**
- Complete migration script for adding soft delete support
- Includes index creation for performance
- Creates `active_profiles` view for non-deleted users

### 2. Backend API Updates

**File: `backend/main.py`**
- Updated `/account/delete` endpoint (lines 560-604)
- **Behavior:**
  - Hard deletes all user entries and chunks (CASCADE)
  - Soft deletes user profile by setting `deleted_at` timestamp
  - Clears sensitive data (memory_profile, display_name)
  - Sends confirmation email to user
  - Returns message: "Your account will be deleted and you will receive a confirmation email. All your data has been permanently removed."

**File: `backend/auth.py`**
- Added soft delete check in `get_current_user_id()` function
- Prevents soft-deleted users from accessing the API
- Returns HTTP 403 with message: "This account has been deleted."

### 3. Frontend Updates

**File: `frontend/app/(app)/settings.tsx`**
- Updated success message (lines 252-258)
- New message: "Your account will be deleted and you will receive a confirmation email. All your data has been permanently removed."
- User is immediately redirected to sign-in page after deletion

**File: `frontend/lib/api.ts`**
- No changes needed (already had `deleteAccount()` function)

### 4. Email Service

**File: `backend/email_service.py`**
- Already implemented with comprehensive HTML and text email templates
- Lists all deleted data:
  - Personal entries and notes
  - Knowledge chunks and embeddings
  - Memory profile
  - Account settings and preferences
  - All associated metadata

## Data Deletion Flow

1. **User clicks "Delete My Account" button** in Settings
   - Shows confirmation dialog
   - Shows final warning dialog

2. **Backend processes deletion** (`POST /account/delete`)
   - Gets user email before deletion
   - Hard deletes all entries (chunks cascade automatically)
   - Soft deletes profile by setting `deleted_at` timestamp
   - Clears sensitive data (memory_profile, display_name)
   - Sends confirmation email

3. **Frontend handles response**
   - Clears local session
   - Redirects to sign-in page
   - Shows success message

4. **Future API requests blocked**
   - Auth middleware checks `deleted_at` column
   - Returns 403 Forbidden for deleted accounts

## What Gets Deleted

### Hard Deleted (Permanent)
- ✅ All user entries
- ✅ All knowledge chunks and embeddings (CASCADE)
- ✅ Memory profile (cleared)
- ✅ Display name (cleared)

### Soft Deleted (Marked as deleted)
- ✅ User profile record (deleted_at timestamp set)
- ✅ User remains in Supabase Auth (can be hard deleted later if needed)

## Migration Steps

### For New Installations
1. Run `backend/schema.sql` in Supabase SQL Editor
   - Includes all necessary columns

### For Existing Databases
1. Run `backend/migrations/001_add_soft_delete.sql` in Supabase SQL Editor
2. Restart backend server

## Testing Checklist

- [ ] User can delete their account from Settings
- [ ] Confirmation dialogs appear (2 levels)
- [ ] User receives confirmation email
- [ ] All user entries are deleted
- [ ] All chunks are deleted
- [ ] Profile is soft-deleted (deleted_at set)
- [ ] User is redirected to sign-in
- [ ] Deleted user cannot sign in/access API (403 Forbidden)
- [ ] Success message displays correctly

## Environment Variables

No new environment variables required. Email service works with:
- `SENDGRID_API_KEY` (optional)
- `AWS_REGION` (optional)
- `FROM_EMAIL` (optional, defaults to noreply@wisdombase.com)
- Falls back to console logging in development

## Security Considerations

1. **Double Confirmation**: User must confirm twice before deletion
2. **Immediate Logout**: Session cleared immediately after deletion
3. **API Protection**: Auth middleware blocks deleted users
4. **Email Notification**: User receives confirmation email
5. **Sensitive Data Cleared**: Memory profile and display name cleared on soft delete
6. **Audit Trail**: deleted_at timestamp preserved for records

## Future Enhancements

Potential additions:
- Admin dashboard to view soft-deleted accounts
- Scheduled job to hard delete soft-deleted accounts after X days
- Account recovery grace period (undo deletion within 30 days)
- Anonymized analytics retention (optional)
