# 📦 Storage Bucket Setup Guide

This guide will help you set up the Supabase storage bucket for file uploads.

## ⚡ Quick Setup (Recommended)

### Step 1: Run the SQL Migration

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `migrations/002_storage_policies.sql`
5. Paste it into the SQL editor
6. Click **Run** or press `Cmd/Ctrl + Enter`

✅ This will:
- Create the `chat-attachments` bucket (or update if exists)
- Set proper file size limits (10MB)
- Configure allowed file types
- Set up Row Level Security (RLS) policies
- Enable public read access for file URLs

### Step 2: Verify Bucket Setup

1. Go to **Storage** in your Supabase dashboard
2. You should see a bucket named `chat-attachments`
3. Click on it to verify it's set to **Public**
4. Check that policies are active under the **Policies** tab

## 📋 Manual Setup (Alternative)

If you prefer to set up manually through the UI:

### 1. Create the Bucket

1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**
3. Name it: `chat-attachments`
4. Set as **Public bucket**: ✅ Checked
5. File size limit: `10485760` bytes (10MB)
6. Allowed MIME types (optional - add these):
   ```
   image/jpeg
   image/png
   image/gif
   image/webp
   application/pdf
   text/plain
   text/markdown
   application/json
   text/csv
   application/vnd.ms-excel
   application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   ```

### 2. Set Up Storage Policies

Go to **Storage** → **Policies** → **New Policy**

Create these 5 policies:

#### Policy 1: Users can upload their own files
```sql
-- Name: Users can upload their own files
-- Operation: INSERT
-- Target roles: authenticated

WITH CHECK (
  bucket_id = 'chat-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
```

#### Policy 2: Users can view their own files
```sql
-- Name: Users can view their own files
-- Operation: SELECT
-- Target roles: authenticated

USING (
  bucket_id = 'chat-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
```

#### Policy 3: Users can update their own files
```sql
-- Name: Users can update their own files
-- Operation: UPDATE
-- Target roles: authenticated

USING (
  bucket_id = 'chat-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'chat-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
```

#### Policy 4: Users can delete their own files
```sql
-- Name: Users can delete their own files
-- Operation: DELETE
-- Target roles: authenticated

USING (
  bucket_id = 'chat-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
```

#### Policy 5: Public can view all files
```sql
-- Name: Public can view all files
-- Operation: SELECT
-- Target roles: public

USING (bucket_id = 'chat-attachments')
```

## 🔍 Troubleshooting

### Error: "new row violates row-level security policy"

**Cause:** RLS policies aren't set up correctly or user isn't authenticated.

**Fix:**
1. Run the SQL migration: `migrations/002_storage_policies.sql`
2. Verify user is signed in (not guest mode)
3. Check that policies exist in Storage → Policies

### Error: "400 Bad Request" when accessing files

**Cause:** Bucket isn't set to public or policies block public access.

**Fix:**
1. Go to Storage → chat-attachments
2. Click the bucket settings (three dots)
3. Ensure "Public bucket" is checked
4. Verify the "Public can view all files" policy exists

### Files upload but don't display

**Cause:** Public URL access is blocked.

**Fix:**
1. Ensure bucket is public
2. Check that the "Public can view all files" policy exists
3. Clear your browser cache

## 🗂️ File Organization

Files are organized by user ID for security and organization:

```
chat-attachments/
├── {user-id-1}/
│   ├── 1234567890-abc123.pdf
│   ├── 1234567891-def456.png
│   └── 1234567892-ghi789.txt
├── {user-id-2}/
│   ├── 1234567893-jkl012.jpg
│   └── 1234567894-mno345.json
```

Each file is named: `{timestamp}-{random}.{extension}`

## ✅ Testing Upload

1. Sign in to your app (file upload requires authentication)
2. Click the paperclip icon in the chat input
3. Select a file (PDF, image, or text file)
4. Send a message with the file attached
5. The file should appear in your message
6. Click on it to open/download

## 📊 Supported File Types

- **Images:** JPG, PNG, GIF, WebP
- **Documents:** PDF
- **Text:** TXT, MD, JSON, CSV
- **Spreadsheets:** XLS, XLSX

**Size limit:** 10MB per file
**Daily limit:** 5 files per authenticated user

## 🔐 Security Notes

- ✅ Users can only upload to their own folder
- ✅ Users can only modify/delete their own files
- ✅ All uploaded files are publicly readable (for sharing)
- ✅ File type and size validation on both client and server
- ✅ RLS policies prevent unauthorized access

## 🚀 Production Checklist

Before going to production:

- [ ] Run `migrations/002_storage_policies.sql`
- [ ] Verify bucket is public
- [ ] Test file upload with signed-in user
- [ ] Test file access via public URL
- [ ] Verify RLS policies are active
- [ ] Check storage usage in Supabase dashboard
- [ ] Set up storage size alerts (if needed)

---

**Need help?** Check the Supabase Storage docs: https://supabase.com/docs/guides/storage
