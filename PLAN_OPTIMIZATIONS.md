# Plan

READ FIRST: Here's the plan @PLAN_OPTIMIZATIONS.md and I need you to follow this plan w/ these in mind: Do not bring forth any breaking changes. Make sure all changes are production-ready, non-breaking and do not cause visual, functional or performance bugs.  In-terms of adding a feature, make sure that it looks good and matches the existing styling / UI - use the playwright MCP to browse the app and see how it looks. If you need a component, use it from within this app but if you need something more, take it from either:
https://motion-primitives.com/docs or https://github.com/ibelick/prompt-kit.  

Also, for optimizations of the streaming AI responses, read the https://ai-sdk.dev/docs & any other such resources, if related to this app. and if you believe that it is possible, without any breaking changes, update this to Vercel AI SDK V6. 

Refer to @zola/ folder, for that used to be the original, stable codebase - if you need any references, use that.

REMEMBER: before proceeding w/ any plans or changes, always analyze and understand the codebase. Do not bring forth any breaking changes. Make sure all changes are production-ready, non-breaking and do not cause visual, functional or performance bugs. No existing or upcoming feature should be broken, it has to be production-ready.

I want you to think like a senior software engineer, to build enterprise-built, production-ready, non-breaking and performant code.

- [] Task 1 - Optimize our prompts w/ the below few notes:

Now I have comprehensive information to provide a detailed answer. Let me generate the final response.

# Economic-Adjusted Capital Campaign Ask Formula for Rōmy
As a 20-year CCS veteran, I understand that your current formula has a fundamental flaw: **it assumes donors budget for philanthropy first, when in reality, charitable giving is the last financial decision they make**. Donors don't start their year thinking "I'll give away 2% of my net worth." They think about paying taxes, covering living expenses, servicing debt, saving for retirement, enjoying discretionary spending—and *then*, if anything is left, they consider charity.

Let me give you a formula that reflects this reality and responds to market conditions.

## The Core Problem with Traditional Formulas
Your current approach ($10M net worth × 2% = $200,000 ÷ organizations = capital ask) makes three dangerous assumptions:[1][2][3]

1. **All net worth is liquid and accessible** for giving
2. **Donors prioritize charity** in their budgeting decisions
3. **Economic conditions don't affect** giving capacity

Research from 2024-2025 shows these assumptions are false. Charitable giving reached $592.5 billion in 2024, growing just 3.3% when adjusted for inflation. More critically, **donor participation dropped 4.5%**—fewer people are giving, even as total dollars rise. This signals that charity competes poorly against other uses of money in uncertain economic times.[4][5]
## The New Formula: Economic-Adjusted Capital Campaign Ask
**Formula:**
\[
\text{Capital Campaign Ask} = \text{ADI} \times \text{EAF} \times \text{CPR} \times \text{OAS} \times \text{CY} \times \text{CS}
\]

### Component Definitions
**ADI (Annual Discretionary Income)** — The actual cash available after mandatory obligations:
\[
\text{ADI} = (\text{Annual Income} \times (1 - \text{Tax Rate})) - \text{Essential Expenses} - \text{Debt Service}
\]

- **Annual Income**: Estimate 4-6% of net worth for investment income plus salary[6]
- **Tax Rate**: 20-40% depending on wealth bracket[7][8]
- **Essential Expenses**: Housing, food, healthcare, insurance (35-70% of disposable income)[8][7]
- **Debt Service**: Mortgage, loans, credit cards (5-15% of disposable income)[9][10][11]

**EAF (Economic Adjustment Factor)** — Reflects current market conditions:
\[
\text{EAF} = \text{Inflation Adjustment} \times \text{Interest Rate Factor} \times \text{Consumer Confidence Factor}
\]

- **Inflation Adjustment**: \(1 - (\text{CPI} \times 0.60)\)
  - Current inflation (2.8% as of late 2024): 0.983 adjustment[4][7]
  - Higher inflation reduces discretionary spending power[12][13]
  
- **Interest Rate Factor**: 0.90-0.99 based on federal funds rate[14][15]
  - Current environment (4.5-4.75%): 0.97 factor
  - High rates create opportunity cost for charitable giving[15][16]
  
- **Consumer Confidence Factor**: 0.65-1.00 based on Conference Board CCI[17][18][19]
  - Current declining confidence (CCI ~98-100): 0.92 factor
  - When confidence drops, recurring giving churn increases 3-4 percentage points[17]

**CPR (Charitable Propensity Rate)** — Percentage of adjusted discretionary allocated to ALL charity:

This is the critical insight: **charity competes last for dollars**. After taxes, essentials, debt, savings goals, and discretionary consumption, donors allocate 15-25% of remaining discretionary cash to philanthropy:[20][21][22]

- **Low-wealth (<$2M)**: 10-18% propensity
- **Mid-wealth ($2M-$10M)**: 15-25% propensity  
- **High-wealth (>$10M)**: 20-30% propensity

Research shows median wealthy households (income $200K+ or assets $1M+) gave 3.4% of income from 2007-2011, but this is of *total* income, not discretionary cash. When properly calculated from true discretionary resources, the rate is 15-25%.[23][7][20]

**OAS (Organization Allocation Share)** — Your slice of their total charitable capacity:

Most donors support 3-8 organizations plus a primary religious institution:[24][25][26]

\[
\text{Your Share} = \frac{1 - \text{Primary Charity %}}{(\text{Number of Organizations})}
\]

Example: If donor supports church (12% allocation) plus 5 other orgs: Your share = (1 - 0.12) ÷ 5 = 17.6%

**CY (Campaign Years)** — Duration of capital campaign:
- Standard: 3 years for campaigns <$5M[27][28]
- Extended: 5 years for major campaigns >$5M[29][27]

**CS (Commitment Strength)** — Historical pledge fulfillment rate:
- Strong relationships: 90-95%[30][27]
- Average relationships: 85-90%
- New major donors: 80-85%

## Implementation Example: $10M Net Worth Donor
Let me walk through a realistic scenario using current 2024-2025 economic conditions:

**Donor Profile:**
- Net Worth: $10,000,000
- Estimated Income: $500,000 (5% of net worth)
- Age: 55, married
- Supports: Church + 4 nonprofits

**Step 1: Calculate ADI**
```
Gross Income:                    $500,000
Taxes (30%):                    -$150,000
Disposable Income:               $350,000

Essential Expenses (55%):       -$192,500
Debt Service (8%):               -$28,000

Gross Discretionary Cash:        $129,500
```

**Step 2: Apply Economic Adjustments (EAF)**
```
Current Conditions (Q4 2024):
  Inflation: 2.8% → Adjustment = 0.983
  Interest rates: 4.75% → Factor = 0.97
  Consumer confidence: CCI ~98 → Factor = 0.92

EAF = 0.983 × 0.97 × 0.92 = 0.878

Economic-Adjusted Discretionary: $129,500 × 0.878 = $113,624
```

**Step 3: Apply Charitable Propensity (CPR)**
```
Charitable Propensity Rate: 20% (mid-wealth donor)

Annual Charitable Capacity: $113,624 × 0.20 = $22,725
```

**Step 4: Organization Allocation (OAS)**
```
Church allocation (12%):        $2,727
Remaining for 4 orgs:           $19,998
Per organization:               $4,999 ≈ $5,000
```

**Step 5: Capital Campaign Multiplier**
```
Campaign duration: 3 years
Commitment strength: 90%

Capital Campaign Ask: $5,000 × 3 × 0.90 = $13,500

RECOMMENDED ASK: $13,500
```
**Comparison with Traditional Method:**
- **Traditional formula**: $10M × 2% ÷ 5 orgs × 3 years = **$120,000**
- **Economic-adjusted formula**: **$13,500**
- **Difference**: 89% lower

This dramatic difference reflects reality. Your traditional formula assumes the donor has $200,000 per year in charitable capacity. The economic-adjusted approach recognizes they actually have ~$22,700 after competing with all other financial obligations and economic pressures.[13][7][8]

## Variable Ranges by Donor Wealth Segment
| **Variable** | **Low-Wealth (<$2M)** | **Mid-Wealth ($2M-$10M)** | **High-Wealth (>$10M)** |
|--------------|----------------------|---------------------------|-------------------------|
| **Effective Tax Rate** | 18-25% | 25-35% | 32-40% |
| **Essential Expenses** | 65-75% of disposable | 50-65% of disposable | 35-50% of disposable |
| **Debt Service** | 10-15% of disposable | 8-12% of disposable | 5-8% of disposable |
| **Inflation Impact** | High (0.85-0.92) | Moderate (0.92-0.96) | Low (0.96-0.99) |
| **Consumer Confidence** | 0.80-0.90 | 0.88-0.95 | 0.92-0.98 |
| **Charitable Propensity** | 10-18% | 15-25% | 20-30% |
| **Campaign Duration** | 3 years | 3-5 years | 3-5 years |

Lower-wealth donors are hit harder by economic uncertainty because essentials consume more of their budget. Ultra-high-net-worth donors (>$50M) may give closer to traditional percentages because essentials are negligible and tax/legacy planning dominate.[31][32][33][7][12]

## Real-Time Economic Variables to Track
Update these quarterly in Rōmy's platform:

1. **Consumer Price Index (CPI)** — Current: ~2.8%[5][4]
   - Source: U.S. Bureau of Labor Statistics
   - Directly reduces discretionary spending power[12][13]

2. **Consumer Confidence Index (CCI)** — Current: ~98-100[18][19]
   - Source: Conference Board  
   - Declining confidence increases donor churn by 3-4 percentage points[17]

3. **Federal Funds Rate** — Current: 4.50-4.75%[16][15]
   - Source: Federal Reserve
   - Higher rates create opportunity cost for giving[14][15]

4. **Unemployment Rate** — Current: ~3.7-4.1%
   - Source: Bureau of Labor Statistics
   - Rising unemployment signals economic stress

5. **Personal Savings Rate** — Current: ~4-5%[34][23]
   - Source: Bureau of Economic Analysis
   - Low savings rates indicate tight household budgets

6. **Household Debt Service Ratio** — Current: ~8.1%[10][11][9]
   - Source: Federal Reserve
   - Average household allocates 8-10% of disposable income to debt

## Sensitivity Analysis: Economic Conditions Impact
| **Scenario** | **Inflation** | **Consumer Conf.** | **Interest Factor** | **Charitable Prop.** | **Ask Amount** |
|--------------|---------------|-------------------|-------------------|---------------------|---------------|
| **Strong Economy** | 1.5% | 1.00 | 0.98 | 25% | $27,500 |
| **Current (Q4 2024)** | 2.8% | 0.92 | 0.97 | 20% | $13,500 |
| **Mild Recession** | 4.5% | 0.80 | 0.95 | 15% | $8,500 |
| **Severe Downturn** | 7.0% | 0.65 | 0.90 | 10% | $4,500 |

This shows how your ask amounts should flex with economic reality. In 2024, giving increased only because the stock market soared 20%—but consumer confidence declined and donor counts dropped. Your formulas must account for this disconnect.[35][13][4][17]

## Why This Approach Works
### 1. Grounded in Household Finance Reality
The formula follows the actual hierarchy of household spending decisions:[7][8][23]
- First: Taxes (mandatory)
- Second: Essential expenses (housing, food, healthcare)
- Third: Debt service (contractual obligations)  
- Fourth: Savings and discretionary consumption
- **Last: Charitable giving** (competes with vacations, luxury goods, investments)

### 2. Economically Responsive
Automatically adjusts for macroeconomic conditions that affect giving:[13][4][17]
- Inflation erodes discretionary spending power by 60-80%[7][12]
- Interest rates create opportunity cost for capital allocation[15][16][14]
- Consumer confidence directly correlates with donor retention[18][17]

### 3. Wealth-Segment Specific
Different parameters for different wealth levels:[32][6][20]
- Low-wealth donors are highly sensitive to economic shocks
- High-wealth donors have greater resilience and flexibility
- Ultra-high net worth (>$50M) may approach traditional 2% giving for tax reasons

### 4. Validated by Research
Industry data supports every component:[2][3][26][1][4]
- Median wealthy households give 3.4% of income (not net worth)[20]
- Giving capacity estimates are over 5 years, not single-year[26][36][6]
- Economic uncertainty reduces giving by 10-30%[33][13][17]

## Integration into Rōmy Platform
**Donor Profile Inputs:**
- Net worth (estimated via wealth screening)
- Annual income (estimated or user-provided)
- Age/life stage
- Family structure  
- Known financial obligations
- Number of charitable organizations supported
- Primary religious/charitable institution (Y/N)

**Auto-Updated Economic Context:**
- Current CPI (monthly update)
- Consumer Confidence Index (monthly)
- Federal Funds Rate (after FOMC meetings)
- Economic climate assessment (quarterly)

**Output:**
- Recommended Annual Fund Ask
- Recommended Major Gift Ask
- Recommended Capital Campaign Ask (3-year)
- Recommended Capital Campaign Ask (5-year)
- Confidence interval (±15-20%)
- Sensitivity display under different economic scenarios



## Critical Advantages Over Current Approach
1. **Reduces Over-Asking**: Your current formula can produce asks 5-10x too high, which damages donor relationships and creates pledge defaults[24][29][4]

2. **Respects Donor Reality**: Acknowledges charity competes against spending, saving, and debt—not just other charities[33][12][7]

3. **Accounts for Economic Cycles**: Automatically adjusts for inflation, rates, and confidence without manual intervention[4][13][17]

4. **Defensible and Transparent**: Based on established economic indicators, not arbitrary percentages[10][23][34]

5. **Improves Donor Retention**: Right-sized asks build trust and reduce attrition[37][29][17]

## Important Limitations
1. **Best for $2M-$50M net worth donors** — Ultra-high net worth individuals may give closer to traditional percentages for tax/legacy reasons[31][32]

2. **Assumes steady-state finances** — One-time liquidity events (stock sale, inheritance) can temporarily increase capacity 3-10x[6]

3. **Affinity can override economics** — Deeply committed donors may give 30-50% more than formula suggests[38][2][6]

4. **Corporate/foundation giving different** — Institutional donors follow different logic and require separate formulas[5][4]

5. **Annual recalibration needed** — Economic variables must be updated quarterly for accuracy[19][34][4]

## Final Recommendation
Replace your current capital campaign formula with:

\[
\text{Ask} = \text{ADI} \times \text{EAF} \times \text{CPR} \times \text{OAS} \times \text{CY} \times \text{CS}
\]

Where ADI recognizes that **charity competes last** for donor dollars—after taxes, essential expenses, debt service, economic uncertainty, savings goals, and discretionary consumption.

This approach will:
- Produce asks 50-90% lower for mid-wealth donors in current economic conditions
- Automatically adjust as inflation, interest rates, and confidence change
- Reduce over-asking and improve pledge fulfillment rates
- Position Rōmy as the most economically sophisticated donor intelligence platform in the market

The key insight: **Most people do not think about philanthropy first in their budget but rather last**. Your formula should reflect that reality, not wishful thinking about how donors *should* behave.

[1](https://www.ccsfundraising.com/insights/fundraising-forecasting/)
[2](https://artsconsulting.com/arts-insights/building-data-driven-individual-donor-prospecting-strategies-with-wealth-screening/)
[3](https://www.wildapricot.com/blog/donor-wealth-screening)
[4](https://www.bwf.com/giving-usa-2025-report-insights/)
[5](https://givingusa.org/giving-usa-2025-u-s-charitable-giving-grew-to-592-50-billion-in-2024-lifted-by-stock-market-gains/)
[6](https://kindsight.io/resources/blog/donor-capacity-insights/)
[7](https://corporatefinanceinstitute.com/resources/wealth-management/discretionary-income/)
[8](https://www.stlouisfed.org/open-vault/2025/aug/primer-discretionary-income)
[9](https://www.synovus.com/personal/resource-center/monthly-trust-newsletters/2023/june/macro-views-us-household-debt-and-credit/)
[10](https://fred.stlouisfed.org/graph/?g=ceh7)
[11](https://www.federalreserve.gov/releases/DSR/about.htm)
[12](https://eprajournals.com/IJMR/article/16567)
[13](https://www.nonprofitpro.com/post/the-effect-of-inflation-on-charitable-giving/)
[14](https://www.reninc.com/blog/charitable-giving-in-the-era-of-high-interest-rates/)
[15](https://giving.duke.edu/blueprints/what-do-rising-interest-rates-mean-for-charitable-giving/)
[16](https://www.seattlefoundation.org/interesting-ways-that-interest-rates-affect-charitable-gifts/)
[17](https://www.dataro.io/blog/the-impact-of-consumer-confidence-on-recurring-giving-churn)
[18](https://www.linkedin.com/pulse/navigating-economic-uncertainty-future-charitable-giving-tom-barry-w2tmc)
[19](https://givinginstitute.org/the-economic-indicators-fundraisers-should-be-watching/)
[20](https://www.philanthropyroundtable.org/almanac/who-gives-most-to-charity/)
[21](https://nonprofitssource.com/online-giving-statistics/)
[22](https://www.philanthropyroundtable.org/almanac/statistics-on-u-s-generosity/)
[23](https://diversification.com/term/personal-savings-rate)
[24](https://www.ccsfundraising.com/insights/writing-a-compelling-case-for-support-four-steps-for-getting-started/)
[25](https://www.ccsfundraising.com/insights/five-steps-to-the-big-ask-how-to-prepare-donors-to-receive-a-big-gift-request/)
[26](https://capitalcampaignpro.com/how-to-choose-wealth-screening-tool/)
[27](https://capitalcampaignpro.com/modern-capital-campaign-fundraising/)
[28](https://capitalcampaignpro.com/podcast-how-to-build-an-effective-gift-range-chart/)
[29](https://nonprofitfundraising.com/the-focus-method-a-step-by-step-framework-for-major-gift-asks-that-close/)
[30](https://info.amphil.com/blog/how-to-build-and-use-a-gift-chart-for-fundraising-strategy)
[31](https://www.forbes.com/sites/forbeswealthteam/2025/02/03/americas-most-generous-philanthropists-2025/)
[32](https://www.bridgespan.org/insights/how-americas-most-generous-philanthropists-are-giving-big)
[33](https://www.goodhub.com/insights/the-cost-of-living-crisis-impacting-donors-fundraising/)
[34](https://www.bea.gov/news/blog/2017-08-21/measuring-how-much-people-save-inside-look-personal-saving-rate)
[35](https://orrgroup.com/giving-usa-2025-report-what-the-data-tells-us-and-where-we-go-from-here/)
[36](https://www.jenniferfilla.com/net-worth-vs-capacity-whats-the-difference-and-why-should-you-care/)
[37](https://virtuous.org/blog/ask-amounts/)
[38](https://phoenixphilanthropy.com/resource/capacity-propensity-and-readiness-three-key-elements-in-fundraising-success/)
[39](https://www.semanticscholar.org/paper/9bfc66e791b3edfc2d095730267329ba5fa12e79)
[40](http://www.scs-europe.net/dlib/2016/2016-0198.htm)
[41](https://www.semanticscholar.org/paper/a84d2563c816f6be3bc89771aa62568dc4b21769)
[42](http://arxiv.org/pdf/2407.09480.pdf)
[43](http://arxiv.org/pdf/2402.14111.pdf)
[44](https://www.mdpi.com/2227-7390/9/21/2757/pdf?version=1636439024)
[45](https://arxiv.org/pdf/2010.14389.pdf)
[46](https://www.jmir.org/2020/11/e19715/PDF)
[47](https://onlinelibrary.wiley.com/doi/pdfdirect/10.1002/nml.21495)
[48](https://arxiv.org/pdf/1912.12016.pdf)
[49](https://zenodo.org/record/1120765/files/10.5755_j01.ee.28.1.15422.pdf)
[50](https://www.ccsfundraising.com/services/fundraising-campaigns/)
[51](https://www.ccsfundraising.com/insights-list/page/7/)
[52](https://www.ccsfundraising.com/services/fundraising-campaigns/planning-feasibility/)
[53](https://www.ccsfundraising.com/insights/strategic-fundraising-planning-using-a-balcony-and-front-row-framework/)
[54](https://kindsight.io/resources/blog/wealth-screening-guide/)
[55](https://www.ccsfundraising.com/insights/capital-campaigns-101-a-primer-for-volunteers-and-staff/)
[56](https://www.insightfulphilanthropy.com/blog/wealth-screening-for-nonprofits)
[57](https://www.barrons.com/articles/charity-donation-wealthy-economy-family-5f4d2efe)
[58](https://www.ccsfundraising.com)
[59](https://journalhosting.ucalgary.ca/index.php/sppp/article/view/42503)
[60](https://www.tandfonline.com/doi/full/10.1080/00036846.2024.2337812)
[61](https://www.federalreserve.gov/econres/notes/feds-notes/a-better-way-of-understanding-the-u-s-consumer-decomposing-retail-spending-by-household-income-20241011.html)
[62](http://rreconomic.ru/journal/annotation/2792/)
[63](https://www.bostonfed.org/publications/research-department-working-paper/2022/government-transfers-and-consumer-spending-among-households-with-children-during-covid19.aspx)
[64](https://www.allfinancejournal.com/archives/2024.v7.i2.362)
[65](https://jurnal.unived.ac.id/index.php/er/article/view/4567)
[66](https://vz.kneu.ua/archive/2024/37(4).11)
[67](https://iopscience.iop.org/article/10.1088/1755-1315/1415/1/012058)
[68](https://pmc.ncbi.nlm.nih.gov/articles/PMC2988056/)
[69](https://www.sociologicalscience.com/download/vol-3/august/SocSci_v3_650to684.pdf)
[70](https://academic.oup.com/ej/article-pdf/127/605/F24/26495717/ej0f24.pdf)
[71](https://www.tandfonline.com/doi/pdf/10.1080/00036846.2023.2267823?needAccess=true)
[72](https://arxiv.org/abs/1705.03848)
[73](https://pmc.ncbi.nlm.nih.gov/articles/PMC8507509/)
[74](https://ojs.amhinternational.com/index.php/jebs/article/download/2504/1716)
[75](https://drpress.org/ojs/index.php/fbem/article/download/8086/7864)
[76](https://www.investopedia.com/terms/d/discretionaryincome.asp)
[77](https://www.businessinsider.com/personal-finance/investing/discretionary-income)
[78](https://www.bankrate.com/loans/student-loans/calculate-discretionary-income/)
[79](https://finance.yahoo.com/news/survey-30-donors-amount-donated-130000100.html)
[80](https://www.compoundrealestatebonds.com/blog/discretionary-income-vs-disposable-income-and-example)
[81](https://www.gwi.com/blog/giving-back-consumers-charitable-behaviors-in-2021)
[82](https://www.kiplinger.com/retirement/how-high-interest-rates-enhance-a-type-of-charitable-trust)
[83](https://financialtips.bankatpeoples.com/money-management/budgeting/article/discretionary-income-vs-disposable-income)
[84](https://www.bea.gov/data/income-saving/disposable-personal-income)
[85](https://charitablesolutionsllc.com/2022/07/shifting-gears-rising-inflation-and-interest-rates-impact/)
[86](https://home.uchicago.edu/~kanit/kanitk/Teaching_(UW-Madison)/Entries/2015/1/21_ECON_102__Principles_of_Macroeconomics(Spring_2015)_files/handout7.pdf)
[87](https://www.sciencepublishinggroup.com/article/10.11648/j.eco.20251404.12)
[88](https://repositorio.banrep.gov.co/bitstream/handle/20.500.12134/11152/Monetary-Policy-Report-January-2025.pdf)
[89](https://repositorio.banrep.gov.co/bitstream/handle/20.500.12134/11142/inf-jun-dir-con-rep-eng.01-2025.pdf)
[90](https://repositorio.banrep.gov.co/bitstream/handle/20.500.12134/10780/monetary-policy-january-2024.pdf)
[91](https://journalajeba.com/index.php/AJEBA/article/view/2064)
[92](https://repositorio.banrep.gov.co/bitstream/handle/20.500.12134/11170/inf-pol-mont-eng.tr2-2025.pdf)
[93](https://eahrj.eahealth.org/eah/article/view/816)
[94](https://www.frontiersin.org/articles/10.3389/fpubh.2025.1666694/full)
[95](https://public.scnchub.com/efmr/index.php/efmr/article/view/345)
[96](https://repositorio.banrep.gov.co/bitstream/handle/20.500.12134/10744/monetary-policy-october-2023.pdf)
[97](https://pmc.ncbi.nlm.nih.gov/articles/PMC6169901/)
[98](https://pmc.ncbi.nlm.nih.gov/articles/PMC10371270/)
[99](https://www.mdpi.com/2076-3387/4/3/350/pdf?version=1409215809)
[100](https://www.emerald.com/insight/content/doi/10.1108/CAFR-05-2022-0060/full/pdf?title=a-self-interested-gesture-corporate-charitable-giving-in-response-to-government-fiscal-pressure)
[101](https://pmc.ncbi.nlm.nih.gov/articles/PMC10983681/)
[102](https://assets.cureus.com/uploads/review_article/pdf/183815/20231012-2494-hlpui1.pdf)
[103](https://journals.sagepub.com/doi/pdf/10.1177/08997640241254079)
[104](https://www.ccsfundraising.com/insights/perspectives-on-philanthropy-giving-usa-2025/)
[105](https://foundationsource.com/blog/from-foundations-to-dafs-key-takeaways-from-giving-usas-2025-report-on-philanthropy/)
[106](https://theangelettigroup.com/giving-usa-2025-report-trends-and-fundraising-insights-for-nonprofits/)
[107](https://donr.com/blog/the-impact-of-the-cost-of-living-crisis-on-charitable-giving)
[108](https://grantsplus.com/insights/blog/uncategorized/beneath-the-headlines-what-giving-usa-2025-really-means-for/)
[109](https://www.amyeisenstein.com/how-to-determine-the-right-ask-amount-when-asking-donors-for-gifts/)
[110](https://go.givecampus.com/blog/advancement-trends-dollars-up-donors-down/)
[111](https://doublethedonation.com/nonprofit-fundraising-statistics/)
[112](https://www.cafonline.org/home/about-us/press-office/cost-of-living-squeeze-nearly-5m-people-chose-not-to-make-a-one-off-charity-donation)
[113](https://philanthropy.indianapolis.iu.edu/news-events/news/_news/2024/giving-usa-us-charitable-giving-totaled-557.16-billion-in-2023.html)
[114](http://www.emerald.com/ijrdm/article/52/1/107-124/1232599)
[115](https://journals.sagepub.com/doi/10.1509/jmr.14.0455)
[116](https://aircconline.com/csit/papers/vol14/csit140401.pdf)
[117](https://www.ijfmr.com/research-paper.php?id=55972)
[118](https://www.semanticscholar.org/paper/83e83e579c366f5c969340594d0cdb88ebd6cc19)
[119](https://www.semanticscholar.org/paper/6e4dbe9a7d70933c24adc63aa43dc069fb33bafd)
[120](https://onlinelibrary.wiley.com/doi/10.1111/j.1475-5890.1990.tb00138.x)
[121](https://www.ssrn.com/abstract=2966094)
[122](https://www.semanticscholar.org/paper/18d153bfd6bf0e64e7f4d930c5ce6d1beeabf1a9)
[123](https://www.granthaalayahpublication.org/Arts-Journal/ShodhKosh/article/view/6218)
[124](http://arxiv.org/pdf/2005.02379.pdf)
[125](https://downloads.hindawi.com/archive/2014/454675.pdf)
[126](https://academic.oup.com/oep/article-pdf/69/4/1101/20502031/gpx024.pdf)
[127](https://www.lendingclub.com/glossary/s/savings-rate)
[128](https://www.ibisworld.com/united-states/bed/personal-savings-rate/348/)
[129](https://www.reddit.com/r/financialindependence/comments/3iiknr/rfi_we_need_to_settle_this_how_to_calculate/)
[130](https://data.bis.org/topics/DSR)
[131](https://digitalcommons.usu.edu/cgi/viewcontent.cgi?article=1730&context=gradreports)
[132](https://savology.com/savings-rate-what-is-it-and-why-is-it-important)
[133](https://www.ccsfundraising.com/insights/optimizing-major-gift-portfolios-using-predictive-modeling-scores/)
[134](https://alfred.stlouisfed.org/series?seid=PSAVERT)
[135](https://www.ceicdata.com/en/indicator/united-states/debt-service-ratio-households)
[136](https://www.fireflygiving.com/blog/maximize-donor-lifetime-value-strategic-charitable-impact-modeling-guide/)
[137](https://onlinelibrary.wiley.com/doi/pdfdirect/10.1002/bdm.2335)
[138](https://www.frontiersin.org/articles/10.3389/fpsyg.2022.768823/pdf)
[139](http://arxiv.org/pdf/2305.10286.pdf)
[140](https://pmc.ncbi.nlm.nih.gov/articles/PMC9848424/)
[141](https://www.frontiersin.org/articles/10.3389/fpsyg.2022.800528/pdf)
[142](https://pmc.ncbi.nlm.nih.gov/articles/PMC8936950/)
[143](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/09995867756FFAF8DD73430A393C021A/S1930297500007312a.pdf/div-class-title-the-many-obstacles-to-effective-giving-div.pdf)
[144](https://rr.peercommunityin.org/download/t_recommendations.reply_pdf.aeaad228652aaea3.50434952522d53312d524e52322d4261726f6e2d537a796d616e736b612d323031312d7265706c69636174696f6e2d657874656e73696f6e2d7265706c792d746f2d6465636973696f6e2d6c65747465722d726576696577732e706466.pdf)
[145](https://www.ccsfundraising.com/insights/major-gift-fundraising-process/)
[146](https://www.ccsfundraising.com/insights/combining-and-sequencing-donor-request-strategies/)
[147](https://www.ccsfundraising.com/insights/prospecting-donors-101/)
[148](https://www.ccsfundraising.com/insights/how-small-donors-become-major-donors-analyzing-major-donor-pathways/)
[149](https://www.ccsfundraising.com/insights/strengthening-donor-portfolio-with-data-analytics/)
[150](https://www.ccsfundraising.com/insights/2023-planned-giving-spotlight/)
[151](https://w.paybee.io/post/wealth-and-philanthropic-screening)
[152](https://www.ccsfundraising.com/insight/type/video/page/2/)
[153](https://npoinfo.com/wealth-screening/)
[154](https://www.youtube.com/watch?v=04m9e2aGPO8)
[155](https://www.bwf.com/prospects-high-living-areas/)
[156](https://www.ccsfundraising.com/insights/proposals-that-stand-out/)
[157](https://doublethedonation.com/wealth-screening-and-matching-gifts-guide/)
[158](https://www.funraise.org/blog/wealth-screening-vs-prospect-research)
[159](https://www.convergentnonprofit.com/blog/p/item/57786/wealth-screening-101-what-nonprofits-need-to-know)
[160](https://wealthscreeningservices.com/wp-content/uploads/2022/12/cheat-sheetds.pdf)

# RōmyScore Donor Evaluation Framework – Updated

## Overview

RōmyScore is a comprehensive donor scoring system that evaluates philanthropic capacity, commitment, and opportunity across four strategic dimensions:

1. **Foundation Attributes** (0–28 pts): Core wealth, giving history, business/asset structure
2. **Liquidity & Tax-Planning Indicators** (0–7 pts): Windfalls, distributions, and liquid events
3. **Opportunity & Commitment Indicators** (0–6 pts): Entrepreneurial track record, governance, legacy positioning
4. **Constraints & Headwinds** (−2 pts): Sector/policy challenges, education expenses that reduce near-term capacity

**Maximum RōmyScore: 41 points**  
**Minimum RōmyScore: 0 (constrained scores floor at 0, never negative)**

---

## Part 1: Foundation Attributes (0–28 Points)

These six core attributes form the baseline assessment of a donor's wealth, giving behavior, asset structure, and lifestyle indicators.

### 1.1 Net Worth & Giving Capacity (Max: 8 pts)
Assign points based on the highest realistic gift a donor could make over a 3-year capital campaign, assuming a 2% annual distribution of estimated net worth.

| Gift Range             | Points |
|------------------------|:------:|
| $10,000 – $25,000      |   2    |
| $25,000 – $100,000     |   3    |
| $100,000 – $500,000    |   4    |
| $500,000 – $5,000,000  |   6    |
| $5,000,000+            |   8    |

**Application:** Use IRS Form 990, property/business records, public wealth databases to estimate. Be conservative; err toward lower range if data is thin.

---

### 1.2 Charitable Behavior – Recency, Frequency, and Size (Max: 10 pts)
Reward demonstrated giving history, emphasizing recent and frequent gifts over isolated large gifts from years past.

| Giving Pattern                                    | Points |
|---------------------------------------------------|:------:|
| Recent major gift ($25,000+) in past 2 years     |   5    |
| Multiple annual gifts ($2,500+)                  |   3    |
| Gave within the last 3 years (cumulative record) |   2    |

**Application Rules:**
- Points are **cumulative** (e.g., someone with multiple annual gifts + recent major gift = 3 + 5 = 8 pts).
- Cap at 10 pts for this category.
- **Recency and frequency beat past size.** A donor with annual $5K gifts in the last 2 years scores higher than someone who gave $50K once in 2018.
- Data source: nonprofit donor database (client historical giving) initially; public records (VeriGift, foundation disclosures) added later.

---

### 1.3 Business Ownership & Control (Max: 4 pts)
Differentiate by ownership stake, business scale, and whether holdings are active or passive.

| Ownership Profile                                 | Points |
|---------------------------------------------------|:------:|
| No business ownership                            |   0    |
| Passive/minority (<10% stake)                    |   1    |
| Controlling stake, small business (<$1M sales)  |   2    |
| Controlling stake, mid-market ($1M–$10M sales)  |   3    |
| Enterprise/major shareholder ($10M+ or public)  |   4    |

**Special Rule – Multiple Business Ownership:**  
If a donor owns two or more businesses, **add 2 bonus points** (in addition to the primary business score) and **negate any penalty from modest home valuation.** This reflects the diversification, business acumen, and capacity signals.

**Application:** Business ownership is indexed to revenue/valuation and control. Founders score higher than non-founder executives. Active business interests score higher than passive holdings.

---

### 1.4 Real Estate Holdings – Count, Equity, and Value (Max: 3 pts)
Points increase with the number of properties owned and the equity/total value.

| Real Estate Profile                               | Points |
|---------------------------------------------------|:------:|
| Single property, mortgaged (modest valuation)    |   0    |
| Primary + vacation/rental, <$500K total equity   |   1    |
| 2–3 properties OR >$500K total equity            |   2    |
| 4+ properties OR $2M+ total equity               |   3    |

**Application Notes:**
- Primary residence valuation is LESS important than property count and total equity.
- Wealthy donors sometimes live in modest homes; the score reflects *portfolio* complexity, not home size.
- Count owner-occupied, vacation, investment, and commercial holdings.

---

### 1.5 Mortgage-Free Asset (Bonus: 1 pt)
Reward donors with at least one significant real estate asset owned free and clear.

| Mortgage Status                        | Points |
|----------------------------------------|:------:|
| Mortgage on all real estate holdings   |   0    |
| At least one mortgage-free asset       |   1    |

**Application:** This signals financial discipline and liquidity optionality.

---

### 1.6 Consumer/Discretionary Context (Max: 2 pts)
Capture lifestyle indicators that suggest above-average disposable income and luxury spending patterns.

| Spending Profile                                  | Points |
|---------------------------------------------------|:------:|
| Middle-class consumption patterns                 |   0    |
| Luxury travel, high-end brands, premium goods    |   1    |
| Ultra-luxury (e.g., private aviation, multiple luxury residences) |   2    |

**Application:** Use public records (aircraft ownership, yacht registry), lifestyle databases, credit/merchant data, travel booking patterns, and reported luxury purchases. This category adds nuance but is **secondary** to net worth and charitable behavior.

---

## Part 2: Liquidity & Tax-Planning Indicators (0–7 Points)

These four attributes identify donors with immediate or near-term liquidity events that unlock giving capacity.

### 2.1 Age 70.5+ (Required Minimum Distribution Eligible) (Max: 2 pts)

| Condition                              | Points |
|----------------------------------------|:------:|
| Donor age <70.5                        |   0    |
| Donor age ≥70.5                        |   2    |

**Rationale:** Donors at this age must take RMDs from qualified retirement accounts. Even if they don't need the distribution, they face tax penalty if they skip it. RMDs create forced liquidity and are a proven trigger for charitable giving (especially via QCDs—qualified charitable distributions).

**Application:** Flag automatically if age is known and >70.5.

---

### 2.2 Business Sale (Last 18 Months) (Max: 2 pts)

| Condition                              | Points |
|----------------------------------------|:------:|
| No recent business sale                |   0    |
| Business sold in past 18 months        |   2    |

**Rationale:** A recent exit creates significant liquidity. This is a **prime solicitation window** (6–24 months post-close). Founders and sellers often redirect proceeds to philanthropy.

**Application:** Monitor business/regulatory databases, founder networks, press releases. Prioritize these donors for major solicitation within 6–18 months post-exit.

---

### 2.3 Major Civil Settlement Award ($2M+) (Max: 2 pts)

| Condition                                      | Points |
|------------------------------------------------|:------:|
| No known major settlement                      |   0    |
| Civil court award or settlement >$2M           |   2    |

**Rationale:** Windfall events (large lawsuit settlements, inheritance, property sale windfall) dramatically increase near-term giving capacity.

**Application:** Screen public court records, estate/probate filings, and media. These are *high urgency* prospects for the 12–36 months following the award.

---

### 2.4 Donor-Advised Fund (DAF) Activity (Max: 1 pt)

| Condition                              | Points |
|----------------------------------------|:------:|
| No known DAF activity                  |   0    |
| History of DAF distributions/giving    |   1    |

**Rationale:** A donor with an active DAF has demonstrated intent to give away money and has structured giving for tax efficiency. DAF donors are reliable, recurring philanthropists.

**Application:** Screen DAF databases (Vanguard, Fidelity, Schwab), donor-advised fund registries, and nonprofit transaction records. These donors are predictable and relationship-rich.

---

## Part 3: Opportunity & Commitment Indicators (0–6 Points)

These four attributes identify donors with proven entrepreneurial success, governance involvement, and legacy-giving potential.

### 3.1 Multiple Business Ownership (2+) (Max: 2 pts)

| Condition                              | Points |
|----------------------------------------|:------:|
| Single business or none                |   0    |
| Two or more businesses owned           |   2    |

**Special Rule (from Foundation Attributes):**  
The 2 bonus points here ALSO negate any penalty from modest home valuation. A serial entrepreneur with a $300K home but multiple 7-figure businesses should score as a high-capacity donor.

**Rationale:** Multiple business ownership signals diversification, business acumen, risk tolerance, and repeated success. These founders are likely repeat philanthropists and major gift prospects.

---

### 3.2 Early-Stage Investment or Exit Success (Max: 2 pts)

| Condition                                            | Points |
|----------------------------------------------------|:------:|
| No known early-stage activity                      |   0    |
| Angel/seed investor; or founded/exited startup     |   2    |

**Rationale:** Entrepreneurs with a track record of successful early-stage ventures (founded a company that exited profitably, or made successful angel investments) are:
- Open to growth capital opportunities (they understand venture).
- Likely to reinvest proceeds into philanthropy.
- Connected to networks of other high-capacity donors.

**Application:** Screen LinkedIn, Crunchbase, AngelList, SEC filings (insider holdings), and founder networks. Early-stage winners are high-leverage prospects.

---

### 3.3 Foundation Board Service (Max: 1 pt)

| Condition                              | Points |
|----------------------------------------|:------:|
| Not on any foundation board            |   0    |
| Serves on family, community, or private foundation board |   1    |

**Rationale:** Board service signals deep philanthropic commitment, governance sophistication, and access to peer networks. These donors typically give more than non-board peers.

**Application:** Screen IRS Form 990 filings, foundation directories, and nonprofit staff knowledge.

---

### 3.4 Legacy Gift Indicator (Max: 1 pt)

| Condition                                       | Points |
|-----------------------------------------------|:------:|
| Does not meet criteria                        |   0    |
| Business owned 20+ years AND donor age 50+    |   1    |

**Rationale:** A donor who has owned a business for two decades and is 50+ is likely thinking about succession, legacy, and impact. They are prime candidates for planned gifts (bequests, life insurance, charitable remainder trusts) that can be transformational.

**Application:** Use business formation records (Secretary of State filings) and public age data. Engage these donors with planned giving education and major gift positioning.

---

## Part 4: Constraints & Headwinds (−2 Points Maximum Deduction)

These two attributes capture near-term capacity constraints that should lower the score, signaling timing challenges for solicitation.

### 4.1 Business Sector Headwind – Policy/Economic Impact (Max: −1 pt)

| Condition                                              | Points |
|-----------------------------------------------------|:------:|
| Business sector unaffected or thriving              |   0    |
| Business sector adversely affected by policy/economy | −1    |

**Rationale:** If a donor owns a business in a sector experiencing policy headwinds (e.g., energy if climate regs tightened, real estate if interest rates spike, healthcare if regulatory caps imposed), their business cash flow may be compressed. Lower near-term capacity.

**Application:** Requires judgment and periodic reassessment. You (as Rōmy) decide whether a sector is experiencing meaningful headwinds. Examples:
- Oil & gas company during aggressive climate policy environment.
- Small bank facing tightened lending regulations.
- Retail during e-commerce disruption.

**Do NOT apply if:** The business is diversified or the sector is recovering.

---

### 4.2 Education Cash Crunch – Private/High-Tuition School (Max: −1 pt)

| Condition                                                     | Points |
|-------------------------------------------------------------|:------:|
| No school-age/college-age children, or public school only    |   0    |
| School-age or college-age children in private/high-tuition school | −1   |

**Rationale:** Parents with children in private K–12 schools ($15K–$50K+ annually) or high-tuition colleges ($60K–$90K+ annually) face significant cash flow compression. Their discretionary giving capacity is temporarily reduced.

**Application:** 
- Screen public records, school enrollment databases, and donor profiles.
- Apply only while children are actively enrolled.
- Remove the deduction once the child graduates.

**Timing Note:** This is a temporary constraint, not permanent. Revisit annually as children advance through school.

---

## Part 5: Score Calculation & Interpretation

### Scoring Formula

```
RōmyScore = 
  [Foundation Attributes (0–28)]
  + [Liquidity & Tax-Planning (0–7)]
  + [Opportunity & Commitment (0–6)]
  − [Constraints & Headwinds (0–2)]

Maximum: 41 points
Minimum: 0 (floor; never negative)
```

### Strategic Score Bands

Use these bands to prioritize prospect lists and solicitation strategy:

| Score Band | Classification | Solicitation Strategy |
|------------|-----------------|----------------------|
| **0–10** | Emerging/Low-Capacity Prospect | Annual fund, stewardship, relationship-building. Not ready for major ask. |
| **11–20** | Mid-Capacity, Growth Potential | Leadership circle, annual fund asks up to $5K–$10K. Build relationship; track for growth. |
| **21–30** | High-Capacity Major Donor Target | Major gift solicitation ($25K–$500K range). Priority cultivation and stewardship. |
| **31–41** | Transformational/Windfall Opportunity | **URGENT.** Transformational solicitation ($500K+). Activate immediately; limit window to 12–36 months. |

---

## Part 6: Application Examples

### Example 1: Serial Entrepreneur (Age 55, Multiple Businesses)

**Data:**
- $3M net worth (estimated)
- Founded tech company (sold 5 years ago for $10M+)
- Currently owns two active businesses ($2M and $500K revenue)
- Age 55, board member of family foundation
- $30K gift last year, $25K two years ago
- Owns 3 investment properties, primary home ($800K), all with mortgages
- No DAF activity; no recent civil suit

**Score Calculation:**

| Category | Points |
|----------|--------|
| Net Worth ($3M) | 6 |
| Charitable Behavior (recent $30K + annual $25K) | 5 + 3 = 8 |
| Business Ownership (two active businesses, $2M+ scale) | 3 |
| Real Estate (3 properties, >$500K equity) | 2 |
| Mortgage-Free Asset | 0 |
| Consumer Context | 1 |
| **Foundation Subtotal** | **20** |
| Multiple Business Ownership | 2 |
| Early-Stage Success (founder + exit) | 2 |
| Foundation Board Service | 1 |
| Legacy Gift Indicator (55, businesses 15+ years) | 1 |
| **Opportunity Subtotal** | **6** |
| Liquidity/Tax (none active) | 0 |
| **Constraints** | 0 |
| **RōmyScore** | **26/41** |

**Interpretation:** High-capacity major donor. Ready for $100K–$250K solicitation. Consider planned giving positioning (legacy gifts via remainder trust or bequest).

---

### Example 2: Recently Exited Founder (Age 48, Business Sale 12 Months Ago)

**Data:**
- Sold business for $8M 12 months ago (net proceeds ~$5M post-tax)
- Age 48; no longer actively working
- One vacation home ($600K, mortgage-free)
- Primary residence ($400K, with mortgage)
- $50K gift 6 months post-exit
- Exploring early-stage investments; no DAF yet
- No foundation board service
- No documented civil suit

**Score Calculation:**

| Category | Points |
|----------|--------|
| Net Worth ($5M liquid + home equity) | 8 |
| Charitable Behavior (one $50K gift, recent) | 5 |
| Business Ownership (none current) | 0 |
| Real Estate (2 properties, ~$600K equity) | 1 |
| Mortgage-Free Asset | 1 |
| Consumer Context | 1 |
| **Foundation Subtotal** | **16** |
| Business Sale (last 18 months) | 2 |
| Early-Stage Investment (exploring) | 2 |
| RMD Eligible (age 48, no) | 0 |
| DAF Activity | 0 |
| **Liquidity Subtotal** | **4** |
| Foundation Board Service | 0 |
| Legacy Gift Indicator | 0 |
| **Opportunity Subtotal** | **0** |
| **Constraints** | 0 |
| **RōmyScore** | **20/41** |

**Interpretation:** Mid-to-high capacity; **prime solicitation window NOW (within 12–24 months of exit).** Recommend leadership/major gift ask ($50K–$250K). Highlight the opportunity to make an impact with recent proceeds. Track for DAF creation and foundation board opportunities.

---

### Example 3: Modest Home, Multiple Businesses (Age 52)

**Data:**
- Owns a primary home ($350K, with mortgage)
- Two operating businesses: e-commerce ($2.5M revenue) and consulting ($800K revenue)
- Estimated net worth ~$2M (based on business valuations)
- Age 52; owns both businesses 18+ years
- $5K annual gifts over past 3 years
- No recent major gift
- No civil suit; no DAF; no foundation board

**Score Calculation:**

| Category | Points |
|----------|--------|
| Net Worth ($2M) | 4 |
| Charitable Behavior (multiple $5K gifts, no major gift) | 3 |
| Business Ownership (two mid-market) | 3 |
| Real Estate (single property) | 0 |
| Mortgage-Free Asset | 0 |
| Consumer Context | 0 |
| **Foundation Subtotal** | **10** |
| Multiple Business Ownership (2 businesses) | 2 |
| Legacy Gift Indicator (52, 18+ yr businesses) | 1 |
| **Opportunity Subtotal** | **3** |
| **Liquidity/Tax** | **0** |
| **Constraints** | **0** |
| **RōmyScore** | **13/41** |

**Interpretation:** Mid-capacity emerging prospect. Multiple business ownership **negates the modest home penalty** and scores favorably. The 2-pt bonus for serial entrepreneurship unlocks legacy potential. Engage with planned giving education and annual fund asks. In 10–15 years (at RMD age), this donor becomes a major prospect.

---

### Example 4: High Net Worth + Education Crunch (Age 62)

**Data:**
- Net worth $4M
- One business (controlling, $3M revenue, 25 years old)
- Three investment properties, $1.2M total equity, all mortgaged
- $20K gift 3 years ago; no recent giving
- **Two children in college (high-tuition private universities, $80K/year combined)**
- Age 62, approaching RMD eligibility in 8 years
- No DAF; no foundation board; no civil suit

**Score Calculation:**

| Category | Points |
|----------|--------|
| Net Worth ($4M) | 6 |
| Charitable Behavior (old gift, no recent) | 2 |
| Business Ownership (controlling, $3M revenue) | 3 |
| Real Estate (3 properties, >$500K equity) | 2 |
| Mortgage-Free Asset | 0 |
| Consumer Context | 1 |
| **Foundation Subtotal** | **14** |
| Business (25 years) + Legacy Indicator (62) | 1 |
| **Opportunity Subtotal** | **1** |
| **Liquidity/Tax** | **0** |
| **Education Cash Crunch Penalty** | **−1** |
| **RōmyScore** | **14/41** |

**Interpretation:** Would be a high-capacity major donor (score ~15–16), but **education expenses create near-term cash flow constraints.** Suggest:
1. **Stewardship and annual fund focus now** (scores suggest $5K–$10K asks appropriate).
2. **Plan major solicitation for post-graduation** (2–4 years, when education expenses cease).
3. **Introduce planned giving** at next major life event (empty nest, business transition).
4. **Flag for RMD activation** at age 70.5 (8 years); that will unlock additional capacity.

---

## Part 7: Implementation & Data Sources

### Data Sources by Attribute

| Attribute | Primary Source | Secondary Source |
|-----------|----------------|------------------|
| Net Worth | Business records, property tax, IRS Form 990, wealth databases | LinkedIn, news, personal knowledge |
| Charitable Behavior | Nonprofit donor database, client records | VeriGift, GuideStar, foundation grants |
| Business Ownership | Secretary of State filings, business databases, LinkedIn | News, industry reports, personal network |
| Real Estate | County property records, tax assessor, MLS | Public records sites, credit reports |
| Mortgage Status | County recordings, title searches | Credit bureaus, lender filings |
| Consumer Context | Luxury registries (aircraft, yacht), travel data, social media | Merchant data, lifestyle databases |
| Age 70.5+ | Public records, driver's license, nonprofit donor files | Personal knowledge, tax filings |
| Business Sale | SEC filings, press releases, business news, founder networks | LinkedIn, Crunchbase, deal databases |
| Civil Settlement | Court records, news, legal databases | Public records, investigative news |
| DAF Activity | DAF registries (Vanguard, Fidelity), nonprofit records | IRS Form 990, donor databases |
| Foundation Board | IRS Form 990, foundation directories | Nonprofit staff knowledge |
| Education | School databases, public records, donor profiles | Personal knowledge, prospect research |

### Data Privacy & Compliance

- Always comply with state/federal privacy laws (GDPR, CCPA, etc.).
- Use only publicly available data or data provided by nonprofit clients.
- Do NOT use private financial data without explicit consent.
- Ensure data is regularly updated (annually minimum for all attributes).

---

## Part 8: Rōmy Competitive Differentiation

### Why RōmyScore Differs from iWave, Wealth Engine, DonorSearch

1. **Consumer/Life Context:** RōmyScore doesn't view donors in isolation. It captures business ownership, entrepreneurial success, family education decisions, and life-stage liquidity events (RMDs, exits, settlements). **Donors are people running businesses and families.**

2. **Recency & Behavioral Weighting:** While competitors weight raw net worth heavily, RōmyScore emphasizes *demonstrated behavior* (giving frequency and recency) over past size alone.

3. **Opportunity Windows:** RōmyScore flags specific high-urgency windows (post-exit, RMD-eligible, settlement-recipient) that surface *when* to ask, not just *who* to ask.

4. **Sector Headwinds & Life Constraints:** Dynamic adjustments for near-term capacity constraints (policy impacts, education expenses) that traditional models miss.

5. **Transparent, Actionable:** RōmyScore produces clear rationales for each point, making it easy for nonprofit teams to trust the score and act on it.

---

## Part 9: Version History & Future Enhancements

**Version 2.0 (Current)** – November 2025  
- Added Liquidity & Tax-Planning Indicators (RMD, exits, settlements, DAF).
- Added Opportunity & Commitment (multiple businesses, early-stage, board, legacy).
- Added Constraints & Headwinds (sector policy, education crunch).
- Expanded maximum from 30 to 41 points with strategic banding.

**Future Enhancements (Roadmap)**
- Public giving records integration (VeriGift, GiveWell, foundation grants).
- Faith-aligned giving patterns (for faith-based nonprofit clients).
- Predictive modeling (machine learning on donor giving propensity).
- Bequest intention signals (will-writing activity, end-of-life planning indicators).
- Donor event triggers (marriage, divorce, job change, relocation).

---

## Appendix: Quick Reference Sheet

| Category | Max | Key Triggers |
|----------|-----|--------------|
| Net Worth/Capacity | 8 | Wealth databases, 2% calculation |
| Charitable Behavior | 10 | Client donor DB; recent, frequent, $25K+ |
| Business Ownership | 4 | Secretary of State, LinkedIn, control + scale |
| Real Estate | 3 | Property records, count + equity |
| Mortgage-Free | 1 | Title search, at least one free asset |
| Consumer Context | 2 | Luxury registries, social media, lifestyle |
| RMD Eligible (70.5+) | 2 | Age ≥70.5 + retirement account ownership |
| Business Sale (18mo) | 2 | SEC, press, founder networks, deal DB |
| Civil Settlement | 2 | Court records, news, legal DB |
| DAF Activity | 1 | DAF registries, nonprofit records |
| Multiple Biz (2+) | 2 | Business registries, negates home penalty |
| Early-Stage Success | 2 | Crunchbase, founder networks, exits |
| Foundation Board | 1 | Form 990, foundation directories |
| Legacy (20yr+/50+) | 1 | Business age + age of donor |
| Sector Headwind | −1 | Policy analysis, economic outlook |
| Education Crunch | −1 | School enrollment, tuition tracking |

---

- [ ] Task 2 - Create a reward system

Especially designed for customers of the Growth Plan (who have limited lookups) who will typically be unsophisticated about research and wealth-screening, I have created 20 multiple-choice questions that could rotate by the day or also be available separately as an entire list at once. 

The goal with the questions is to give customers a fun way to earn extra look-ups and also be educated at the same time. The ultimate goal is customer success.

If they answer correctly they get maybe 5-10 extra lookups added to their account if they're on the Growth Plan. And maybe there's a max of 100 extra they can get each month.

Proposed questions and points:

# Fundraising Best Practices Multiple-Choice Quiz - REVISED

## For Rōmy Customer Education

**Total Questions:** 20

- **Basic:** 5 questions
- **Intermediate:** 9 questions
- **Advanced:** 6 questions

***

## QUESTION 1 | Basic Level | Donor Acknowledgment

**What is the ideal timeframe for sending a donor acknowledgment letter after receiving a gift?**

A) Within 7 days
B) Within 48 hours
C) Within 30 days
D) Within 2 weeks

**Correct Answer: B**

Research shows that donor acknowledgments should be sent within 48 hours of receiving a gift. This prompt response reassures donors that their gift was received and demonstrates appreciation, which is critical for donor retention.

***

## QUESTION 2 | Basic Level | Donor Retention

**What percentage of first-time donors typically give again to the same nonprofit?**

A) 45-50%
B) 60-65%
C) 19-24%
D) 35-40%

**Correct Answer: C**

Studies show that only 19-24% of first-time donors give again. This low retention rate emphasizes the critical importance of strong stewardship and thank-you processes for new donors.

***

## QUESTION 3 | Basic Level | Fundraising Strategy

**According to fundraising research, what percentage of total dollars raised typically comes from what percentage of donors?**

A) 50% of dollars from 25% of donors
B) 88% of dollars from 12% of donors
C) 75% of dollars from 20% of donors
D) 90% of dollars from 30% of donors

**Correct Answer: B**

The fundraising principle states that 88% of dollars raised comes from just 12% of donors. This demonstrates why major donor cultivation and retention must be a priority for nonprofits.

***

## QUESTION 4 | Basic Level | Thank You Best Practices [REVISED]

**What is the best practice for acknowledging donors who give multiple times per year?**

A) Send one comprehensive year-end acknowledgment summarizing all gifts
B) Acknowledge each gift individually within 48 hours
C) Only acknowledge gifts over \$250 for tax purposes
D) Combine acknowledgments quarterly to reduce mailing costs

**Correct Answer: B**

Every gift deserves individual acknowledgment within 48 hours, regardless of frequency. Each donation represents a separate decision to support your mission and should be recognized promptly and individually to build strong donor relationships.

***

## QUESTION 5 | Basic Level | Prospect Research [NEW BASIC VERSION]

**To identify a potential major donor prospect, which TWO factors are most essential?**

A) Capacity to give + participation in your events
B) Capacity to give + history of giving OR connection to your cause
C) History of giving + attendance at board meetings
D) Connection to your cause + social media engagement

**Correct Answer: B**

A viable major donor prospect must have capacity (financial ability to make a significant gift) plus at least ONE of: demonstrated philanthropic history OR strong affinity for your mission. Without capacity, they cannot make a major gift regardless of their interest.

***

## QUESTION 6 | Intermediate Level | Wealth Screening

**Which of the following is NOT one of the three main categories of prospect research indicators?**

A) Capacity indicators
B) Philanthropic indicators
C) Affinity indicators
D) Geographic indicators

**Correct Answer: D**

The three key prospect research indicators are capacity (wealth), philanthropic (propensity to give), and affinity (connection to your cause). All three must be present to identify a viable major donor prospect.

***

## QUESTION 7 | Intermediate Level | Wealth Screening

**Individuals who own real estate valued at \$2+ million are how many times more likely to give philanthropically than the average person?**

A) 5 times more likely
B) 10 times more likely
C) 17 times more likely
D) 25 times more likely

**Correct Answer: C**

Research shows that individuals who own real estate valued at \$2+ million are 17 times more likely to give philanthropically than the average person, making real estate ownership a powerful wealth indicator.

***

## QUESTION 8 | Intermediate Level | Donor Cultivation

**According to major gift benchmark studies, how long does it typically take to build a strong enough relationship with a prospective donor to secure a major gift?**

A) 1-3 months
B) 6 months to 2 years
C) 3-5 years
D) Less than 6 months

**Correct Answer: B**

Most nonprofits report that it takes between six months and two years to build a strong enough relationship with a prospective donor to secure a major gift. This emphasizes the importance of patient, strategic donor cultivation.

***

## QUESTION 9 | Intermediate Level | Donor Retention [REVISED]

**What is the most effective strategy for retaining first-time donors?**

A) Send them your monthly newsletter
B) Wait 6 months before making another ask
C) Thank them promptly and show impact of their specific gift
D) Add them to your major donor mailing list

**Correct Answer: C**

The most effective retention strategy is to thank first-time donors immediately and demonstrate the specific impact of their gift. Showing donors how their contribution made a difference creates emotional connection and significantly increases the likelihood they'll give again.

***

## QUESTION 10 | Intermediate Level | Wealth Screening

**What is the key difference between wealth screening and prospect research?**

A) Wealth screening is manual; prospect research is automated
B) Wealth screening uses algorithms to identify capacity; prospect research involves human analysis for timing and strategy
C) There is no difference; they are the same process
D) Wealth screening is only for major donors; prospect research is for all donors

**Correct Answer: B**

Wealth screening is a computerized process that identifies giving capacity using external data. Prospect research involves deeper human analysis to determine relationship-building strategies and optimal timing for asks.

***

## QUESTION 11 | Intermediate Level | Fundraising Metrics [REVISED - HARDER]

**Which metric best predicts the long-term value of a donor to your organization?**

A) Size of their first gift
B) Average gift amount
C) Years of consistent giving × average gift × frequency
D) Total cumulative giving to date

**Correct Answer: C**

Donor lifetime value (DLV) is calculated by multiplying the donor's lifespan (years of giving) × average donation amount × average donation frequency. This forward-looking metric helps predict future value, not just measure past giving.

***

## QUESTION 12 | Advanced Level | Form 990 Research [REVISED - HARDER]

**When analyzing a foundation's Form 990 to determine if they're a good prospect, which pattern suggests they might support your organization?**

A) Large endowment with minimal annual grantmaking
B) History of grants to organizations with similar mission and geography
C) High executive compensation relative to grants made
D) Primarily supporting organizations with revenue over \$10M

**Correct Answer: B**

Schedule I grant listings showing support for organizations with similar missions and in your geographic area indicate strong alignment. This pattern suggests the foundation's priorities match your cause and they fund organizations like yours.

***

## QUESTION 13 | Advanced Level | Prospect Research

**Which combination of indicators provides the strongest signal that a prospect is ready for a major gift solicitation?**

A) High capacity + previous political giving
B) High capacity + philanthropic propensity + strong affinity for your mission
C) High capacity + real estate ownership + business affiliations
D) Philanthropic propensity + event attendance

**Correct Answer: B**

The strongest major gift prospects demonstrate all three indicators: capacity (ability to give), philanthropic propensity (history of giving), and affinity (connection to your specific mission). All three must align.

***

## QUESTION 14 | Advanced Level | Donor Stewardship

**According to research by Penelope Burk, what impact does a thank-you phone call to a newly acquired donor have on Year 2 revenue?**

A) 15% increase
B) 25% increase
C) 40% increase
D) No measurable impact

**Correct Answer: C**

Research shows that a thank-you phone call to newly acquired donors yields 40% more revenue in Year 2. This demonstrates the powerful ROI of personalized donor stewardship.

***

## QUESTION 15 | Intermediate Level | Fundraising Metrics [REVISED]

**Which approach helps you understand if investing in donor retention is worthwhile?**

A) Average gift size × number of donors
B) Total revenue ÷ acquisition cost
C) Value of retained donors vs. cost to acquire new donors
D) Number of gifts ÷ number of donors

**Correct Answer: C**

Comparing the value of retained donors against new donor acquisition costs reveals retention ROI. Since acquiring new donors costs 5-7 times more than retaining current ones, and retained donors give more over time, this metric demonstrates why retention should be prioritized.

***

## QUESTION 16 | Intermediate Level | Major Donor Cultivation

**What percentage of major donors (\$5K-\$50K) were retained between 2023 and Q2 2024 according to the Fundraising Effectiveness Project?**

A) 28.5%
B) 42.1%
C) 55.3%
D) 68.7%

**Correct Answer: B**

The Fundraising Effectiveness Project reports that 42.1% of major donors (\$5K-\$50K) were retained between 2023 and Q2 2024, showing that even major donors require consistent stewardship to maintain engagement.

***

## QUESTION 17 | Advanced Level | Wealth Screening

**Which government database should you consult to find publicly-traded stock holdings that indicate donor capacity?**

A) IRS.gov
B) FEC.gov
C) SEC.gov
D) USA.gov

**Correct Answer: C**

SEC.gov (Securities and Exchange Commission) provides public records of stock holdings at publicly-traded companies. This is valuable data for assessing a prospect's wealth capacity.

***

## QUESTION 18 | Advanced Level | Prospect Research

**When using FEC.gov (Federal Election Commission) data in prospect research, what does significant political giving indicate?**

A) Only partisan political alignment
B) Both financial capacity and potential affinity based on political values
C) Only that they are registered voters
D) Their employer information

**Correct Answer: B**

FEC.gov political giving data reveals both capacity (ability to make significant contributions) and potential affinity (political leanings may align with certain causes). Someone giving large political gifts has demonstrated philanthropic capacity.

***

## QUESTION 19 | Intermediate Level | Donor Retention Strategy

**What is the average overall donor retention rate across nonprofits as of recent studies?**

A) 65-70%
B) 54-58%
C) 43-46%
D) 30-35%

**Correct Answer: C**

The average donor retention rate is approximately 43-46% according to recent research. This means more than half of donors do not give again the following year, highlighting the critical need for retention strategies.

***

## QUESTION 20 | Advanced Level | Fundraising Best Practices

**In a comprehensive fundraising strategy, what should be the relationship between donor acquisition costs and donor lifetime value?**

A) Acquisition costs should be minimal compared to DLV to ensure positive ROI
B) They should be approximately equal
C) Acquisition costs can exceed DLV in the short term
D) There is no relationship between these metrics

**Correct Answer: A**

Donor acquisition costs should be significantly lower than donor lifetime value to ensure positive return on investment. If you know a donor's LTV is \$1,000, spending \$100 to acquire them is worthwhile, but costs should remain proportional.

***

## Quick Answer Key

**Q1: B | Q2: C | Q3: B | Q4: B | Q5: B**
**Q6: D | Q7: C | Q8: B | Q9: C | Q10: B**
**Q11: C | Q12: B | Q13: B | Q14: C | Q15: C**
**Q16: B | Q17: C | Q18: B | Q19: C | Q20: A**

***

## Key Revisions Made:

✓ **Q4:** Changed to practical question about multiple-year donors
✓ **Q5:** New basic-level question teaching capacity + (history OR affinity)
✓ **Q8:** Replaced with practical retention strategy (no longer "nerdy")
✓ **Q9:** Removed percentage-based, now focuses on effective strategy
✓ **Q11:** Removed obvious "DLV" terminology from answers
✓ **Q12:** Removed obvious "Schedule I" answer, requires deeper analysis
✓ **Q14:** Moved to intermediate level, focused on practical ROI concept

- [] Task 3 - Optimize AI integration

I need you to optimize the vercel AI SDK optimization and help make the AI respond much faster. 