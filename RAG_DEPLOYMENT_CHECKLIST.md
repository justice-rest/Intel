# RAG System - Deployment Checklist

## 🎯 Pre-Deployment Setup

### 1. Database Migration ⚠️ CRITICAL
- [ ] Open Supabase Dashboard
- [ ] Go to SQL Editor
- [ ] Copy contents of `migrations/004_add_rag_tables.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify success message (no errors)
- [ ] Check that tables exist: `rag_documents`, `rag_document_chunks`
- [ ] Verify pgvector extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'vector';`

### 2. Storage Bucket Creation ⚠️ CRITICAL
- [ ] Go to Supabase Dashboard → Storage
- [ ] Click "New bucket"
- [ ] Name: `rag-documents`
- [ ] Privacy: **Private** (important!)
- [ ] Click "Create bucket"
- [ ] Verify bucket appears in list

### 3. Storage Bucket Policies
Add these RLS policies to the `rag-documents` bucket:

**Policy 1: Allow authenticated users to upload**
```sql
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rag-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**Policy 2: Allow users to read their own files**
```sql
CREATE POLICY "Users can read their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'rag-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**Policy 3: Allow users to delete their own files**
```sql
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rag-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 4. Environment Variables ⚠️ CRITICAL
Ensure these are set in `.env.local` (development) and Vercel/hosting (production):

```bash
# OpenRouter (REQUIRED for embeddings)
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGxxxxx
SUPABASE_SERVICE_ROLE=eyJhbGxxxxx

# Already set (verify)
CSRF_SECRET=xxxxx
ENCRYPTION_KEY=xxxxx
```

---

## 🔍 Pre-Flight Testing

### Build & Type Check
```bash
# Check for TypeScript errors
npm run type-check

# Test production build
npm run build

# If build succeeds, start production server locally
npm start
```

### Expected Output
- ✅ No TypeScript errors
- ✅ Build completes successfully
- ✅ Server starts without errors

---

## 🧪 Testing Procedure

### Test 1: Settings Data Tab Access

**For Scale Users:**
1. [ ] Sign in as Scale plan user
2. [ ] Open Settings (click settings icon)
3. [ ] Verify "Data" tab appears between "Appearance" and "Subscription"
4. [ ] Click "Data" tab
5. [ ] Verify upload area is visible and interactive
6. [ ] Verify storage stats show: "0/50 • 0B/500MB"

**For Growth/Pro Users:**
1. [ ] Sign in as Growth or Pro plan user (or sign out)
2. [ ] Open Settings → Data tab
3. [ ] Verify upload area is greyed out
4. [ ] Click on greyed upload area
5. [ ] Verify popover appears with "Scale Plan Required 🚀"
6. [ ] Click "Upgrade to Scale" button
7. [ ] Verify redirect to /subscription page

### Test 2: Document Upload

**Preparation:**
- Download a test PDF with readable text content
- Recommended: Use a short document (5-10 pages) for faster testing

**Steps:**
1. [ ] Go to Settings → Data tab (as Scale user)
2. [ ] Drag-and-drop the PDF file into upload area
3. [ ] Verify file preview appears with name and size
4. [ ] (Optional) Add tags: "test, annual-report, 2024"
5. [ ] Click "Upload Document" button
6. [ ] Verify progress bar appears
7. [ ] Wait for processing (30-60 seconds)
8. [ ] Verify document appears in list below
9. [ ] Verify status badge shows "Ready" (green with checkmark)
10. [ ] Verify document shows: page count, word count, upload time
11. [ ] Verify storage stats updated: "1/50 • XMB/500MB"

**Expected Processing Time:**
- 5-page PDF: ~10-20 seconds
- 50-page PDF: ~30-60 seconds
- 100-page PDF: ~60-90 seconds

### Test 3: Document Management

1. [ ] Search for document by name
2. [ ] Verify search filters the list correctly
3. [ ] Click the three-dot menu (⋯) on a document
4. [ ] Click "Download"
5. [ ] Verify PDF downloads or opens in new tab
6. [ ] Click three-dot menu again
7. [ ] Click "Delete"
8. [ ] Verify confirmation dialog appears
9. [ ] Confirm deletion
10. [ ] Verify document removed from list
11. [ ] Verify storage stats updated

### Test 4: RAG Search in Chat

**Preparation:**
- Upload a document with specific, unique content
- Example: A fake annual report mentioning "Acme Foundation donated $50,000 in 2024"

**Steps:**
1. [ ] Go to main chat page
2. [ ] Start a new conversation
3. [ ] Ask a question related to your document content
   - Example: "What was Acme Foundation's donation amount in 2024?"
4. [ ] Wait for AI response
5. [ ] Verify AI mentions information from your document
6. [ ] Verify citation box appears below AI response
7. [ ] Verify citation box shows:
   - "Sources from your documents"
   - Document name
   - Page number
   - Similarity percentage
   - Snippet from the document
8. [ ] Click to expand citation box
9. [ ] Verify multiple citations (if available)
10. [ ] (Optional) Click "View Document" button
    - Note: This will show a toast "Preview feature coming soon" (placeholder)

**What Should Happen:**
- AI automatically searches your documents (no manual toggle)
- AI uses information from your PDFs in the response
- Citations appear showing which documents were used
- Similarity scores show how relevant each passage was

### Test 5: Multiple Documents

1. [ ] Upload 2-3 different PDFs on different topics
2. [ ] Wait for all to process (status: ready)
3. [ ] Ask a question that could relate to one specific document
4. [ ] Verify AI searches and finds the correct document
5. [ ] Verify citations only show relevant document(s)
6. [ ] Ask a broad question that could relate to multiple documents
7. [ ] Verify citations from multiple documents appear

### Test 6: Rate Limits

**Document Count Limit:**
1. [ ] Upload 5 test documents
2. [ ] Go to Settings → Data
3. [ ] Verify stats show "5/50"
4. [ ] Upload more documents until reaching 50
5. [ ] Try to upload 51st document
6. [ ] Verify error: "Document limit reached (50 max)"

**Daily Upload Limit:**
1. [ ] Upload 10 documents in one day
2. [ ] Try to upload 11th document
3. [ ] Verify error: "Daily upload limit reached (10/day)"
4. [ ] Wait until next day (UTC midnight)
5. [ ] Verify can upload again

**Storage Limit:**
1. [ ] Upload large PDFs totaling ~500MB
2. [ ] Try to upload another large file
3. [ ] Verify error about storage limit

---

## ✅ Verification Checklist

### Database Verification
```sql
-- Check documents table
SELECT * FROM rag_documents LIMIT 5;

-- Check chunks table
SELECT id, document_id, chunk_index, page_number, token_count
FROM rag_document_chunks LIMIT 5;

-- Check storage usage
SELECT * FROM get_rag_storage_usage('your-user-id-here');

-- Test vector search (replace with actual embedding)
SELECT * FROM search_rag_chunks(
  ARRAY[...]::vector(3072),  -- sample embedding
  'your-user-id-here',
  5,
  0.7,
  NULL
);
```

### API Endpoint Verification

**Upload:**
```bash
curl -X POST http://localhost:3000/api/rag/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test.pdf" \
  -F "tags=test,sample"
```

**List Documents:**
```bash
curl http://localhost:3000/api/rag/documents
```

**Search:**
```bash
curl -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test query"}'
```

---

## 🐛 Troubleshooting

### Issue: Migration fails
**Error**: `constraint "rag_documents_user_id_fkey" already exists`
**Solution**: Use the updated migration file (constraints added with `IF NOT EXISTS`)

### Issue: Upload fails immediately
**Possible causes:**
1. Check `OPENROUTER_API_KEY` is set
2. Check Supabase storage bucket `rag-documents` exists
3. Check bucket RLS policies are configured
4. Check file is actually a PDF
5. Check file size < 50MB

### Issue: Processing stuck at "processing" status
**Possible causes:**
1. Check server logs for errors
2. Verify OpenRouter API key is valid
3. Check if rate limited by OpenRouter
4. Try with a smaller PDF first

### Issue: No citations appear in chat
**Possible causes:**
1. Check document status is "ready" (not "processing" or "failed")
2. Ask question more directly related to document content
3. Check RAG tool is enabled in chat API (should be automatic)
4. Check experimental_toolContext includes userId
5. Look for rag_search tool in message parts

### Issue: Citations show but empty
**Check:**
1. Message parts structure in browser DevTools
2. getCitations() function is extracting correctly
3. Tool invocation result has success=true
4. Results array is populated

---

## 📊 Success Criteria

Your RAG system is working correctly if:

✅ Documents upload successfully
✅ Status changes: uploading → processing → ready
✅ Documents appear in list with metadata
✅ Storage stats update correctly
✅ Search finds relevant documents
✅ AI uses document content in responses
✅ Citations appear with document name, page, snippet
✅ Growth/Pro users see upgrade popover
✅ Scale users have full access
✅ Rate limits enforce correctly
✅ Documents can be downloaded and deleted

---

## 🚀 Deployment to Production

### Vercel Deployment

1. [ ] Push code to GitHub
2. [ ] Go to Vercel Dashboard
3. [ ] Redeploy project (automatic if connected to GitHub)
4. [ ] Go to Settings → Environment Variables
5. [ ] Add `OPENROUTER_API_KEY` if not already set
6. [ ] Verify Supabase variables are set
7. [ ] Trigger new deployment
8. [ ] Wait for build to complete
9. [ ] Test on production URL

### Post-Deployment Verification

1. [ ] Visit production site
2. [ ] Sign in as Scale user
3. [ ] Upload a test document
4. [ ] Wait for processing
5. [ ] Test RAG search in chat
6. [ ] Verify citations appear
7. [ ] Test on mobile device
8. [ ] Test Growth/Pro plan gating

---

## 📈 Monitoring

### Key Metrics to Watch

1. **Upload Success Rate**
   - Target: >95%
   - Track failed uploads and error messages

2. **Processing Time**
   - 10-page PDF: <20 seconds
   - 50-page PDF: <60 seconds
   - 100-page PDF: <90 seconds

3. **Search Quality**
   - Citations should be relevant to user queries
   - Similarity scores typically 70-95%

4. **Storage Usage**
   - Monitor per-user storage
   - Alert if approaching 500MB limit

5. **API Costs**
   - Track OpenRouter embeddings API usage
   - Estimated: $0.75 per 50 documents uploaded

### Error Monitoring

Watch for these errors in logs:
- `Failed to upload file`
- `PDF processing failed`
- `Failed to generate embeddings`
- `Vector search failed`
- `Scale plan required`

---

## 🎉 You're Done!

If all tests pass, your RAG system is fully operational!

Users can now:
- Upload their PDFs to your app
- AI automatically searches their documents when relevant
- Get answers with citations showing exact sources

**Next Steps:**
- Monitor usage and gather user feedback
- Consider adding document preview modal
- Implement additional file types (future)
- Add PostHog analytics events

**Questions or Issues?**
- Check the troubleshooting section above
- Review `RAG_IMPLEMENTATION_SUMMARY.md` for architecture details
- Check server logs for detailed error messages
