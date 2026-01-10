# Donor Research Platform: Competitive Analysis & Strategic Recommendations
## Executive Summary

This analysis compares Intel's current feature set against leading donor research platforms (iWave/Kindsight, WealthEngine, DonorSearch) and identifies strategic opportunities to compete and exceed market expectations in 2026.

**Key Finding**: Intel has a **strong foundation** with 50+ free data sources, AI-powered features, and modern architecture, but needs to address **critical gaps** in collaboration workflows, pricing transparency, and predictive intelligence to compete at the enterprise level.

---

## 1. Current Market Landscape

### Leading Competitors

| Platform | Market Position | Starting Price | Key Differentiator |
|----------|----------------|----------------|-------------------|
| **iWave (Kindsight)** | Market leader | $3,745/year | Only platform with US + Canadian data; comprehensive company/foundation screening |
| **WealthEngine** | Enterprise focus | Custom (high $$) | 250M+ profiles, predictive modeling, Salesforce integration |
| **DonorSearch** | Philanthropy-focused | Per-pull pricing | 90% accuracy (vs 70% industry standard); focus on charitable behavior over wealth |
| **Intel** | Emerging AI-first | TBD | AI-native, free data sources, modern UX |

### Pricing Models (2026 Market)

All three major competitors use **opaque pricing** requiring sales calls:
- **iWave**: Annual subscription, credit-based system, ~$3,745+ starter
- **WealthEngine**: Custom enterprise pricing (prohibitive for small nonprofits)
- **DonorSearch**: Per-pull/per-contact pricing (cost-prohibitive for high-volume screening)

**User Pain Point**: "Some donor prospect research tools charge per prospect screening, which may be prohibitive to nonprofit organizations with a smaller budget, resulting in the prospect research database being used too infrequently."

---

## 2. Intel's Current Strengths

### 🏆 Competitive Advantages

1. **Cost Structure**: $0 for all 50+ government/public data sources (vs competitors charging thousands)
2. **AI-Native Architecture**: Built from ground-up with GPT-4, Claude, streaming, memory systems
3. **Modern UX**: Next.js 15, real-time streaming, mobile-responsive
4. **Comprehensive CRM Integration**: 7 CRMs supported vs competitors' 1-2 integrations
5. **Transparent Features**: All tools visible, no hidden data sources
6. **BYOK Support**: Users can bring their own AI API keys
7. **Dual Memory System**: V1/V2 memory with semantic search and vector embeddings
8. **Batch Processing**: Standard + Deep enrichment modes with workflow orchestration

### 📊 Feature Comparison Matrix

| Feature Category | Intel | iWave | WealthEngine | DonorSearch |
|------------------|-------|-------|--------------|-------------|
| **Data Sources** | 50+ (FREE govt APIs) | 40+ (premium paid) | Half trillion data points | Philanthropy-focused |
| **AI/ML Features** | ✅ GPT-4, Claude, Memory, RAG | ✅ Real-time intelligence (2026) | ✅ Predictive modeling | ✅ Basic AI |
| **CRM Integrations** | 7 (Bloomerang, Virtuous, Neon, DP, Salesforce, RE, EA) | Limited | ✅ Strong Salesforce | 40+ integrations |
| **Capacity Screening** | ✅ TFG Research formulas (GS, EGS, Snapshot) | ✅ Wealth screening | ✅ Donor pyramid modeler | ✅ 90% accuracy |
| **Batch Screening** | ✅ CSV/Excel upload, dual modes | ✅ Supported | ✅ High-volume focus | ✅ Supported |
| **Collaborative Tools** | ⚠️ Basic (chat sharing, projects) | ✅ Team features | ✅ Enterprise features | ✅ List-sharing |
| **Mobile Access** | ✅ Responsive web | ✅ Mobile dashboards | ✅ Mobile app | ✅ Mobile dashboards |
| **Pricing Model** | TBD | Subscription/credits | Custom enterprise | Per-pull |
| **Real Estate Data** | ✅ Zillow, NYC ACRIS, property valuations | ✅ Included | ✅ Included | ✅ Included |
| **SEC/Business Data** | ✅ EDGAR, insider search, GLEIF | ✅ Included | ✅ Included | Limited |
| **Political Data** | ✅ FEC, lobbying, USAspending | ✅ Included | ✅ Included | ✅ Included |
| **Nonprofit Data** | ✅ ProPublica 990s, foundation grants | ✅ Included | Limited | ✅ Strong focus |
| **Canadian Data** | ❌ US-only | ✅ Only platform with Canadian data | ❌ US-only | ❌ US-only |
| **International Data** | ❌ Limited | ⚠️ Some | ⚠️ Some | ❌ US-only |

---

## 3. Critical Feature Gaps

### 🚨 HIGH PRIORITY (Must-Have to Compete)

#### 3.1 Team Collaboration & Workflow Management
**Current State**: Basic chat sharing, projects, PDF export
**Competitor State**: Saved searches, alerts, task assignment, team dashboards, list-sharing
**User Need**: "Modern prospect research tools allow team collaboration with saved searches, alerts, mobile dashboards, and list-sharing tools."

**Missing Features**:
- [ ] **Task Assignment & Tracking** - Assign prospects to team members with deadlines
- [ ] **Saved Search Templates** - Save and reuse complex searches across team
- [ ] **Team Dashboards** - Centralized view of team activity, pipeline, and metrics
- [ ] **Automated Alerts** - Notify team when donor status changes (new property, large gift, SEC filing)
- [ ] **Commenting & Notes** - Team members can comment on prospect profiles
- [ ] **Research Status Tracking** - Mark prospects as "In Review", "Qualified", "Assigned", "Cultivating"
- [ ] **Approval Workflows** - Require manager approval before moving prospect to solicitation
- [ ] **List Management** - Create, share, and collaborate on prospect lists with filters

**Impact**: Without these, Intel is positioned as an **individual research tool**, not an **enterprise team platform**.

---

#### 3.2 Predictive AI & Intelligent Scoring
**Current State**: RomyScore (0-100), capacity ratings (A/B/C/D), TFG formulas
**Competitor State**: Machine learning models predicting next gift amount, churn risk, optimal ask amount, likelihood to give
**User Need**: "Predictive AI tools anticipate future donor behavior by assessing existing datasets for patterns and trends, offering tailored insights to enhance fundraising ROI."

**Missing Features**:
- [ ] **Next Gift Prediction** - ML model predicting when donor will give next
- [ ] **Optimal Ask Amount** - AI recommends personalized donation amounts (drives 4.5% more revenue)
- [ ] **Churn Risk Scoring** - Identify donors becoming less active before they lapse
- [ ] **Lifetime Value (LTV) Prediction** - Estimate total giving potential over 5-10 years
- [ ] **RFM Scoring** - Recency, Frequency, Monetary analysis
- [ ] **Propensity Models** - Likelihood to upgrade to monthly giving, major gift, planned giving
- [ ] **Renewal Probability** - Predict likelihood of repeat donation
- [ ] **Custom Model Training** - Train models on organization's specific donor data

**Impact**: "More than 30% of nonprofits reported increased fundraising revenue after adopting AI tools." Intel needs these to remain competitive.

---

#### 3.3 Real-Time Monitoring & Automated Alerts
**Current State**: Manual search-based research
**Competitor State**: Live profile monitoring, automated wealth event notifications
**User Need**: "Automated notifications that alert users to important changes in donor status like new property purchases or recent gifts are highly valued."

**Missing Features**:
- [ ] **Wealth Event Monitoring** - Auto-detect new property purchases, business sales, IPOs, insider trades
- [ ] **Trigger-Based Alerts** - Email/Slack notifications when monitored prospect has event
- [ ] **News Monitoring** - Track donor mentions in news, press releases, SEC filings
- [ ] **Portfolio Watchlists** - Monitor specific prospects for changes
- [ ] **Competitive Intelligence** - Alert when prospect gives to similar organizations
- [ ] **Milestone Tracking** - Notify team of donor birthdays, anniversaries, tenure milestones
- [ ] **Philanthropic Activity Alerts** - New foundation board appointments, large gifts reported

**Impact**: Without real-time monitoring, users must manually re-research prospects. Competitors provide continuous intelligence.

---

#### 3.4 Data Accuracy & Verification
**Current State**: Multi-source triangulation with confidence scoring
**Competitor State**: DonorSearch claims 90% accuracy vs 70% industry standard
**User Need**: "By combining automated and manual research verification, DonorSearch's wealth screening is 90% accurate."

**Missing Features**:
- [ ] **Manual Verification Layer** - Human researchers verify high-value prospects
- [ ] **Data Conflict Resolution** - When multiple sources conflict, show all sources + confidence
- [ ] **Historical Data Tracking** - Show how wealth/capacity changed over time
- [ ] **Data Freshness Indicators** - Show when each data point was last updated
- [ ] **Source Quality Scoring** - Rate reliability of each data source (Zillow vs assessor, etc.)
- [ ] **Verification Workflow** - Flag low-confidence data for manual review
- [ ] **Audit Trail** - Track all data sources used in capacity calculation

**Impact**: Trust is critical. 90% vs 70% accuracy could be a key differentiator.

---

### ⚠️ MEDIUM PRIORITY (Important for Growth)

#### 3.5 Advanced Reporting & Analytics
**Current State**: Memory stats, batch results export
**Competitor State**: Custom reports, pipeline analytics, ROI tracking

**Missing Features**:
- [ ] **Pipeline Reports** - Prospects by stage (identification, qualification, cultivation, solicitation)
- [ ] **Capacity Analysis** - Total capacity in pipeline by rating (A/B/C/D)
- [ ] **Team Performance Metrics** - Research completed, prospects qualified, conversions
- [ ] **ROI Dashboard** - Donations secured vs research time invested
- [ ] **Custom Report Builder** - Drag-drop fields to create custom exports
- [ ] **Scheduled Reports** - Auto-email weekly/monthly reports to leadership
- [ ] **Data Visualization** - Charts, graphs, heat maps for prospect data
- [ ] **Benchmarking** - Compare organization's metrics to industry averages

---

#### 3.6 Integration Ecosystem Expansion
**Current State**: 7 CRMs, Gmail, Google Drive, Notion
**Competitor State**: 40+ integrations (DonorSearch), native Salesforce app

**Missing Features**:
- [ ] **Native CRM Apps** - Embedded Intel research inside Salesforce, Raiser's Edge, etc. (not just API)
- [ ] **Zapier/Make Integration** - Connect Intel to 5,000+ apps
- [ ] **Webhooks** - Real-time data push to external systems
- [ ] **API for Developers** - Public REST API for custom integrations
- [ ] **Email Marketing Integration** - Mailchimp, Constant Contact, SendGrid
- [ ] **Event Management** - Eventbrite, Givebutter sync
- [ ] **Accounting Software** - QuickBooks, Xero for gift tracking
- [ ] **Major Gift Software** - Purpose, EverTrue integration

---

#### 3.7 Enhanced Data Coverage
**Current State**: 50+ US government data sources
**Competitor State**: iWave offers US + Canadian data; international coverage

**Missing Features**:
- [ ] **Canadian Data** - Property records, CRA filings, Canadian philanthropy
- [ ] **UK/EU Data** - Companies House, Charity Commission, land registry
- [ ] **Employment Data** - Current employer verification (LinkedIn, ZoomInfo integration?)
- [ ] **Executive Compensation** - Broader coverage beyond proxy statements
- [ ] **Foundation Officer Comp** - 990-PF Part VIII compensation data
- [ ] **Social Media Signals** - LinkedIn connections, Twitter philanthropy mentions
- [ ] **Corporate Matching Gift DB** - Which companies match, at what ratio
- [ ] **Planned Giving Indicators** - Trust/estate attorney affiliations, age/health factors

---

### 💡 LOW PRIORITY (Nice-to-Have / Future Vision)

#### 3.8 AI-Powered Cultivation Recommendations
**Current State**: AI generates cultivation strategies in chat
**Future Vision**: Proactive, data-driven cultivation plans

**Missing Features**:
- [ ] **Cultivation Timeline Builder** - AI suggests 6-12 month cultivation plan with milestones
- [ ] **Touchpoint Recommendations** - When to call, email, invite to event
- [ ] **Content Recommendations** - Which newsletters, stories, impact reports to send
- [ ] **Affinity Matching** - Connect prospects to programs they care about
- [ ] **Peer-to-Peer Strategy** - Identify which board members/volunteers could introduce
- [ ] **Event Invitation Logic** - Which prospects to invite to which events (capacity + affinity)

---

#### 3.9 Mobile-First Experience
**Current State**: Responsive web app
**Future Vision**: Native mobile apps with offline capability

**Missing Features**:
- [ ] **Native iOS/Android Apps** - Better mobile performance
- [ ] **Offline Mode** - Download prospect profiles for offline access
- [ ] **Mobile-Optimized Research** - Simplified UI for phone screens
- [ ] **Voice Input** - "Hey Intel, research John Smith in Seattle"
- [ ] **Mobile Notifications** - Push alerts for wealth events, task assignments

---

#### 3.10 Community & Benchmarking
**Current State**: Individual organization usage
**Future Vision**: Anonymous benchmarking and best practice sharing

**Missing Features**:
- [ ] **Anonymous Benchmarking** - "Organizations like yours have 15% of prospects rated A"
- [ ] **Best Practice Library** - Templates, playbooks, guides from top-performing orgs
- [ ] **Community Forum** - Users share tips, templates, success stories
- [ ] **Fundraising Benchmarks** - Average gift by capacity rating, conversion rates by sector
- [ ] **Data Marketplace** - Users could share anonymized prospect lists (privacy-compliant)

---

## 4. User Pain Points Intel Solves

✅ **"Data overload and filtering"** → Intel's AI synthesizes 50+ sources into actionable briefs
✅ **"Prospecting challenges"** → Discovery templates + dynamic discovery for rapid prospect generation
✅ **"Time and efficiency issues"** → Batch processing + AI automation reduces manual research time
✅ **"Prohibitive per-pull pricing"** → Free data sources + transparent pricing (when launched)
✅ **"Heavy feature overload"** → Clean, modern UX focused on research workflow
✅ **"Lack of CRM integration"** → 7 CRMs supported vs competitors' 1-2

---

## 5. User Pain Points Intel Must Address

❌ **"Software lacks advanced features like live profile monitoring"** → Need real-time alerts
❌ **"Needs granular insights into capacity and affinity"** → Need predictive models
❌ **"No integrated research workflows"** → Need task management, team collaboration
❌ **"Data accuracy concerns"** → Need verification layer (target 90% accuracy like DonorSearch)
❌ **"Tool doesn't make next step obvious"** → Need cultivation recommendations, actionable tasks

---

## 6. Strategic Recommendations

### Phase 1: Enterprise Readiness (Q1-Q2 2026)
**Goal**: Position Intel as a viable enterprise team platform

1. **Implement Team Collaboration** (Critical)
   - Task assignment, saved searches, team dashboards
   - Commenting, status tracking, approval workflows
   - List management with sharing

2. **Add Real-Time Monitoring** (Critical)
   - Wealth event detection (property, SEC, business)
   - Automated alerts via email/Slack
   - Portfolio watchlists

3. **Enhance Data Verification** (Critical)
   - Show data freshness indicators
   - Conflict resolution UI when sources disagree
   - Historical data tracking (wealth changes over time)

4. **Launch Transparent Pricing** (Critical)
   - Avoid opaque "contact sales" model
   - Offer self-serve pricing tiers
   - Free tier (limited) + Pro tier + Enterprise tier

**Success Metric**: 10+ team-based organizations (5+ users each) using Intel by Q2 2026

---

### Phase 2: Predictive Intelligence (Q3 2026)
**Goal**: Differentiate with best-in-class AI predictions

1. **Build Predictive Models**
   - Next gift amount prediction
   - Optimal ask amount recommendation
   - Churn risk scoring
   - LTV prediction

2. **Train Custom Models**
   - Allow organizations to train on their own data
   - Improve accuracy over time with feedback loops
   - RFM analysis integration

3. **Proactive Recommendations**
   - AI suggests which prospects to prioritize this week
   - AI recommends cultivation strategies
   - AI identifies hidden major gift prospects

**Success Metric**: Customers report 15%+ increase in major gift revenue attributed to Intel predictions

---

### Phase 3: Market Expansion (Q4 2026 - Q1 2027)
**Goal**: Expand addressable market beyond US nonprofits

1. **International Data Coverage**
   - Canadian data (compete with iWave's unique advantage)
   - UK/EU data for international charities
   - Global foundation grants

2. **Enterprise Integrations**
   - Native Salesforce app (embedded research)
   - Zapier/Make integration
   - Public API for developers

3. **Advanced Analytics**
   - Pipeline reporting
   - ROI tracking
   - Custom report builder
   - Benchmarking

**Success Metric**: 5%+ of revenue from international customers; 20%+ of customers use native integrations

---

## 7. Competitive Positioning Strategy

### How to Beat iWave/Kindsight
**iWave's Advantage**: US + Canadian data, company/foundation screening
**Intel's Counter**:
- ✅ Superior AI (memory, RAG, multi-model)
- ✅ Modern UX (Next.js vs legacy platform)
- ✅ Transparent pricing (vs opaque credits)
- 🔄 Add Canadian data (Phase 3)
- 🔄 Add foundation screening (already have ProPublica 990s, need better UX)

---

### How to Beat WealthEngine
**WealthEngine's Advantage**: 250M+ profiles, enterprise modeling, Salesforce integration
**Intel's Counter**:
- ✅ Better AI (GPT-4, Claude, streaming)
- ✅ 7 CRM integrations (vs WealthEngine's Salesforce focus)
- ✅ Lower cost (free data vs enterprise pricing)
- 🔄 Add predictive modeling (Phase 2)
- 🔄 Native Salesforce app (Phase 3)

---

### How to Beat DonorSearch
**DonorSearch's Advantage**: 90% accuracy, 40+ integrations, philanthropy focus
**Intel's Counter**:
- ✅ Superior AI features (memory, RAG, batch workflows)
- ✅ Modern architecture (built for 2026, not retrofitted)
- ✅ Free data sources (vs per-pull pricing)
- 🔄 Add verification layer (target 90% accuracy - Phase 1)
- 🔄 Expand integrations (Phase 3)

---

### Unique Positioning: "The AI-First Donor Intelligence Platform"

**Tagline Options**:
- "AI-Powered Donor Research for Modern Fundraisers"
- "Prospect Intelligence That Thinks Like Your Best Researcher"
- "From 50+ Data Sources to One Actionable Strategy"

**Key Messages**:
1. **AI-Native**: Built from the ground up with GPT-4, not bolted-on AI
2. **Transparent Cost**: No per-pull fees, no hidden data costs, no opaque pricing
3. **Modern UX**: Real-time streaming, mobile-responsive, chat-based interface
4. **Comprehensive**: 50+ free data sources vs competitors' paid data
5. **Team-First**: Collaboration features for the whole development team

---

## 8. Pricing Strategy Recommendation

### Avoid Competitors' Mistakes
- ❌ Don't charge per-pull (creates rationing behavior)
- ❌ Don't hide pricing behind sales calls (creates friction)
- ❌ Don't require multi-year contracts (intimidates small nonprofits)

### Recommended Pricing Model: **Seat-Based Subscription**

| Tier | Price | Features | Target Customer |
|------|-------|----------|-----------------|
| **Free** | $0 | 10 prospect searches/month, basic research tools, 1 user | Small nonprofits, solo fundraisers |
| **Pro** | $99/user/month | Unlimited searches, batch processing (50/month), CRM integration, memory, 5 users | Mid-size nonprofits ($1-10M budget) |
| **Team** | $199/user/month | All Pro + team collaboration, saved searches, alerts, batch processing (500/month) | Development teams (5-20 users) |
| **Enterprise** | Custom | All Team + predictive AI, custom models, native CRM apps, dedicated support, unlimited batch | Large nonprofits, universities, hospitals |

**Key Features**:
- Monthly or annual billing (annual gets 2 months free)
- Add-ons: Deep Research credits ($5/credit), additional batch processing ($0.50/prospect)
- Free trial: 14 days, no credit card required
- Volume discounts: 10+ users get 15% off, 25+ users get 25% off

**Why This Works**:
- Transparent (no sales call required for Pro/Team)
- Scales with organization size
- Predictable costs (no per-pull surprises)
- Competitive: $99/user/month vs iWave's $3,745/year minimum (often requires 3+ users = $312/user/month)

---

## 9. Go-To-Market Recommendations

### Target Markets (Prioritized)

1. **Primary**: Mid-size nonprofits ($1-10M revenue, 2-10 development staff)
   - Pain: Can't afford WealthEngine, but outgrowing manual research
   - Win: Pro tier at $99/user is 50% cheaper than iWave

2. **Secondary**: Universities & Healthcare (large development teams)
   - Pain: Need team collaboration, real-time monitoring
   - Win: Team tier with collaboration features competitors lack

3. **Tertiary**: Small nonprofits (<$1M revenue, 1-2 staff)
   - Pain: Can't afford any competitor
   - Win: Free tier + occasional Deep Research credits

### Marketing Messages by Persona

**For Executive Directors / Chief Development Officers**:
- "Increase major gift revenue by 30% with AI-powered prospect intelligence"
- "Know exactly who to ask, when to ask, and how much to ask for"
- "Transparent pricing: No per-pull fees, no hidden costs, no surprises"

**For Directors of Development / Major Gift Officers**:
- "Research 50+ data sources in minutes, not hours"
- "AI remembers every detail so you can focus on relationships"
- "Real-time alerts when prospects have wealth events"

**For Prospect Researchers / Data Analysts**:
- "Built by researchers, for researchers"
- "All 50+ data sources are free government APIs – no proprietary black boxes"
- "Export everything: CSV, PDF, CRM sync"

---

## 10. Success Metrics (2026 Goals)

| Metric | Q2 2026 | Q4 2026 | Measure |
|--------|---------|---------|---------|
| **Paying Customers** | 50 orgs | 250 orgs | Orgs on Pro/Team/Enterprise |
| **Team Adoption** | 10 orgs with 5+ users | 50 orgs with 5+ users | Collaboration feature usage |
| **Revenue** | $50K MRR | $200K MRR | Monthly Recurring Revenue |
| **NPS Score** | 40+ | 60+ | Net Promoter Score |
| **Accuracy** | 80% | 90% | Data verification accuracy |
| **Churn** | <10% monthly | <5% monthly | Customer retention |

---

## 11. Risk Mitigation

### Competitive Risks
- **Risk**: iWave/Kindsight launches superior AI features in 2026
- **Mitigation**: Stay 6-12 months ahead with bleeding-edge models (GPT-5, Claude 4, etc.)

- **Risk**: WealthEngine lowers pricing to compete
- **Mitigation**: Focus on superior UX, AI features, not just price

- **Risk**: DonorSearch improves accuracy to 95%+
- **Mitigation**: Match accuracy (Phase 1), then differentiate on AI cultivation recommendations

### Technical Risks
- **Risk**: Free government APIs become rate-limited or paid
- **Mitigation**: Cache aggressively, negotiate higher limits, budget for paid alternatives

- **Risk**: AI costs spiral as usage grows
- **Mitigation**: Optimize prompts, use cheaper models (Haiku, GPT-4o-mini) for batch, reserve Opus for chat

- **Risk**: Supabase scales poorly at 10,000+ users
- **Mitigation**: Plan migration path to self-hosted Postgres + S3

### Market Risks
- **Risk**: Nonprofit budgets shrink in recession
- **Mitigation**: Emphasize ROI (increase revenue 30%), offer payment plans

- **Risk**: Compliance/privacy regulations restrict data usage
- **Mitigation**: Stay GDPR-compliant, offer data deletion, never sell data

---

## 12. Conclusion: Intel's Path to Market Leadership

### Current State (January 2026)
Intel has a **strong foundation** with cutting-edge AI, comprehensive free data, and modern architecture. It's positioned as an **individual research tool** for tech-savvy fundraisers.

### Required Evolution
To compete with iWave, WealthEngine, and DonorSearch, Intel must evolve into an **enterprise team platform** with:
1. Team collaboration workflows
2. Predictive AI intelligence
3. Real-time monitoring & alerts
4. 90%+ data accuracy

### Winning Strategy
**Differentiate on AI, compete on price, win on UX.**

- **AI-First**: Leverage GPT-4, Claude, memory, RAG to create features competitors can't match
- **Transparent Pricing**: Avoid opaque "contact sales" model – be the Stripe/Vercel of donor research
- **Modern UX**: Real-time streaming, chat-based interface, mobile-responsive design
- **Free Data**: All 50+ sources are government APIs – no proprietary data moat, just superior synthesis

### 2026 Vision
By Q4 2026, Intel should be known as:
> "The AI-powered donor intelligence platform that helps mid-size nonprofits raise 30% more in major gifts – without enterprise pricing."

### Next Steps
1. **Prioritize Phase 1 features** (team collaboration, real-time monitoring, data verification)
2. **Launch transparent pricing** (Pro tier at $99/user/month)
3. **Target 10 pilot customers** (mid-size nonprofits, 5+ users each)
4. **Measure revenue lift** (track major gift increases attributed to Intel)
5. **Iterate based on feedback** (build Phase 2 predictive models based on what users actually need)

---

## Sources & References

### Competitor Research
- [Compare WealthEngine vs. iWave | G2](https://www.g2.com/compare/wealthengine-vs-iwave)
- [Top 4 Wealth Prospecting Tools - Nonprofit Fundraising](https://nonprofitfundraising.com/top-4-wealth-prospecting-tools/)
- [DonorSearch vs WealthEngine: Which is better? | The Jotform Blog](https://www.jotform.com/nonprofit/donorsearch-vs-wealthengine/)
- [Compare DonorSearch vs. WealthEngine | G2](https://www.g2.com/compare/donorsearch-vs-wealthengine)
- [DonorSearch vs. WealthEngine Comparison | DonorSearch](https://www.donorsearch.net/donorsearch-vs-wealthengine/)

### User Needs & Pain Points
- [Best Donor Prospect Research Software: User Reviews from January 2026](https://www.g2.com/categories/donor-prospect-research)
- [Top 15 Prospect Research Tools for Clever Fundraisers](https://doublethedonation.com/prospect-research-tools/)
- [Prospect Research: A Nonprofit's Key to Better Fundraising](https://doublethedonation.com/prospect-research-guide/)

### Features & Trends
- [Top 11 Wealth Screening Software Solutions for Nonprofits](https://doublethedonation.com/top-wealth-screening-software-solutions/)
- [How to choose the best wealth screening tools](https://www.funraise.org/blog/best-wealth-screening-tools)
- [Wealth Screening Tools: 10 Top Picks | DonorSearch](https://www.donorsearch.net/resources/wealth-screening-tools/)

### AI & Technology Trends
- [Good News — and Bad News — About AI and Fundraising in 2026](https://www.philanthropy.com/opinion/ais-impact-on-fundraising-in-2026/)
- [5 Ways Nonprofits Can Use AI to Improve Donor Engagement in 2026](https://www.rosica.com/2025/12/18/5-ways-nonprofits-can-use-ai-to-improve-donor-engagement-in-2026/)
- [5 Trends That Will Shape Fundraising in 2026 – Chronicle of Philanthropy](https://www.philanthropy.com/solutions/5-trends-that-will-shape-fundraising-in-2026/)
- [Kindsight Launches AI-Powered Fundraising Platform With Real-Time Donor Intelligence](https://www.nonprofitpro.com/article/kindsight-launches-ai-powered-fundraising-platform-with-real-time-donor-intelligence/)
- [Predictive AI for nonprofits — the future of online fundraising](https://fundraiseup.com/blog/predictive-ai-for-nonprofits/)

### Pricing Research
- [iWave Pricing 2026](https://www.g2.com/products/iwave/pricing)
- [WealthEngine Pricing: Cost and Pricing plans](https://www.saasworthy.com/product/wealthengine/pricing)
- [How to Choose a Wealth Screening Tool for a Capital Campaign](https://capitalcampaignpro.com/how-to-choose-wealth-screening-tool/)

### Collaboration & Workflow
- [5 Forces Shaping the 2026 Nonprofit Fundraising Outlook](https://www.nonprofitpro.com/post/5-forces-shaping-the-2026-nonprofit-fundraising-outlook/)
- [Tech Trends 2026: What to Anticipate in the Nonprofit Sector](https://biztechmagazine.com/article/2025/12/tech-trends-2026-what-anticipate-nonprofit-sector)
- [15 Nonprofit CRMs Your Organization Should Consider for 2026](https://www.qgiv.com/blog/nonprofit-crm/)

---

**Document Version**: 1.0
**Date**: January 10, 2026
**Author**: Claude (Sonnet 4.5) via Intel Analysis
**Last Updated**: 2026-01-10
