# ILAD Vendor Security Questionnaire Response

**Vendor**: GetRomy LLC
**Date**: January 6, 2026
**Contact**: legal@getromy.app

---

## i. Data Elements Requested

| Data Element | Rationale |
|--------------|-----------|
| **Donor name** | Required for prospect identification, CRM search, and cross-referencing public records (SEC filings, FEC contributions, property records) |
| **Home address** | Used for property wealth screening (real estate valuation lookup) and geographic analysis |
| **Giving record** | Required for giving capacity calculations using industry-standard TFG Research Formulas (GS/EGS/Snapshot) |

### Giving Record Details
- **Lifetime giving**: Primary input for capacity calculations
- **Number of gifts**: Used for engagement scoring and gift pattern analysis
- **Largest gift**: Indicator of major gift capacity (triggers DIF modifiers in Snapshot formula)
- **First gift date**: Donor tenure calculation
- **Most recent gift**: Recency scoring for propensity modeling

**Data Minimization**: We only request data necessary for prospect research. We do not request or store sensitive data such as SSN, bank account numbers, or credit card information.

---

## ii. Security Safeguards

### Encryption

| Data Type | Method | Details |
|-----------|--------|---------|
| Data at Rest | AES-256-GCM | All CRM credentials and API keys encrypted before storage |
| Data in Transit | TLS 1.2+ | HTTPS enforced on all endpoints |
| Database | Supabase (SOC 2 Type II) | AWS infrastructure with encryption at rest |

### Access Control

| Control | Implementation |
|---------|----------------|
| Authentication | Supabase Auth with JWT tokens |
| Session Management | HTTP-only secure cookies with automatic refresh |
| Multi-Tenant Isolation | PostgreSQL Row-Level Security (RLS) policies |
| CSRF Protection | Token-based validation on all mutations |

### Input Protection

| Protection | Method |
|------------|--------|
| XSS Prevention | DOMPurify sanitization on all user input |
| SQL Injection | Parameterized queries via Supabase client |
| File Validation | Magic byte verification + MIME type checking |
| Rate Limiting | Per-user limits on API calls and file uploads |

### Subcontractor Security (Authorized Subprocessors)

| Subprocessor | Purpose | Compliance |
|--------------|---------|------------|
| Supabase Inc. | Database, Auth, Storage | SOC 2 Type II certified |
| OpenRouter Inc. | AI Model Routing | SOC 2 Type II certified |
| Stripe Inc. | Payment Processing | PCI-DSS Level 1 |
| PostHog Inc. | Product Analytics | GDPR compliant, anonymized data only |

All subprocessors are bound by Data Processing Agreements requiring equivalent security controls.

---

## iii. Software Security Policies

### Authentication Policy
- Primary authentication via email/password with secure hashing
- OAuth support for Google Workspace integration
- JWT tokens with automatic expiration and refresh
- Anonymous/guest users isolated with restricted access

### Authorization Policy
- Every API endpoint validates user session
- Database RLS enforces tenant isolation at PostgreSQL level
- Users can only access data associated with their `user_id`
- File storage paths restricted to user-specific directories

### Data Protection Policy
- Sensitive credentials encrypted with AES-256-GCM before storage
- API keys masked in UI (only first 4 + last 4 characters visible)
- No sensitive data in application logs or error messages
- Input sanitization on all user-provided content

### Incident Response
- 72-hour breach notification commitment (per Terms of Service Section 7.3)
- Automated monitoring for suspicious activity
- Secure logging for audit trails

**Reference**: [Terms of Service - Section 7: Data Processing Agreement](https://intel.getromy.app/terms)

---

## iv. Certificate of Insurance

GetRomy LLC maintains the following insurance coverage:

- General Liability Insurance
- Technology Errors & Omissions (E&O) Insurance
- Cyber Security Liability Insurance

**Certificates of insurance are available upon request.** Please contact legal@getromy.app to request current certificates.

---

## v. Data Return and Disposal

### Upon Contract Termination

**Data Return (Export)**
| Aspect | Commitment |
|--------|------------|
| Timeline | Available within **5 business days** of request |
| Formats | JSON, CSV, or other standard formats |
| Scope | All constituent records, donations, and associated data |

**Data Disposal**
| Aspect | Commitment |
|--------|------------|
| Timeline | Completed within **30 days** of termination |
| Method | Cryptographic erasure and physical deletion |
| Verification | Written confirmation provided upon request |
| Subprocessors | Cascade deletion within 24 hours |

### Exceptions
- Anonymized analytics data (no PII) may be retained
- Billing records retained for 7 years per legal requirements
- Data subject to active legal holds

### Technical Implementation
- Database cascade deletes automatically remove all user data when account is deleted
- GDPR deletion module (`/lib/gdpr/deletion.ts`) handles comprehensive data removal
- File storage cleaned via Supabase storage API

**Reference**: [Terms of Service - Section 16.4: Data Return and Disposal Upon Termination](https://intel.getromy.app/terms)

---

## vi. Individuals with Data Access

### Access Model
GetRomy LLC operates a **self-service SaaS platform**. ILAD staff will access their own data directly through authenticated sessions. GetRomy personnel do not have routine access to client data.

### GetRomy LLC Personnel with Potential Access

| Role | Access Level | Rationale |
|------|--------------|-----------|
| **System Administrators** | Database administration | Infrastructure maintenance, security patching, backup verification |
| **On-Call Engineers** | Production debugging | Incident response only, logged and audited |
| **Security Team** | Audit logs only | Security monitoring and compliance verification |

### Access Controls
- All personnel access is logged and auditable
- Access requires multi-factor authentication
- Production database access restricted to named individuals
- No bulk data export capabilities for internal staff

### ILAD User Access
ILAD controls which of their staff members have access to the platform. Each ILAD user will have their own authenticated account with access only to ILAD's data.

---

## vii. Written Assurance

**GetRomy LLC provides the following contractual assurances regarding ILAD's donor data:**

### a) Purpose Limitation
ILAD's donor data will be used **SOLELY** for the purpose of helping ILAD achieve its charitable mission through prospect research and donor intelligence services. Data will not be used for any other purpose.

### b) No Sale of Data
GetRomy LLC will **NEVER** sell, license, rent, or otherwise transfer ILAD's donor data to any third party for any purpose.

### c) No Cross-Client Use
ILAD's donor data will **NEVER** be used to benefit any other client of GetRomy LLC. Each client's data is completely isolated through database-level Row-Level Security policies. There is no technical capability to cross-reference data between clients.

### Additional Assurances
- **No Marketing Use**: ILAD's data will never be used for marketing, advertising, or promotional purposes
- **Confidentiality**: All GetRomy personnel with potential data access are bound by confidentiality agreements
- **Survival**: These assurances are contractually binding and survive termination of service

**Reference**: [Privacy Policy - Section 6.1: Client Data Protection Assurance](https://intel.getromy.app/privacy)

---

## Legal Documentation

The commitments in this response are incorporated into our public legal documents:

| Document | Relevant Sections |
|----------|-------------------|
| [Terms of Service](https://intel.getromy.app/terms) | Section 7 (DPA), Section 9 (Data Ownership), Section 16.4 (Disposal) |
| [Privacy Policy](https://intel.getromy.app/privacy) | Section 6.1 (Assurances), Section 6.2 (Subprocessors), Section 14 (Deletion) |

---

## Contact

For questions regarding this response or to request additional documentation:

**Email**: legal@getromy.app
**Website**: https://intel.getromy.app

---

*This document was prepared by GetRomy LLC in response to ILAD's vendor security questionnaire. Last updated: January 6, 2026.*
