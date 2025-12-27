# TrueNCOA Integration Plan

## Executive Summary

TrueNCOA is a National Change of Address (NCOA) service that helps nonprofits maintain accurate donor mailing addresses. This integration will reduce returned mail by up to 90%, saving postage costs and improving donation rates.

## Value Proposition

- **$20 flat per file** - no size limits, no recurring fees
- **Free developer API** at `api.truencoa.com`
- **CASS/DPV standardization** - USPS-compliant addresses
- **48-month move tracking** - catches older address changes
- **~90% reduction in returned mail**

## Integration Points

### 1. Batch Research Pre-Processing (Primary)

**When:** Before running batch prospect research
**Why:** Validate addresses to ensure research uses correct locations

```typescript
// Flow: User uploads CSV → TrueNCOA validates → Batch research runs
async function preprocessBatchWithNCOA(prospects: Prospect[]): Promise<Prospect[]> {
  const addresses = prospects.map(p => ({
    name: p.name,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip
  }));

  const validated = await truencoaValidate(addresses);

  return prospects.map((p, i) => ({
    ...p,
    address: validated[i].correctedAddress || p.address,
    city: validated[i].correctedCity || p.city,
    state: validated[i].correctedState || p.state,
    zip: validated[i].correctedZip || p.zip,
    ncoa_status: validated[i].status, // 'valid', 'moved', 'vacant', 'invalid'
    ncoa_new_address: validated[i].newAddress, // If moved
  }));
}
```

### 2. CRM Sync Post-Processing (Secondary)

**When:** After syncing constituents from CRM
**Why:** Flag outdated addresses for the nonprofit to update in their CRM

```typescript
// Flow: CRM sync completes → TrueNCOA validates → UI shows address issues
async function flagOutdatedAddresses(constituents: Constituent[]): Promise<AddressReport> {
  const needsUpdate = await truencoaValidate(constituents);
  return {
    totalChecked: constituents.length,
    validAddresses: needsUpdate.filter(a => a.status === 'valid').length,
    movedAddresses: needsUpdate.filter(a => a.status === 'moved'),
    vacantAddresses: needsUpdate.filter(a => a.status === 'vacant'),
    invalidAddresses: needsUpdate.filter(a => a.status === 'invalid'),
  };
}
```

## API Integration

### TrueNCOA API Overview

**Base URL:** `https://api.truencoa.com`

**Authentication:** API Key (free to obtain)

**Rate Limits:** None documented, but recommended 1 request/second

### Key Endpoints

#### 1. Create Processing File

```typescript
POST /files/
Content-Type: application/json

{
  "file_name": "batch_research_123.csv",
  "notification_email": "user@example.com",
  "processing_options": {
    "ncoa_processing": true,
    "cass_processing": true,
    "residential_delivery_indicator": true
  }
}

// Response
{
  "file_id": "abc123",
  "upload_url": "https://api.truencoa.com/files/abc123/upload"
}
```

#### 2. Upload Records

```typescript
POST /files/{file_id}/upload
Content-Type: text/csv

name,address,city,state,zip
John Smith,123 Main St,Boston,MA,02101
Jane Doe,456 Oak Ave,Cambridge,MA,02138
```

#### 3. Start Processing

```typescript
POST /files/{file_id}/process

// Response
{
  "status": "processing",
  "estimated_completion": "2024-01-15T10:30:00Z"
}
```

#### 4. Check Status / Get Results

```typescript
GET /files/{file_id}

// Response (when complete)
{
  "status": "complete",
  "results_url": "https://api.truencoa.com/files/abc123/results.csv",
  "summary": {
    "total_records": 100,
    "valid": 85,
    "moved": 10,
    "vacant": 3,
    "invalid": 2
  }
}
```

## Implementation Architecture

### File Structure

```
/lib/truencoa/
  ├── client.ts        # API client with retry logic
  ├── types.ts         # TypeScript types
  ├── config.ts        # Configuration
  ├── mappers.ts       # Data transformation
  └── index.ts         # Barrel export

/app/api/truencoa/
  ├── validate/route.ts      # Validate addresses
  ├── status/[fileId]/route.ts # Check processing status
  └── results/[fileId]/route.ts # Get results
```

### TrueNCOA Client Implementation

```typescript
// /lib/truencoa/client.ts

import { TrueNCOAConfig, AddressRecord, ValidationResult } from './types';

const TRUENCOA_BASE_URL = 'https://api.truencoa.com';

export class TrueNCOAClient {
  private apiKey: string;
  private timeout: number = 30000;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async validateAddresses(addresses: AddressRecord[]): Promise<ValidationResult[]> {
    // Step 1: Create file
    const file = await this.createFile();

    // Step 2: Upload records as CSV
    await this.uploadRecords(file.file_id, addresses);

    // Step 3: Start processing
    await this.startProcessing(file.file_id);

    // Step 4: Poll for completion (with timeout)
    const results = await this.pollForResults(file.file_id);

    return results;
  }

  private async createFile(): Promise<{ file_id: string }> {
    const response = await fetch(`${TRUENCOA_BASE_URL}/files/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_name: `batch_${Date.now()}.csv`,
        processing_options: {
          ncoa_processing: true,
          cass_processing: true,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`TrueNCOA API error: ${response.statusText}`);
    }

    return response.json();
  }

  private async pollForResults(fileId: string, maxWaitMs: number = 300000): Promise<ValidationResult[]> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getStatus(fileId);

      if (status.status === 'complete') {
        return this.downloadResults(status.results_url);
      }

      if (status.status === 'error') {
        throw new Error(`TrueNCOA processing error: ${status.error_message}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('TrueNCOA processing timed out');
  }
}
```

### Types

```typescript
// /lib/truencoa/types.ts

export interface AddressRecord {
  name: string;
  address: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface ValidationResult {
  originalAddress: AddressRecord;
  correctedAddress?: AddressRecord;
  status: 'valid' | 'moved' | 'vacant' | 'invalid' | 'unknown';
  ncoaCode?: string;
  moveDate?: string;
  newAddress?: AddressRecord;
  deliverability: 'deliverable' | 'undeliverable' | 'unknown';
  confidence: number; // 0-100
}

export interface TrueNCOAFile {
  file_id: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  results_url?: string;
  error_message?: string;
  summary?: {
    total_records: number;
    valid: number;
    moved: number;
    vacant: number;
    invalid: number;
  };
}
```

## UI Integration

### Batch Upload Flow (Enhanced)

```
1. User uploads CSV
2. [NEW] Option: "Validate addresses with NCOA" (checkbox, default: on)
3. Column mapping dialog
4. [NEW] If NCOA enabled: Show "Validating addresses..." with progress
5. [NEW] Show address validation summary:
   - ✅ 85 valid addresses
   - 📦 10 addresses have moved (new addresses found)
   - ⚠️ 3 vacant addresses
   - ❌ 2 invalid addresses
6. User reviews and confirms
7. Batch research proceeds with corrected addresses
```

### Settings Integration

```typescript
// Add to Settings > Integrations

{
  provider: 'truencoa',
  name: 'TrueNCOA Address Validation',
  description: 'Validate and update donor addresses using USPS National Change of Address data',
  icon: 'MapPin',
  fields: [
    { name: 'apiKey', type: 'password', label: 'API Key' }
  ],
  pricing: '$20 per file (no size limits)',
  getApiKeyUrl: 'https://truencoa.com/api-signup'
}
```

## Database Changes

### New Table: `address_validation_jobs`

```sql
CREATE TABLE address_validation_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  truencoa_file_id text NOT NULL,
  batch_job_id uuid REFERENCES batch_prospect_jobs(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'error')),
  total_records integer DEFAULT 0,
  valid_count integer DEFAULT 0,
  moved_count integer DEFAULT 0,
  vacant_count integer DEFAULT 0,
  invalid_count integer DEFAULT 0,
  results_json jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- RLS Policy
ALTER TABLE address_validation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own validation jobs"
  ON address_validation_jobs FOR SELECT
  USING (auth.uid() = user_id);
```

## Security Considerations

1. **API Key Storage:** Encrypt using existing `/lib/encryption.ts` patterns
2. **Data Handling:** Address data is PII - ensure proper handling
3. **Rate Limiting:** Implement user-level rate limits (1 validation per 5 minutes)
4. **Cost Control:** Track usage per user to prevent abuse

## Implementation Phases

### Phase 1: Core Integration (2-3 days)
- [ ] Create `/lib/truencoa/` module
- [ ] Implement TrueNCOAClient with retry logic
- [ ] Add API routes for validation
- [ ] Add to Settings > Integrations

### Phase 2: Batch Research Integration (1-2 days)
- [ ] Add NCOA checkbox to batch upload
- [ ] Show validation summary before research
- [ ] Pass corrected addresses to research pipeline
- [ ] Store validation results with batch job

### Phase 3: CRM Integration (1 day)
- [ ] Optional post-sync address validation
- [ ] Address change report generation
- [ ] Export address updates for CRM import

## Cost Analysis

| Usage | Cost |
|-------|------|
| 100 addresses | $20 |
| 1,000 addresses | $20 |
| 10,000 addresses | $20 |
| 100,000 addresses | $20 |

**Comparison to competitors:**
- Direct Mail vendors: $0.02-0.05 per address
- For 1,000 addresses: $20-50
- TrueNCOA at $20 flat is highly competitive

## Success Metrics

1. **Returned mail reduction:** Target 80%+ reduction
2. **Address match rate:** Target 95%+ deliverable
3. **User adoption:** Track % of batch jobs using NCOA
4. **Processing time:** Target < 5 minutes for files < 1,000 addresses

## References

- TrueNCOA API Docs: https://api.truencoa.com/docs
- TrueNCOA Pricing: https://truencoa.com/pricing
- NCOA Processing Overview: https://truencoa.com/ncoa-processing
