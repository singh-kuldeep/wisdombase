# Deployment Checklist - Delete Account Feature

## Pre-Deployment Steps

### 1. Database Migration
- [ ] Open Supabase SQL Editor
- [ ] Run `backend/migrations/001_add_soft_delete.sql`
- [ ] Verify migration success:
  ```sql
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'profiles' AND column_name = 'deleted_at';
  ```
  Expected: Should return one row with `deleted_at` column

### 2. Backend Deployment
- [ ] Deploy updated backend code
- [ ] Verify `/account/delete` endpoint is accessible
- [ ] Check backend logs for any startup errors

### 3. Frontend Deployment
- [ ] Build frontend with latest changes
- [ ] Deploy to production
- [ ] Verify Settings page loads correctly

### 4. Email Configuration (Optional)
If you want to send actual emails:
- [ ] Set `SENDGRID_API_KEY` environment variable (SendGrid)
  OR
- [ ] Set `AWS_REGION` environment variable (AWS SES)
- [ ] Set `FROM_EMAIL` environment variable (default: noreply@wisdombase.com)

Without these, emails will be logged to console (development mode).

## Post-Deployment Testing

### Test 1: Delete Account Flow
1. [ ] Sign in to the app
2. [ ] Navigate to Settings
3. [ ] Scroll to "Danger Zone"
4. [ ] Click "Delete My Account"
5. [ ] Confirm first dialog
6. [ ] Confirm second dialog
7. [ ] Verify redirect to sign-in page
8. [ ] Verify success message appears

### Test 2: Data Deletion Verification
Using Supabase Dashboard:
1. [ ] Check `entries` table - user's entries should be gone
2. [ ] Check `chunks` table - user's chunks should be gone
3. [ ] Check `profiles` table - user's profile should have:
   - `deleted_at`: timestamp (not NULL)
   - `memory_profile`: NULL
   - `display_name`: NULL

### Test 3: Deleted Account Access
1. [ ] Try to sign in with deleted account
2. [ ] Verify API returns 403 Forbidden
3. [ ] Verify message: "This account has been deleted."

### Test 4: Email Confirmation
1. [ ] Check user's email inbox
2. [ ] Verify confirmation email received
3. [ ] Verify email contains:
   - Subject: "Your WisdomBase Account Has Been Deleted"
   - List of deleted data
   - Support contact information

## Rollback Plan

If issues occur:

### Quick Rollback (Disable Feature)
Comment out the auth check temporarily:
```python
# In backend/auth.py, comment out the soft delete check
# Lines 38-47
```

### Full Rollback
1. Deploy previous version of backend
2. Deploy previous version of frontend
3. Optionally remove `deleted_at` column:
   ```sql
   ALTER TABLE public.profiles DROP COLUMN IF EXISTS deleted_at;
   ```

## Monitoring

After deployment, monitor:
- [ ] Backend error logs for exceptions in `/account/delete`
- [ ] Database for soft-deleted accounts (deleted_at IS NOT NULL)
- [ ] Email service logs for delivery failures
- [ ] User support tickets for deletion-related issues

## Success Criteria

✅ Users can successfully delete their accounts
✅ All user data is removed (entries, chunks)
✅ User profile is soft-deleted (deleted_at set)
✅ Deleted users cannot access the API
✅ Confirmation emails are sent
✅ No errors in backend logs
✅ Frontend shows correct confirmation messages

## Support Information

If users report issues:
1. Check backend logs for errors
2. Verify user's `deleted_at` timestamp in profiles table
3. Check email service logs
4. If needed, manually clean up:
   ```sql
   -- View soft-deleted users
   SELECT id, deleted_at FROM profiles WHERE deleted_at IS NOT NULL;
   
   -- Hard delete if needed (admin only)
   DELETE FROM auth.users WHERE id = '<user-id>';
   ```
