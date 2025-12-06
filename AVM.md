# Claude Code Prompt: Build a Production-Ready Automated Valuation Model (AVM) Tool

## Project Overview

Build a robust, versatile, real-time, extensive, and production-ready **Automated Valuation Model (AVM)** tool for the US residential real estate market. This AI-powered application will estimate property values using multiple valuation methodologies, machine learning, and real-time market data.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 14+** | App Router, React Server Components, API routes |
| **TypeScript** | Type-safe development throughout |
| **Vercel AI SDK** | AI integration, streaming, tool calling |
| **DeepSeek V3** via **OpenRouter** | Primary LLM for analysis and reasoning |
| **Supabase** | PostgreSQL database, real-time subscriptions, auth |
| **Exa AI** | Real-time web search for market data, comps, news |

---

## What is an AVM?

An **Automated Valuation Model (AVM)** is a technology-driven system that estimates real estate property values using:
- Mathematical modeling and statistical analysis
- Property characteristics and attributes
- Comparable sales data (comps)
- Market trends and conditions
- Geographic and neighborhood data

AVMs provide **instant valuations** with **confidence scores** indicating reliability, making them invaluable for lenders, investors, real estate professionals, and consumers.

### Industry Context

AVMs are used throughout the real estate industry by:
- **Mortgage Lenders**: For loan origination, underwriting, and LTV ratio determination
- **Real Estate Investors**: Portfolio valuation and acquisition analysis
- **iBuyers**: Instant offer generation (Zillow, Opendoor)
- **Appraisers**: Starting point for traditional appraisals
- **Consumers**: Home value estimates (Zillow Zestimate, Redfin Estimate)

---

## Core Mathematical Models to Implement

### 1. Hedonic Pricing Model (Primary)

The hedonic model decomposes property value into constituent characteristics. It's based on the economic theory that a property's value is the sum of its individual attributes.

**Standard Log-Linear Form:**
```
ln(P) = β₀ + β₁·ln(SQFT) + β₂·ln(LOTSIZE) + β₃·BEDROOMS + β₄·BATHROOMS 
        + β₅·AGE + β₆·GARAGE + β₇·POOL + β₈·LOCATION_SCORE + ε
```

**Where:**
- **P** = Property price (dependent variable)
- **β₀** = Intercept (base value when all features = 0)
- **β₁...βₙ** = Coefficients (hedonic prices/elasticities)
- **ε** = Error term (residual)

**Variable Definitions:**

| Variable | Description | Expected Sign |
|----------|-------------|---------------|
| SQFT | Living area square footage | Positive (+) |
| LOTSIZE | Lot size in square feet | Positive (+) |
| BEDROOMS | Number of bedrooms | Positive (+) |
| BATHROOMS | Number of bathrooms | Positive (+) |
| AGE | Years since construction | Negative (-) |
| GARAGE | Number of garage spaces | Positive (+) |
| POOL | Binary indicator (0/1) | Positive (+) |
| LOCATION_SCORE | Composite desirability index | Positive (+) |

**Hedonic Price (Marginal Value) Calculation:**

For continuous variables in log form:
```
∂P/∂X = βₓ · (P/X)
```

For example, the marginal value of one additional square foot:
```
Marginal_Value_SQFT = β₁ · (P / SQFT)
```

If β₁ = 0.45, P = $400,000, and SQFT = 2,000:
```
Marginal_Value_SQFT = 0.45 × ($400,000 / 2,000) = $90/sqft
```

**Why Log-Linear?**
- Captures diminishing returns (going from 1,000 to 1,500 sqft adds more value than 3,000 to 3,500 sqft)
- Ensures predicted prices are always positive
- Coefficients represent percentage changes (elasticities)

### 2. Comparable Sales Approach (Sales Comparison)

The most widely used appraisal method. Adjusts comparable property sale prices based on feature differences.

**Core Formula:**
```
Adjusted_Value = Comp_Sale_Price + Σ(Adjustment_i)
```

**Adjustment Calculation:**
```
Adjustment_i = (Subject_Feature_i - Comp_Feature_i) × Price_Per_Unit_i
```

**Example Adjustment Grid:**

| Feature | Subject | Comp 1 | Difference | $/Unit | Adjustment |
|---------|---------|--------|------------|--------|------------|
| Sq Ft | 2,000 | 1,800 | +200 | $150 | +$30,000 |
| Bedrooms | 4 | 3 | +1 | $10,000 | +$10,000 |
| Bathrooms | 2.5 | 2.0 | +0.5 | $7,500 | +$3,750 |
| Age (yrs) | 10 | 15 | -5 | $1,000 | +$5,000 |
| Garage | 2 | 1 | +1 | $8,000 | +$8,000 |
| Pool | Yes | No | +1 | $15,000 | +$15,000 |
| **Total** | | | | | **+$71,750** |

If Comp 1 sold for $350,000:
```
Adjusted_Comp_Value = $350,000 + $71,750 = $421,750
```

**Weighted Average of Multiple Comps:**
```
Estimated_Value = Σ(wᵢ × Adjusted_Comp_Valueᵢ) / Σ(wᵢ)
```

Where weights (wᵢ) are based on:
- Similarity score (physical characteristics match)
- Proximity (distance from subject)
- Recency (time since sale)
- Transaction type (arms-length preferred)

**Similarity Score Calculation:**
```
Similarity = 1 - [
  α₁·|ΔSqFt/SqFt| + 
  α₂·|ΔBeds| + 
  α₃·|ΔBaths| + 
  α₄·Distance/MaxDist + 
  α₅·DaysSinceSale/MaxDays
]
```

Where α values are feature importance weights (Σαᵢ = 1).

### 3. Repeat Sales Index Method

Tracks price appreciation by analyzing properties that sold multiple times.

**Basic Model:**
```
ln(Pₜ) - ln(Pₜ₋ₙ) = Σ(Dₜ × γₜ) + ε
```

Or equivalently:
```
ln(Pₜ/Pₜ₋ₙ) = Σ(Dₜ × γₜ) + ε
```

**Where:**
- Pₜ = Sale price at time t
- Pₜ₋ₙ = Previous sale price (n periods earlier)
- Dₜ = Time dummy variables (1 if sold in period t, 0 otherwise)
- γₜ = Price index coefficients (appreciation rates)

**Application:**
Use the index to time-adjust older comparable sales:
```
Time_Adjusted_Price = Old_Sale_Price × (Index_Current / Index_Sale_Date)
```

### 4. Machine Learning Ensemble Model

Combines multiple models for improved accuracy and robustness.

**Ensemble Formula:**
```
Final_Value = α₁·Hedonic_Value + α₂·Comp_Value + α₃·ML_Value + α₄·Index_Value
```

Where α coefficients are learned weights satisfying Σαᵢ = 1.

**ML Feature Vector:**
```typescript
interface PropertyFeatures {
  // Physical Characteristics (continuous)
  squareFeet: number;          // Living area
  lotSize: number;             // Lot square footage
  bedrooms: number;            // Bedroom count
  bathrooms: number;           // Full + 0.5×half baths
  yearBuilt: number;           // Construction year
  stories: number;             // Number of floors
  garageSpaces: number;        // Parking spaces
  
  // Physical Characteristics (binary)
  hasPool: boolean;
  hasBasement: boolean;
  hasFireplace: boolean;
  centralAir: boolean;
  
  // Location Features
  latitude: number;
  longitude: number;
  schoolScore: number;         // 1-10 rating
  crimeScore: number;          // Lower is better
  walkScore: number;           // 0-100
  transitScore: number;        // 0-100
  
  // Market Features
  medianAreaPrice: number;     // Neighborhood median
  pricePerSqFtArea: number;    // Area average $/sqft
  daysOnMarketAvg: number;     // Market velocity
  inventoryLevel: number;      // Months of supply
  
  // Temporal Features
  saleMonth: number;           // 1-12 (seasonality)
  mortgageRate: number;        // Current 30-yr rate
  yearOverYearChange: number;  // Market trend
}
```

---

## Confidence Score & FSD (Forecast Standard Deviation)

The confidence score indicates how reliable the valuation estimate is. It's based on the **Forecast Standard Deviation (FSD)**.

### FSD Calculation

FSD measures the expected error range as a percentage:

```
FSD = σ(Percentage_Errors) = √[Σ(eᵢ - ē)² / (n-1)]
```

**Where:**
- eᵢ = (AVM_Value - Actual_Sale_Price) / Actual_Sale_Price
- ē = Mean of percentage errors
- n = Number of observations in validation set

**Step-by-Step FSD Calculation:**

1. **Collect validation data**: Recent sales with known prices
2. **Generate AVM estimates** for each property
3. **Calculate percentage errors**:
   ```
   eᵢ = (AVM_Valueᵢ - Actual_Priceᵢ) / Actual_Priceᵢ
   ```
4. **Calculate mean error**: ē = Σeᵢ / n
5. **Calculate variance**: σ² = Σ(eᵢ - ē)² / (n-1)
6. **FSD** = √σ²

**Example:**

| Property | AVM Value | Actual Price | % Error |
|----------|-----------|--------------|---------|
| 1 | $410,000 | $400,000 | +2.5% |
| 2 | $295,000 | $310,000 | -4.8% |
| 3 | $525,000 | $500,000 | +5.0% |
| 4 | $380,000 | $390,000 | -2.6% |
| 5 | $445,000 | $450,000 | -1.1% |

Mean error: ē = (2.5 - 4.8 + 5.0 - 2.6 - 1.1) / 5 = -0.2%
Variance: σ² = [(2.5-(-0.2))² + (-4.8-(-0.2))² + ...] / 4 = 15.2%²
FSD = √15.2 ≈ 3.9%

### Statistical Interpretation

Based on normal distribution properties:
- **68% probability**: Actual value within ±1×FSD of estimate
- **95% probability**: Actual value within ±2×FSD of estimate
- **99% probability**: Actual value within ±3×FSD of estimate

**Example**: AVM value = $400,000, FSD = 10%
- 68% chance actual value is $360,000 - $440,000
- 95% chance actual value is $320,000 - $480,000

### Confidence Score Conversion

```
Confidence_Score = 100 × (1 - FSD)
```

Or using a more nuanced model:
```
Confidence_Score = f(
  data_quality,        // Input data completeness
  comp_count,          // Number of comparables found
  comp_recency,        // Age of comparable sales
  comp_similarity,     // How similar comps are
  market_volatility,   // Recent price fluctuations
  model_agreement      // Do models produce similar values?
)
```

### Industry Standard Thresholds (Freddie Mac HVE)

| Confidence Level | FSD Range | Use Case |
|------------------|-----------|----------|
| **High** | FSD ≤ 13% | Lending-grade decisions |
| **Medium** | 13% < FSD ≤ 20% | Preliminary estimates |
| **Low** | FSD > 20% | Requires manual review |

### Value Range Calculation

```
Value_Low = Estimated_Value × (1 - FSD)
Value_High = Estimated_Value × (1 + FSD)
```

For 95% confidence interval:
```
Value_Low_95 = Estimated_Value × (1 - 2×FSD)
Value_High_95 = Estimated_Value × (1 + 2×FSD)
```

---

## Database Schema (Supabase PostgreSQL)

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Properties table: Core property information
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Address fields
  address TEXT NOT NULL,
  street_number TEXT,
  street_name TEXT,
  unit TEXT,
  city TEXT NOT NULL,
  state CHAR(2) NOT NULL,
  zip_code VARCHAR(10) NOT NULL,
  county TEXT,
  fips_code VARCHAR(5),
  
  -- Geolocation
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geom GEOMETRY(Point, 4326),
  
  -- Property classification
  property_type TEXT CHECK (property_type IN (
    'single_family', 'condo', 'townhouse', 'multi_family', 
    'manufactured', 'land', 'commercial'
  )),
  
  -- Physical characteristics
  square_feet INTEGER,
  lot_size_sqft INTEGER,
  bedrooms INTEGER,
  bathrooms DECIMAL(3, 1),
  half_baths INTEGER,
  year_built INTEGER,
  stories INTEGER,
  garage_spaces INTEGER,
  
  -- Features
  has_pool BOOLEAN DEFAULT FALSE,
  has_basement BOOLEAN DEFAULT FALSE,
  basement_sqft INTEGER,
  has_fireplace BOOLEAN DEFAULT FALSE,
  
  -- Condition & Quality
  condition TEXT CHECK (condition IN (
    'excellent', 'good', 'average', 'fair', 'poor'
  )),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data_source TEXT,
  
  UNIQUE(address, city, state, zip_code)
);

-- Valuations table: AVM results
CREATE TABLE valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Core valuation results
  estimated_value DECIMAL(12, 2) NOT NULL,
  value_low DECIMAL(12, 2),
  value_high DECIMAL(12, 2),
  price_per_sqft DECIMAL(8, 2),
  
  -- Confidence metrics
  confidence_score DECIMAL(5, 2) CHECK (confidence_score BETWEEN 0 AND 100),
  fsd DECIMAL(5, 4),
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
  
  -- Individual model contributions
  hedonic_value DECIMAL(12, 2),
  comp_value DECIMAL(12, 2),
  ml_value DECIMAL(12, 2),
  
  -- Model weights used
  hedonic_weight DECIMAL(4, 3),
  comp_weight DECIMAL(4, 3),
  ml_weight DECIMAL(4, 3),
  
  -- Supporting data
  comparable_count INTEGER,
  
  -- Metadata
  valuation_date TIMESTAMPTZ DEFAULT NOW(),
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comparable sales table
CREATE TABLE comparable_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Sale information
  sale_price DECIMAL(12, 2) NOT NULL,
  sale_date DATE NOT NULL,
  listing_price DECIMAL(12, 2),
  days_on_market INTEGER,
  
  -- Transaction details
  sale_type TEXT CHECK (sale_type IN (
    'arms_length', 'foreclosure', 'reo', 'short_sale', 'auction'
  )),
  
  -- Source
  data_source TEXT,
  mls_number TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Valuation comparables junction table
CREATE TABLE valuation_comparables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valuation_id UUID REFERENCES valuations(id) ON DELETE CASCADE,
  comparable_sale_id UUID REFERENCES comparable_sales(id) ON DELETE CASCADE,
  
  -- Similarity and adjustments
  similarity_score DECIMAL(5, 4),
  distance_miles DECIMAL(6, 2),
  
  -- Adjustments applied
  sqft_adjustment DECIMAL(10, 2),
  bedroom_adjustment DECIMAL(10, 2),
  bathroom_adjustment DECIMAL(10, 2),
  age_adjustment DECIMAL(10, 2),
  total_adjustment DECIMAL(10, 2),
  adjusted_price DECIMAL(12, 2),
  
  -- Weight in calculation
  weight DECIMAL(4, 3),
  
  UNIQUE(valuation_id, comparable_sale_id)
);

-- Market data table
CREATE TABLE market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code VARCHAR(10) NOT NULL,
  
  -- Price metrics
  median_price DECIMAL(12, 2),
  avg_price DECIMAL(12, 2),
  median_price_per_sqft DECIMAL(8, 2),
  
  -- Trend metrics
  yoy_price_change DECIMAL(6, 4),
  mom_price_change DECIMAL(6, 4),
  
  -- Inventory metrics
  active_listings INTEGER,
  avg_days_on_market INTEGER,
  months_of_supply DECIMAL(4, 2),
  
  -- Volatility
  coefficient_of_variation DECIMAL(5, 4),
  
  -- Temporal
  data_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(zip_code, data_date)
);

-- Hedonic coefficients table
CREATE TABLE hedonic_coefficients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_area TEXT NOT NULL,
  market_area_type TEXT CHECK (market_area_type IN (
    'zip', 'city', 'county', 'msa', 'national'
  )),
  
  -- Model coefficients (log-linear)
  intercept DECIMAL(12, 6) NOT NULL,
  ln_sqft_coef DECIMAL(10, 6),
  ln_lot_size_coef DECIMAL(10, 6),
  bedroom_coef DECIMAL(10, 6),
  bathroom_coef DECIMAL(10, 6),
  age_coef DECIMAL(10, 6),
  garage_coef DECIMAL(10, 6),
  pool_coef DECIMAL(10, 6),
  
  -- Model statistics
  r_squared DECIMAL(5, 4),
  sample_size INTEGER,
  
  -- Validity
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(market_area, effective_date)
);

-- Indexes
CREATE INDEX idx_properties_location ON properties(zip_code, city, state);
CREATE INDEX idx_properties_geom ON properties USING GIST(geom);
CREATE INDEX idx_comp_sales_date ON comparable_sales(sale_date DESC);
CREATE INDEX idx_valuations_property ON valuations(property_id, valuation_date DESC);
CREATE INDEX idx_market_data_zip ON market_data(zip_code, data_date DESC);

-- Trigger to update geometry
CREATE OR REPLACE FUNCTION update_property_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_property_geom
BEFORE INSERT OR UPDATE OF latitude, longitude ON properties
FOR EACH ROW EXECUTE FUNCTION update_property_geom();

-- Function to find nearby comparables
CREATE OR REPLACE FUNCTION find_nearby_comparables(
  p_lat DECIMAL,
  p_lon DECIMAL,
  p_radius_miles DECIMAL DEFAULT 1.0,
  p_max_age_days INTEGER DEFAULT 180,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  property_id UUID,
  sale_price DECIMAL,
  sale_date DATE,
  distance_miles DECIMAL,
  square_feet INTEGER,
  bedrooms INTEGER,
  bathrooms DECIMAL,
  year_built INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    cs.sale_price,
    cs.sale_date,
    (ST_Distance(
      p.geom::geography,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
    ) / 1609.34)::DECIMAL,
    p.square_feet,
    p.bedrooms,
    p.bathrooms,
    p.year_built
  FROM comparable_sales cs
  JOIN properties p ON p.id = cs.property_id
  WHERE 
    ST_DWithin(
      p.geom::geography,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      p_radius_miles * 1609.34
    )
    AND cs.sale_date >= CURRENT_DATE - p_max_age_days
    AND cs.sale_type = 'arms_length'
  ORDER BY 4 ASC, cs.sale_date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

---

## Project Structure

```
avm-tool/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── valuations/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── properties/
│   │   │   └── [id]/page.tsx
│   │   └── market/page.tsx
│   ├── api/
│   │   ├── valuation/
│   │   │   ├── route.ts
│   │   │   └── stream/route.ts
│   │   ├── property/
│   │   │   └── route.ts
│   │   ├── comparables/
│   │   │   └── route.ts
│   │   └── ai/
│   │       ├── analyze/route.ts
│   │       └── chat/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/
│   ├── valuation/
│   │   ├── ValuationForm.tsx
│   │   ├── ValuationResult.tsx
│   │   └── ConfidenceGauge.tsx
│   └── ai/
│       └── ChatInterface.tsx
├── lib/
│   ├── avm/
│   │   ├── index.ts
│   │   ├── hedonic-model.ts
│   │   ├── comparable-sales.ts
│   │   ├── confidence-score.ts
│   │   └── ensemble.ts
│   ├── ai/
│   │   ├── provider.ts
│   │   └── tools.ts
│   ├── data/
│   │   └── exa.ts
│   └── supabase/
│       ├── client.ts
│       └── server.ts
├── hooks/
│   └── useValuation.ts
├── .env.local
└── package.json
```

---

## Key Implementation Files

### AI Provider Setup

```typescript
// lib/ai/provider.ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// DeepSeek V3 - General analysis
export const deepseekV3 = openrouter('deepseek/deepseek-chat');

// DeepSeek R1 - Complex reasoning
export const deepseekR1 = openrouter('deepseek/deepseek-r1');
```

### Exa Search Integration

```typescript
// lib/data/exa.ts
import Exa from 'exa-js';

const exa = new Exa(process.env.EXA_API_KEY!);

export async function searchMarketNews(location: string) {
  return await exa.searchAndContents(
    `${location} real estate market trends prices`,
    {
      type: 'auto',
      category: 'news',
      numResults: 10,
      text: { maxCharacters: 2000 },
      highlights: { numSentences: 3 }
    }
  );
}
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-key

# OpenRouter (DeepSeek)
OPENROUTER_API_KEY=your-key

# Exa AI
EXA_API_KEY=your-key
```

---

## Getting Started

```bash
npx create-next-app@latest avm-tool --typescript --tailwind --eslint --app

cd avm-tool

npm install ai @ai-sdk/react @openrouter/ai-sdk-provider
npm install @exalabs/ai-sdk exa-js
npm install @supabase/supabase-js @supabase/ssr
npm install zod recharts lucide-react

npm run dev
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| MAPE | < 10% |
| Hit Rate | > 95% |
| PE10 (within ±10%) | > 70% |
| Response Time | < 2s |

---

Build this AVM tool with all mathematical rigor, AI capabilities, and production-ready infrastructure!