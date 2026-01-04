# Gift Capacity & Recommended Ask Methodology

## Overview

This document explains how Rōmy calculates **Gift Capacity** and **Recommended Ask** for prospect research reports.

---

## Gift Capacity Calculation

### Formula
```
Gift Capacity = Estimated Net Worth × 5%
```

### Rationale
- Industry standard: Major donors typically give **3-7% of net worth** over their lifetime
- We use **5%** as the midpoint for a realistic capacity estimate
- This represents what a prospect *could* give, not what they *will* give

### Example
| Net Worth | Gift Capacity |
|-----------|---------------|
| $500,000 | $25,000 |
| $1,000,000 | $50,000 |
| $2,500,000 | $125,000 |
| $5,000,000 | $250,000 |
| $10,000,000 | $500,000 |

---

## Recommended Ask Calculation

The recommended ask varies based on **Capacity Rating**, using a tiered percentage of net worth:

| Capacity Rating | Net Worth Range | Ask % | Example |
|-----------------|-----------------|-------|---------|
| **A (MAJOR)** | $5M+ | 1.0% | $5M → $50,000 |
| **B (PRINCIPAL)** | $1M - $5M | 1.5% | $2M → $30,000 |
| **C (LEADERSHIP)** | $500K - $1M | 2.0% | $750K → $15,000 |
| **D (ANNUAL)** | $100K - $500K | 2.5% | $200K → $5,000 |

### Why Different Percentages?

- **Major donors (A)**: Lower percentage because the absolute amount is significant
- **Principal donors (B)**: Moderate percentage for meaningful leadership gifts
- **Leadership donors (C)**: Higher percentage to maximize mid-level giving
- **Annual donors (D)**: Highest percentage for entry-level major gifts

---

## Net Worth Estimation

We estimate net worth by aggregating wealth indicators from multiple sources:

### Components

| Source | Calculation |
|--------|-------------|
| **Real Estate** | Sum of property values (Zillow, Redfin, county records) |
| **Business Ownership** | $500,000 per business owned |
| **SEC Filings** | +$500,000 if has public company filings |
| **Political Giving** | FEC contributions × 10 (wealth multiplier) |

### Formula
```
Estimated Net Worth = Real Estate Value
                    + (Business Count × $500,000)
                    + (Has SEC Filings ? $500,000 : 0)
                    + (FEC Contributions × 10)
```

### Example Calculation
| Indicator | Value |
|-----------|-------|
| Home Value (Zillow) | $1,200,000 |
| Investment Property | $450,000 |
| Business Owner (1) | $500,000 |
| FEC Contributions | $15,000 × 10 = $150,000 |
| **Total Net Worth** | **$2,300,000** |

With $2.3M net worth:
- **Gift Capacity**: $2,300,000 × 5% = **$115,000**
- **Capacity Rating**: B (PRINCIPAL)
- **Recommended Ask**: $2,300,000 × 1.5% = **$34,500**

---

## Capacity Ratings

| Rating | Label | Net Worth | Typical Gift Range |
|--------|-------|-----------|-------------------|
| **A** | MAJOR | $5M+ | $50,000+ |
| **B** | PRINCIPAL | $1M - $5M | $15,000 - $50,000 |
| **C** | LEADERSHIP | $500K - $1M | $10,000 - $15,000 |
| **D** | ANNUAL | Under $500K | $1,000 - $10,000 |

---

## Important Notes

1. **These are estimates** - Actual giving depends on philanthropic affinity, relationship, and timing
2. **Gift Capacity ≠ Recommended Ask** - Capacity is lifetime potential; ask is a single solicitation
3. **Always verify** - Use these as starting points, not final decisions
4. **Context matters** - A prospect with strong affinity may give above capacity; one without connection may give nothing

---

## Data Sources

- **Real Estate**: Zillow, Redfin, county assessor records
- **Business**: State corporation filings, LinkedIn, news articles
- **Securities**: SEC EDGAR (Forms 3, 4, 5, DEF 14A)
- **Political Giving**: FEC contribution records
- **Philanthropy**: ProPublica Nonprofit Explorer, foundation 990s
