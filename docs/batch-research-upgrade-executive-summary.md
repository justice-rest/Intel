# Rōmy Batch Research Upgrade
## Executive Summary for Leadership

---

### The Opportunity

Rōmy's batch research feature allows nonprofits to upload a list of prospects and receive comprehensive wealth and philanthropic profiles for each one. This is our core value proposition—delivering research that typically costs $0.50-$1.00 per prospect from competitors like iWave and DonorSearch at a fraction of the cost (~$0.04 per prospect).

**However, the current system has reliability issues that limit our ability to serve organizations at scale.**

---

### Current Challenges

| Issue | Impact |
|-------|--------|
| **Data loss on browser close** | If a user closes their browser mid-batch, processing stops. They must restart. |
| **Inconsistent data extraction** | Sometimes wealth data isn't captured correctly, leading to incomplete profiles (~30% data loss) |
| **No source verification** | We trust what AI models report without cross-checking official sources like SEC or FEC |
| **Same effort for every prospect** | We spend the same time researching a $50K donor as a potential $5M donor |
| **Limited audit trail** | We can't trace where a specific data point came from |

---

### The Solution: Production-Ready Batch Research

We're upgrading batch research to be **enterprise-grade**—the kind of system that Fortune 500 companies and major foundations can rely on.

#### What Changes for Users?

1. **Never lose work** — If something goes wrong, research picks up exactly where it left off
2. **Higher quality data** — We verify claims against official sources (SEC filings, FEC records, property databases)
3. **Confidence ratings** — Users see which data is verified vs estimated
4. **Faster for simple prospects** — Low-potential prospects get quick research; high-potential get deep dives
5. **Full transparency** — Every data point traces back to its source

#### What Doesn't Change?

- The user interface stays exactly the same
- Pricing remains the same
- No new accounts or integrations required

---

### How It Works (Non-Technical)

**Current Process:**
```
Upload list → AI researches each person → Save results
```

**New Process:**
```
Upload list → AI researches → Cross-check with official sources →
Score confidence → Flag any discrepancies → Save verified results
```

Think of it like adding a fact-checker between the research and the final report.

---

### Data Quality Improvements

| Metric | Today | After Upgrade |
|--------|-------|---------------|
| Successful profiles | ~70% | >95% |
| Sources per prospect | 2-3 | 5+ |
| Verified data points | ~20% | >50% |
| Caught errors/false claims | 0% | >80% |
| Resume after interruption | No | Yes |

---

### Source Verification Hierarchy

We prioritize official, authoritative sources:

| Source | Trust Level | What It Tells Us |
|--------|-------------|------------------|
| SEC EDGAR | Highest | Public company board/officer roles, stock holdings |
| FEC.gov | Highest | Political contribution history |
| ProPublica 990s | Highest | Foundation affiliations, nonprofit board service |
| County Property Records | Very High | Real estate ownership, property values |
| Zillow/Redfin | High | Market value estimates |
| LinkedIn | Medium | Career history, education |
| News Sources | Medium | Recent events, biographical details |
| AI Synthesis | Lower | Estimates when official sources unavailable |

When sources disagree, we flag it for the fundraiser's attention rather than guessing.

---

### Competitive Advantage

This upgrade positions Rōmy as the **most accurate** prospect research tool available:

| Feature | Rōmy (After Upgrade) | iWave | DonorSearch |
|---------|---------------------|-------|-------------|
| Per-field confidence scores | ✅ | ❌ | ❌ |
| Real-time SEC/FEC verification | ✅ | ❌ | ❌ |
| Source transparency | ✅ | Partial | Partial |
| Adaptive research depth | ✅ | ❌ | ❌ |
| Resume interrupted jobs | ✅ | ✅ | ✅ |
| Cost per prospect | ~$0.04 | ~$0.75 | ~$0.75 |

**We deliver higher quality at 1/20th the cost.**

---

### Timeline

| Week | Focus | Outcome |
|------|-------|---------|
| Week 1 | Reliability foundation | Never lose data, resume capability |
| Week 2 | Data quality engine | Source verification, confidence scoring |
| Week 3 | Testing & polish | 100+ prospect test batch, performance tuning |

**Total: ~3 weeks to production-ready**

---

### Investment Required

- **Engineering time:** ~3 weeks of focused development
- **New infrastructure costs:** $0 (uses existing systems)
- **New dependencies:** None

---

### Success Criteria

After this upgrade, we should see:

1. **Zero data loss** — No more incomplete profiles due to browser/network issues
2. **Higher customer satisfaction** — More accurate, trustworthy profiles
3. **Scalability** — Confidently handle 1,000+ prospect batches
4. **Differentiation** — Only platform with per-field verification and confidence scores
5. **Enterprise readiness** — Audit trail meets compliance requirements for larger organizations

---

### Recommendation

**Proceed with the upgrade.** This is foundational work that:
- Fixes current reliability issues frustrating users
- Differentiates Rōmy from competitors on data quality
- Prepares the platform for enterprise customers who require auditable, verified data
- Requires no new costs or dependencies

The upgrade maintains full backward compatibility—existing users won't notice any disruption, only improvement.

---

*Document prepared: December 2025*
*For questions: [Engineering Team]*
