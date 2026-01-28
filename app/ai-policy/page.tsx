import { APP_DOMAIN } from "@/lib/config"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr"

export const metadata: Metadata = {
  title: "AI Acceptable Use Policy - Rōmy",
  description: "AI Acceptable Use Policy for Rōmy",
  openGraph: {
    title: "AI Acceptable Use Policy - Rōmy",
    description: "AI Acceptable Use Policy for Rōmy",
    type: "website",
    url: `${APP_DOMAIN}/ai-policy`,
  },
}

export default function AIPolicy() {
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-24">
        <div className="mb-8 flex items-center justify-center gap-2 text-sm font-medium">
          <time className="text-foreground">Effective January 28, 2025</time>
        </div>

        <h1 className="mb-4 text-center text-4xl font-medium tracking-tight md:text-5xl">
          AI Acceptable Use Policy
        </h1>

        <p className="text-foreground mb-8 text-center text-lg">
          How we build, use, and govern AI responsibly
        </p>

        <div className="fixed bottom-6 left-0 z-50 flex w-full justify-center">
          <Link href="/">
            <Button
              variant="outline"
              className="group flex h-12 items-center justify-between rounded-full border-foreground bg-foreground py-2 pr-2 pl-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
            >
              Back to Rōmy{" "}
              <div className="ml-2 rounded-full bg-background/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
              </div>
            </Button>
          </Link>
        </div>

        <div className="prose dark:prose-invert mt-20 w-full min-w-full">
          {/* TL;DR Section */}
          <div className="rounded-lg border-2 border-foreground/20 bg-foreground/5 p-6 mb-12">
            <h2 className="mt-0 flex items-center gap-2 text-xl">
              TL;DR — AI Governance at a Glance
            </h2>
            <p className="text-sm mb-4">
              <em>This summary is for convenience only. The full policy below is binding for all users of the platform.</em>
            </p>
            <ul className="text-sm space-y-2 mb-0">
              <li><strong>AI assists, humans decide.</strong> Rōmy provides AI-generated research to inform your fundraising strategy. A human must always review and validate AI output before acting on it.</li>
              <li><strong>Your data trains nothing.</strong> Your conversations, donor data, and research are never used to train AI models. Period.</li>
              <li><strong>We use multiple AI providers.</strong> Messages are processed by third-party AI providers (xAI, OpenAI, Anthropic, etc.) under strict data processing agreements.</li>
              <li><strong>Not a credit bureau.</strong> Never use Rōmy output for credit, employment, insurance, or housing decisions. That violates the FCRA and our Terms.</li>
              <li><strong>Memory is yours to control.</strong> Rōmy can remember preferences and facts you share. You can view, edit, or delete any memory at any time.</li>
              <li><strong>Web research cites sources.</strong> When Rōmy searches the web, it provides source citations so you can verify the information.</li>
              <li><strong>Encryption protects your keys.</strong> All API credentials are encrypted with AES-256-GCM before storage. We never store keys in plaintext.</li>
              <li><strong>Rate limits prevent abuse.</strong> Usage limits protect the platform and ensure fair access for all nonprofit users.</li>
              <li><strong>We don&apos;t do surveillance.</strong> Rōmy is a research tool for fundraising professionals, not a surveillance system. Don&apos;t use it as one.</li>
            </ul>
          </div>

          <h2>1. Purpose and Scope</h2>
          <p>
            This AI Acceptable Use Policy (&quot;AI Policy&quot;) governs the use of artificial intelligence features within Rōmy, an AI-powered donor research platform operated by GetRomy LLC (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;). This policy applies to all users of the platform, including nonprofit staff, administrators, and any individual accessing AI-powered features.
          </p>
          <p>
            This policy supplements our <Link href="/terms" className="text-foreground hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-foreground hover:underline">Privacy Policy</Link>. In the event of a conflict, the Terms of Service take precedence.
          </p>
          <p>
            Our goal is to ensure that AI is used responsibly, transparently, and in alignment with the mission-driven values of the nonprofit organizations we serve.
          </p>

          <h2>2. AI System Description</h2>
          <p>
            Rōmy uses generative AI to assist nonprofit fundraising professionals with prospect research, donor capacity analysis, and strategic recommendations. The system includes:
          </p>
          <ul>
            <li><strong>Conversational AI:</strong> Natural language interface powered by large language models (LLMs) from multiple providers, including xAI (Grok), OpenAI (GPT), Anthropic (Claude), Google (Gemini), and others via OpenRouter.</li>
            <li><strong>Web Research:</strong> LinkUp-powered prospect research that searches real-time public data sources and returns grounded, cited results covering real estate, business ownership, philanthropy, securities holdings, and biographical information.</li>
            <li><strong>Public Records Tools:</strong> Integrations with FEC (political contributions), SEC EDGAR (insider filings and proxy statements), ProPublica (nonprofit 990 data), USAspending (federal contracts/grants), and Wikidata.</li>
            <li><strong>CRM Integration:</strong> Connections to Bloomerang, Virtuous, and Neon CRM for syncing constituent and donation records.</li>
            <li><strong>Giving Capacity Calculator:</strong> Industry-standard TFG Research formulas (GS, EGS, Snapshot) for estimating donor giving capacity based on gathered wealth indicators.</li>
            <li><strong>AI Memory:</strong> An opt-in system that remembers user preferences, organizational context, and research facts across conversations to provide personalized assistance.</li>
          </ul>

          <h2>3. Core AI Principles</h2>
          <p>
            All AI features in Rōmy are designed and operated according to these principles:
          </p>

          <div className="rounded-lg border-2 border-blue-500/30 bg-blue-500/5 p-4">
            <p className="font-semibold text-blue-600 dark:text-blue-400">Our AI Principles</p>
            <ol>
              <li><strong>Human oversight:</strong> AI provides research and recommendations. Humans make decisions. No AI output should be acted upon without human review.</li>
              <li><strong>Transparency:</strong> Users are always aware they are interacting with AI. Sources are cited. Limitations are disclosed.</li>
              <li><strong>Privacy by design:</strong> We collect and process only the data necessary to deliver the service. User data never trains AI models.</li>
              <li><strong>Fairness:</strong> AI outputs must not be used in ways that discriminate based on race, gender, religion, national origin, disability, or any other protected characteristic.</li>
              <li><strong>Accountability:</strong> We maintain logs of AI system behavior and continuously monitor for errors, bias, and misuse.</li>
              <li><strong>Security:</strong> All data in transit and at rest is protected with industry-standard encryption. Access controls enforce least-privilege principles.</li>
            </ol>
          </div>

          <h2>4. Acceptable Uses</h2>
          <p>
            Rōmy is designed for legitimate nonprofit fundraising activities. Acceptable uses include:
          </p>
          <ul>
            <li>Researching potential donors and their philanthropic history</li>
            <li>Estimating giving capacity using public wealth indicators</li>
            <li>Reviewing political contribution records from the FEC</li>
            <li>Analyzing nonprofit 990 filings for foundation research</li>
            <li>Verifying board memberships and corporate affiliations via SEC filings</li>
            <li>Searching federal award data for organizational due diligence</li>
            <li>Drafting donor communications, proposals, and outreach strategies</li>
            <li>Syncing and cross-referencing data from your CRM</li>
            <li>Using AI memory to maintain context across research sessions</li>
            <li>Generating giving capacity ratings using TFG Research formulas</li>
          </ul>

          <h2>5. Prohibited Uses</h2>
          <div className="rounded-lg border-2 border-red-500/30 bg-red-500/5 p-4">
            <p className="font-semibold text-red-600 dark:text-red-400">Strictly Prohibited</p>
            <p>
              The following uses of Rōmy are <strong>strictly prohibited</strong> and may result in immediate account termination:
            </p>
            <ol>
              <li><strong>Credit, employment, or insurance decisions:</strong> Rōmy is <strong>NOT</strong> a consumer reporting agency under the Fair Credit Reporting Act (FCRA). You may not use AI output to make decisions about credit, employment, insurance, housing, or any purpose regulated by the FCRA.</li>
              <li><strong>Surveillance or stalking:</strong> Do not use Rōmy to monitor, track, or surveil individuals for purposes unrelated to legitimate nonprofit fundraising research.</li>
              <li><strong>Harassment or intimidation:</strong> Do not use research output to harass, threaten, shame, or coerce any individual.</li>
              <li><strong>Discriminatory targeting:</strong> Do not use AI output to systematically exclude or target individuals based on race, ethnicity, religion, gender, sexual orientation, disability, national origin, or any protected characteristic.</li>
              <li><strong>Generating deceptive content:</strong> Do not use Rōmy to create false donor profiles, fabricate giving histories, forge communications, or produce misleading grant applications.</li>
              <li><strong>Unauthorized data collection:</strong> Do not use Rōmy to aggregate personal data for sale, marketing by third parties, or any purpose beyond your organization&apos;s legitimate fundraising activities.</li>
              <li><strong>Circumventing security controls:</strong> Do not attempt to bypass rate limits, access controls, CSRF protections, or any other security mechanism.</li>
              <li><strong>Training external models:</strong> Do not systematically extract AI output to train, fine-tune, or improve other AI or machine learning models.</li>
            </ol>
          </div>

          <h2>6. Human Oversight Requirements</h2>
          <p>
            AI-generated content from Rōmy is probabilistic, not deterministic. This means AI output can be incorrect, incomplete, outdated, or misleading. Users must:
          </p>
          <ul>
            <li><strong>Verify before acting:</strong> Always cross-reference AI-generated research with primary sources before making fundraising decisions, gift asks, or donor communications.</li>
            <li><strong>Review giving capacity ratings:</strong> The Giving Capacity Calculator provides estimates based on available data. Real capacity may differ based on factors not captured in public records (debt, family obligations, illiquid assets).</li>
            <li><strong>Validate web research citations:</strong> When Rōmy provides source links, open and verify them. Web sources can change, become outdated, or contain errors.</li>
            <li><strong>Check CRM data freshness:</strong> Synced CRM data reflects the state at the time of the last sync. Real-time changes in your CRM are not automatically reflected.</li>
            <li><strong>Apply professional judgment:</strong> AI should augment, not replace, the expertise of development professionals. Use AI output as one input among many in your decision-making process.</li>
          </ul>

          <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-4">
            <p className="font-semibold text-amber-600 dark:text-amber-400">Key Principle</p>
            <p className="mb-0">
              Rōmy is a research assistant, not a decision-maker. The responsibility for fundraising decisions, donor communications, and gift solicitations always rests with the human professional.
            </p>
          </div>

          <h2>7. Data Handling and AI Training</h2>
          <p>
            We are committed to protecting the data entrusted to us by nonprofit organizations:
          </p>

          <h3>7.1 Your Data Does Not Train Models</h3>
          <p>
            Conversations, donor data, CRM records, memories, and any other content you provide to Rōmy are <strong>never used to train, fine-tune, or improve</strong> the underlying AI models. This applies to all AI providers we use.
          </p>

          <h3>7.2 How Data Flows Through the System</h3>
          <table>
            <thead>
              <tr>
                <th>Data Type</th>
                <th>Where It Goes</th>
                <th>Retention</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Chat messages</td>
                <td>AI provider (for response generation), Supabase (for storage)</td>
                <td>Until you delete the chat or your account</td>
              </tr>
              <tr>
                <td>Web search queries</td>
                <td>LinkUp API (for real-time search)</td>
                <td>Not retained by Rōmy beyond the response</td>
              </tr>
              <tr>
                <td>CRM credentials</td>
                <td>Encrypted in database (AES-256-GCM)</td>
                <td>Until you disconnect the integration</td>
              </tr>
              <tr>
                <td>CRM synced data</td>
                <td>Supabase (your tenant only)</td>
                <td>Until you delete or re-sync</td>
              </tr>
              <tr>
                <td>AI memories</td>
                <td>Supabase with vector embeddings</td>
                <td>Until you delete them</td>
              </tr>
              <tr>
                <td>File uploads</td>
                <td>Supabase storage (your folder only)</td>
                <td>Until you delete the attachment</td>
              </tr>
              <tr>
                <td>Public records queries</td>
                <td>FEC, SEC, ProPublica, USAspending APIs</td>
                <td>Not retained beyond the response</td>
              </tr>
            </tbody>
          </table>

          <h3>7.3 Third-Party AI Providers</h3>
          <p>
            When you send a message in Rōmy, your prompt is transmitted to the selected AI provider to generate a response. We use the following providers:
          </p>
          <ul>
            <li><strong>xAI</strong> (Grok models) &mdash; via OpenRouter</li>
            <li><strong>OpenAI</strong> (GPT models) &mdash; via OpenRouter</li>
            <li><strong>Anthropic</strong> (Claude models) &mdash; via OpenRouter</li>
            <li><strong>Google</strong> (Gemini models) &mdash; via OpenRouter</li>
            <li><strong>Perplexity</strong> (Sonar models) &mdash; via OpenRouter</li>
            <li><strong>Other providers</strong> available through OpenRouter</li>
          </ul>
          <p>
            All providers are accessed through OpenRouter, which acts as an API gateway. OpenRouter&apos;s data processing agreements prohibit the use of our users&apos; data for model training. Each provider also maintains their own privacy policy and data handling practices.
          </p>

          <h3>7.4 Bring Your Own Key (BYOK)</h3>
          <p>
            Users may provide their own API keys for AI providers. When you use BYOK:
          </p>
          <ul>
            <li>Your key is encrypted with AES-256-GCM before storage</li>
            <li>A unique initialization vector (IV) is generated for each key</li>
            <li>Keys are decrypted only at the moment of API call, never cached in plaintext</li>
            <li>Your traffic goes directly to the provider under your own API agreement</li>
          </ul>

          <h2>8. AI Memory System Governance</h2>
          <p>
            Rōmy&apos;s memory system allows the AI to retain context across conversations for a more personalized experience. This section explains how memory is governed:
          </p>

          <h3>8.1 What Memory Stores</h3>
          <ul>
            <li>Facts you explicitly ask Rōmy to remember (&quot;Remember that our fiscal year starts in July&quot;)</li>
            <li>Preferences extracted from conversations (e.g., preferred communication tone, focus areas)</li>
            <li>Organizational context (e.g., mission statement, campaign goals, key staff names)</li>
          </ul>

          <h3>8.2 What Memory Does NOT Store</h3>
          <ul>
            <li>Passwords, API keys, or authentication credentials</li>
            <li>Full conversation transcripts (only extracted facts)</li>
            <li>Financial account numbers or Social Security numbers</li>
            <li>Complete donor profiles (only specific facts you request to be remembered)</li>
          </ul>

          <h3>8.3 Your Control Over Memory</h3>
          <ul>
            <li><strong>View:</strong> Access all stored memories in Settings &rarr; Memory</li>
            <li><strong>Search:</strong> Find specific memories by keyword</li>
            <li><strong>Edit:</strong> Modify any stored memory</li>
            <li><strong>Delete:</strong> Remove individual memories or clear all memories</li>
            <li><strong>Limit:</strong> Maximum of 1,000 memories per user. Low-value memories are automatically pruned.</li>
          </ul>

          <h2>9. Data Sources and Transparency</h2>
          <p>
            Rōmy accesses the following public data sources. All data retrieved is publicly available information:
          </p>
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Data Provided</th>
                <th>Authority</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>FEC.gov</td>
                <td>Political contribution records</td>
                <td>Federal Election Commission</td>
              </tr>
              <tr>
                <td>SEC EDGAR</td>
                <td>Insider filings (Form 3/4/5), proxy statements (DEF 14A)</td>
                <td>Securities and Exchange Commission</td>
              </tr>
              <tr>
                <td>ProPublica Nonprofit Explorer</td>
                <td>990 filings, revenue, assets, officer compensation</td>
                <td>IRS data via ProPublica</td>
              </tr>
              <tr>
                <td>USAspending.gov</td>
                <td>Federal contracts, grants, loans, direct payments</td>
                <td>U.S. Department of the Treasury</td>
              </tr>
              <tr>
                <td>Wikidata</td>
                <td>Biographical data, affiliations</td>
                <td>Wikimedia Foundation</td>
              </tr>
              <tr>
                <td>LinkUp</td>
                <td>Real-time web search with citations</td>
                <td>LinkUp API (aggregated web sources)</td>
              </tr>
            </tbody>
          </table>
          <p>
            When web research is performed, Rōmy provides source citations so users can verify the information independently. We encourage all users to treat AI-generated summaries as starting points, not final conclusions.
          </p>

          <h2>10. Security Controls</h2>
          <p>
            The following security measures protect the AI system and user data:
          </p>
          <ul>
            <li><strong>Encryption at rest:</strong> User API keys encrypted with AES-256-GCM. Supabase provides infrastructure-level encryption for all stored data.</li>
            <li><strong>Encryption in transit:</strong> All connections use HTTPS/TLS. WebSocket connections use WSS.</li>
            <li><strong>CSRF protection:</strong> All state-changing requests require a valid CSRF token validated server-side.</li>
            <li><strong>Row Level Security:</strong> Supabase RLS policies ensure users can only access their own data (chats, messages, memories, CRM records, API keys).</li>
            <li><strong>Input sanitization:</strong> User input is sanitized with DOMPurify before storage to prevent cross-site scripting (XSS).</li>
            <li><strong>Rate limiting:</strong> Tiered rate limits protect against abuse (guest: 5 messages/day, authenticated: 1,000 messages/day).</li>
            <li><strong>Content Security Policy:</strong> CSP headers restrict resource loading to trusted origins.</li>
            <li><strong>File validation:</strong> Uploads are validated by magic bytes (not just file extension) with a 10MB size limit and restricted file types.</li>
          </ul>

          <h2>11. Rate Limits and Fair Use</h2>
          <p>
            To ensure fair access for all nonprofit users and prevent abuse, the following limits apply:
          </p>
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Limit</th>
                <th>Reset</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Messages (guest)</td>
                <td>5 per day</td>
                <td>UTC midnight</td>
              </tr>
              <tr>
                <td>Messages (authenticated)</td>
                <td>1,000 per day</td>
                <td>UTC midnight</td>
              </tr>
              <tr>
                <td>Pro model calls</td>
                <td>500 total</td>
                <td>Lifetime per user</td>
              </tr>
              <tr>
                <td>File uploads</td>
                <td>5 per day</td>
                <td>UTC midnight</td>
              </tr>
              <tr>
                <td>File size</td>
                <td>10MB per file</td>
                <td>Per upload</td>
              </tr>
            </tbody>
          </table>
          <p>
            Users who consistently exceed limits or attempt to circumvent them may have their accounts suspended. If your nonprofit needs higher limits, contact us at <a href="mailto:support@getromy.app" className="text-foreground hover:underline">support@getromy.app</a>.
          </p>

          <h2>12. AI Limitations and Known Risks</h2>
          <p>
            We believe in honest disclosure of what AI can and cannot do:
          </p>

          <h3>12.1 Hallucination Risk</h3>
          <p>
            Large language models can generate plausible-sounding but factually incorrect information (&quot;hallucinations&quot;). This is an inherent limitation of current AI technology, not a defect specific to Rōmy. Always verify AI-generated claims, especially regarding:
          </p>
          <ul>
            <li>Donor wealth estimates and property valuations</li>
            <li>Board memberships and corporate affiliations</li>
            <li>Philanthropic history and gift amounts</li>
            <li>Personal biographical details</li>
          </ul>

          <h3>12.2 Data Currency</h3>
          <p>
            AI models have knowledge cutoff dates and may not reflect the most recent information. Real-time web search (when enabled) mitigates this, but results depend on what is currently published online.
          </p>

          <h3>12.3 Bias</h3>
          <p>
            AI models can reflect biases present in their training data. This may affect how prospects are described, which wealth indicators are emphasized, or how communities are characterized. Users should apply their professional judgment and organizational values when interpreting AI output.
          </p>

          <h3>12.4 Incomplete Public Records</h3>
          <p>
            Public data sources (FEC, SEC, ProPublica) have their own limitations. Not all individuals have public records. Absence of data does not indicate absence of wealth or philanthropic interest.
          </p>

          <h2>13. Incident Response</h2>
          <p>
            In the event of an AI-related incident (e.g., data exposure, persistent hallucination affecting multiple users, security breach):
          </p>
          <ol>
            <li><strong>Detection:</strong> We monitor AI system behavior for anomalies including error rates, unusual usage patterns, and user-reported issues.</li>
            <li><strong>Containment:</strong> Affected AI features may be temporarily disabled to prevent further impact.</li>
            <li><strong>Notification:</strong> Affected users will be notified within 72 hours of confirmed incidents involving personal data.</li>
            <li><strong>Remediation:</strong> Root cause analysis is conducted and preventive measures are implemented.</li>
            <li><strong>Disclosure:</strong> Material incidents will be communicated transparently, including what happened, what data was affected, and what steps were taken.</li>
          </ol>
          <p>
            To report an AI-related concern or security issue, contact <a href="mailto:security@getromy.app" className="text-foreground hover:underline">security@getromy.app</a>.
          </p>

          <h2>14. Compliance and Regulatory Alignment</h2>
          <p>
            This AI Policy is designed to align with:
          </p>
          <ul>
            <li><strong>NIST AI Risk Management Framework (AI RMF):</strong> We follow the Govern, Map, Measure, and Manage functions for AI risk management.</li>
            <li><strong>Fair Credit Reporting Act (FCRA):</strong> Rōmy is expressly not a consumer reporting agency. Output must not be used for FCRA-regulated purposes.</li>
            <li><strong>CCPA/CPRA:</strong> California residents have the right to know, delete, and opt out of data sale (we do not sell data).</li>
            <li><strong>GDPR:</strong> EU residents have additional rights regarding data access, portability, and erasure.</li>
            <li><strong>Association of Professional Researchers for Advancement (APRA):</strong> Rōmy is designed to support ethical prospect research as outlined in APRA&apos;s Statement of Ethics.</li>
          </ul>

          <div className="rounded-lg border-2 border-purple-500/30 bg-purple-500/5 p-4">
            <p className="font-semibold text-purple-600 dark:text-purple-400">Nonprofit-Specific Commitment</p>
            <p className="mb-0">
              We recognize that nonprofits hold a special position of trust with their donors and communities. Rōmy is designed to uphold that trust by ensuring that AI-powered research serves the mission of philanthropy, not surveillance. We are committed to the ethical standards of the prospect research profession, including the APRA Statement of Ethics and the Donor Bill of Rights.
            </p>
          </div>

          <h2>15. User Responsibilities</h2>
          <p>
            By using Rōmy, you agree to:
          </p>
          <ul>
            <li>Use AI features only for legitimate nonprofit fundraising purposes</li>
            <li>Review and verify AI output before acting on it</li>
            <li>Not use AI output for any prohibited purpose listed in Section 5</li>
            <li>Report AI errors, concerning behavior, or potential biases to our team</li>
            <li>Maintain appropriate access controls within your organization for shared accounts</li>
            <li>Comply with your organization&apos;s own data governance and donor privacy policies</li>
            <li>Not share account credentials or AI output with unauthorized individuals</li>
            <li>Delete data you no longer need in accordance with your organization&apos;s data retention policies</li>
          </ul>

          <h2>16. Changes to This Policy</h2>
          <p>
            We may update this AI Policy as AI technology, regulations, and best practices evolve. When we make material changes:
          </p>
          <ul>
            <li>We will update the &quot;Effective&quot; date at the top of this page</li>
            <li>We will notify active users via email for material changes</li>
            <li>Continued use of Rōmy after changes constitutes acceptance of the updated policy</li>
          </ul>
          <p>
            We review this policy at least quarterly to ensure it remains current with our AI capabilities and the regulatory landscape.
          </p>

          <h2>17. Contact Us</h2>
          <p>
            Questions about our AI practices? We welcome the conversation.
          </p>
          <p>
            <strong>General inquiries:</strong> <a href="mailto:support@getromy.app" className="text-foreground hover:underline">support@getromy.app</a><br />
            <strong>Privacy inquiries:</strong> <a href="mailto:privacy@getromy.app" className="text-foreground hover:underline">privacy@getromy.app</a><br />
            <strong>Security issues:</strong> <a href="mailto:security@getromy.app" className="text-foreground hover:underline">security@getromy.app</a>
          </p>
          <p>
            <strong>Mailing Address:</strong><br />
            GetRomy LLC<br />
            Kerrville, TX 78028<br />
            United States
          </p>

          <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
            <p>Last updated: January 28, 2025</p>
            <p>Version: 1.0</p>
          </div>
        </div>
      </div>
    </>
  )
}
