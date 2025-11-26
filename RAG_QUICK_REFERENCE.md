# RAG System - Quick Reference

## 🚀 Quick Start (3 Steps)

### 1. Run Migration
```bash
# In Supabase SQL Editor
# Paste and run: migrations/004_add_rag_tables.sql
```

### 2. Create Storage Bucket
```bash
# In Supabase Dashboard → Storage
# Create bucket: "rag-documents" (Private)
```

### 3. Set Environment Variable
```bash
# Add to .env.local
OPENROUTER_API_KEY=your_key_here
```

---

## 📂 File Structure

```
/migrations/
  └── 004_add_rag_tables.sql        # Database schema

/lib/rag/
  ├── types.ts                       # TypeScript types
  ├── config.ts                      # Configuration
  ├── pdf-processor.ts               # PDF extraction
  ├── chunker.ts                     # Text chunking
  ├── embeddings.ts                  # Gemini embeddings
  ├── search.ts                      # Vector search
  └── index.ts                       # Exports

/app/api/rag/
  ├── upload/route.ts                # Upload & process
  ├── documents/route.ts             # CRUD operations
  ├── search/route.ts                # Search endpoint
  └── download/[id]/route.ts         # Download signed URL

/app/components/layout/settings/data/
  ├── data-section.tsx               # Main UI
  ├── document-upload.tsx            # Upload widget
  ├── document-list.tsx              # Document table
  └── upgrade-prompt.tsx             # Plan gate

/lib/tools/
  └── rag-search.ts                  # AI search tool

/app/components/chat/
  ├── citation-sources.tsx           # Citation UI
  └── get-citations.ts               # Extract citations
```

---

## 🔑 Key Configuration

```typescript
// Rate Limits (Scale Plan)
RAG_DOCUMENT_LIMIT = 50              // Max documents
RAG_STORAGE_LIMIT = 500MB            // Total storage
RAG_DAILY_UPLOAD_LIMIT = 10          // Per day
RAG_MAX_FILE_SIZE = 50MB             // Per file

// Processing
RAG_CHUNK_SIZE = 500                 // Tokens per chunk
RAG_CHUNK_OVERLAP = 75               // Token overlap

// Search
RAG_MAX_RESULTS = 5                  // Chunks returned
RAG_SIMILARITY_THRESHOLD = 0.7       // Min similarity
```

---

## 🗄️ Database Tables

```sql
-- Documents metadata
rag_documents (
  id, user_id, file_name, file_url,
  file_size, file_type, page_count,
  word_count, language, tags[],
  status, error_message,
  created_at, processed_at
)

-- Document chunks with embeddings
rag_document_chunks (
  id, document_id, user_id,
  chunk_index, content, page_number,
  embedding vector(3072),
  token_count, created_at
)

-- Functions
search_rag_chunks(embedding, user_id, count, threshold, doc_ids)
get_rag_storage_usage(user_id)
```

---

## 🔄 Processing Flow

```
Upload PDF
  ↓
Store in Supabase Storage
  ↓
Extract text (pdf-parse)
  ↓
Chunk text (500 tokens, 75 overlap)
  ↓
Generate embeddings (Gemini via OpenRouter)
  ↓
Store chunks + embeddings
  ↓
Status: ready
```

---

## 💬 Chat Integration

### How RAG Works
1. User sends message
2. AI detects if documents would help
3. AI calls `rag_search` tool automatically
4. Tool searches user's documents
5. Returns relevant chunks
6. AI uses chunks in response
7. Citations displayed in chat

### RAG Tool Definition
```typescript
{
  name: "rag_search",
  description: "Search user's uploaded documents",
  parameters: {
    query: string,        // Search query
    documentIds?: string[] // Optional filter
  }
}
```

---

## 🎯 API Endpoints

### Upload Document
```bash
POST /api/rag/upload
Content-Type: multipart/form-data
Body: file, tags

Response: { document, chunks_created, message }
```

### List Documents
```bash
GET /api/rag/documents?q=search_term

Response: { documents[], usage }
```

### Delete Document
```bash
DELETE /api/rag/documents?id=doc_id

Response: { message }
```

### Update Tags
```bash
PATCH /api/rag/documents
Body: { documentId, tags[] }

Response: { message }
```

### Search Documents
```bash
POST /api/rag/search
Body: { query, documentIds?, maxResults?, similarityThreshold? }

Response: { results[], query, resultsCount }
```

### Download Document
```bash
GET /api/rag/download/[id]

Response: { url, fileName, expiresIn }
```

---

## 🧪 Testing Commands

```bash
# Type check
npm run type-check

# Build
npm run build

# Start production
npm start

# Run in development
npm run dev
```

---

## 🔍 Debugging

### Check Document Status
```sql
SELECT id, file_name, status, error_message
FROM rag_documents
WHERE user_id = 'user-id-here'
ORDER BY created_at DESC;
```

### Check Chunks
```sql
SELECT d.file_name, COUNT(c.id) as chunk_count
FROM rag_documents d
LEFT JOIN rag_document_chunks c ON d.id = c.document_id
WHERE d.user_id = 'user-id-here'
GROUP BY d.file_name;
```

### Check Storage Usage
```sql
SELECT * FROM get_rag_storage_usage('user-id-here');
```

### Test Vector Search
```sql
-- Get sample embedding first
SELECT embedding FROM rag_document_chunks LIMIT 1;

-- Then search
SELECT * FROM search_rag_chunks(
  ARRAY[...]::vector(3072),
  'user-id-here',
  5,
  0.7,
  NULL
);
```

---

## ⚠️ Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "OpenRouter API key not configured" | Missing env var | Set `OPENROUTER_API_KEY` |
| "Scale plan required" | User not on Scale | Upgrade user or test with Scale account |
| "Document limit reached" | 50 docs uploaded | Delete some documents |
| "Storage limit exceeded" | >500MB used | Delete large documents |
| "Daily upload limit reached" | 10 uploads today | Wait until next day (UTC) |
| "Only PDF files are supported" | Wrong file type | Use PDF files only |
| "File too large" | File >50MB | Use smaller file |
| "No text content found" | Image-only PDF | Use PDF with text |

---

## 📊 Expected Performance

| Metric | Target |
|--------|--------|
| 5-page PDF upload | 10-20 seconds |
| 50-page PDF upload | 30-60 seconds |
| 100-page PDF upload | 60-90 seconds |
| Vector search latency | <100ms |
| Citation extraction | <50ms |
| Upload success rate | >95% |

---

## 🎨 UI Components Used

- `motion/react` - Animations
- `@phosphor-icons/react` - Icons
- `shadcn/ui` - UI components
- Follows existing app patterns

---

## 💰 Cost Per User (Scale)

- **Embedding**: ~$0.75 one-time (50 docs)
- **Storage**: <$0.01/month
- **Search**: Negligible
- **Total**: <$1 lifetime

---

## 📱 User Experience

### For Scale Users
- Full access to Data tab
- Upload documents
- Search and manage documents
- AI automatically uses documents
- See citations in chat

### For Growth/Pro Users
- See "Data" tab (greyed out)
- Click shows upgrade popover
- "Upgrade to Scale" button
- Redirects to subscription page

---

## ✅ Success Indicators

- ✅ Documents upload without errors
- ✅ Status badge shows "Ready" after processing
- ✅ AI uses document content in responses
- ✅ Citations appear with document name + page
- ✅ Storage stats update correctly
- ✅ Growth/Pro users see upgrade prompt
- ✅ Documents can be downloaded/deleted

---

## 🚀 Next Steps After Testing

1. Monitor upload success rate
2. Gather user feedback
3. Add PostHog analytics
4. Consider document preview modal
5. Optimize processing for large PDFs
6. Add support for more file types

---

## 📞 Support

See detailed documentation in:
- `RAG_IMPLEMENTATION_SUMMARY.md` - Full architecture
- `RAG_DEPLOYMENT_CHECKLIST.md` - Testing guide
