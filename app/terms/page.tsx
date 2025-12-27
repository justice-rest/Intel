import { APP_DOMAIN } from "@/lib/config"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr"

export const metadata: Metadata = {
  title: "Terms of Service - Rōmy",
  description: "Terms of Service for Rōmy",
  openGraph: {
    title: "Terms of Service - Rōmy",
    description: "Terms of Service for Rōmy",
    type: "website",
    url: `${APP_DOMAIN}/terms`,
  },
}

export default function TermsOfService() {
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-24">
        <div className="mb-8 flex items-center justify-center gap-2 text-sm font-medium">
          <time className="text-foreground">Effective December 27, 2024</time>
        </div>

        <h1 className="mb-4 text-center text-4xl font-medium tracking-tight md:text-5xl">
          Terms of Service
        </h1>

        <p className="text-foreground mb-8 text-center text-lg">
          Legal terms for using Rōmy
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
              📋 TL;DR — The Quick Version
            </h2>
            <p className="text-sm mb-4">
              <em>This summary is for convenience only. The full terms below are legally binding.</em>
            </p>
            <ul className="text-sm space-y-2 mb-0">
              <li><strong>What Rōmy does:</strong> AI-powered donor research for nonprofits. We help you find major donors using AI, public data, and integrations with your CRM and Google Workspace.</li>
              <li><strong>Your data is yours:</strong> We never sell your donor lists or data. We only use it to provide the service to you.</li>
              <li><strong>AI makes mistakes:</strong> Always verify AI-generated research before acting on it. We're not liable for AI inaccuracies.</li>
              <li><strong>Not for credit/employment decisions:</strong> Don't use our data to deny someone credit, a job, or housing. We're not a credit bureau.</li>
              <li><strong>Paid plans have limits:</strong> Usage limits apply. We can suspend accounts that abuse the service.</li>
              <li><strong>Google integration:</strong> If you connect Gmail/Drive, AI can read emails and create drafts (never auto-send). You control what's shared.</li>
              <li><strong>CRM sync:</strong> We can sync with Bloomerang, Virtuous, and Neon CRM. Your credentials are encrypted.</li>
              <li><strong>Texas law governs:</strong> Disputes resolved in Texas via arbitration. No class actions.</li>
              <li><strong>Cancel anytime:</strong> You can stop using the service and export your data within 30 days.</li>
            </ul>
          </div>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Rōmy ("Service", "Platform", "we", "us", or "our"), operated by GetRomy LLC ("Provider"), a Texas limited liability company, you ("Customer", "you", "your") agree to be bound by these Terms of Service ("Terms" or "Agreement"). If you do not agree to these Terms, do not use the Service.
          </p>
          <p>
            <strong>You must be at least 18 years old</strong> (or the age of majority in your jurisdiction) and have the legal capacity to enter into binding contracts to use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Rōmy is an AI-powered research platform designed to help small nonprofits identify and research potential major donors. The Service provides:
          </p>
          <ul>
            <li><strong>AI-Powered Research:</strong> Access to AI language models (xAI Grok, OpenAI, Anthropic Claude, Google Gemini, and others via OpenRouter) for intelligent prospect research and conversations</li>
            <li><strong>Document Analysis:</strong> File upload and processing for PDFs, spreadsheets, and documents (max 10MB per file)</li>
            <li><strong>Web Search Integration:</strong> Real-time web search via Perplexity, Linkup, and other providers for prospect research</li>
            <li><strong>Google Workspace Integration:</strong> Gmail access for reading emails and creating AI-generated drafts (drafts only — we never auto-send); Google Drive for document import and RAG indexing</li>
            <li><strong>CRM Integrations:</strong> Sync with Bloomerang, Virtuous, and Neon CRM to import constituent and donation data</li>
            <li><strong>AI Memory:</strong> Optional memory system that learns your preferences and context over time</li>
            <li><strong>Data Research Tools:</strong> Access to FEC contributions, SEC filings, ProPublica nonprofit data, USAspending government awards, and property records</li>
            <li><strong>Cloud or Local Storage:</strong> Choice between cloud-based (Supabase) or browser-only (IndexedDB) data storage</li>
          </ul>

          <h2>3. User Accounts and Authentication</h2>
          <h3>3.1 Account Creation</h3>
          <p>
            To access certain features, you must create an account using email/password or Google OAuth authentication. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
          </p>

          <h3>3.2 Guest Access</h3>
          <p>
            Limited guest access is available with restricted functionality (5 messages/day, basic model only). Guest sessions use local storage only.
          </p>

          <h3>3.3 Account Security</h3>
          <p>
            You must: (a) use a strong, unique password; (b) not share your credentials; (c) notify us immediately at <a href="mailto:security@getromy.app">security@getromy.app</a> if you suspect unauthorized access; (d) not use the Service through automation, bots, or scripts without written permission.
          </p>

          <h2>4. Subscription Plans and Usage Limits</h2>
          <h3>4.1 Plans</h3>
          <p>The Service offers the following subscription tiers:</p>
          <ul>
            <li><strong>Starter (Free):</strong> 1,000 messages/day, basic models, 5 file uploads/day</li>
            <li><strong>Pro:</strong> Increased limits, access to advanced models, Google Workspace integration</li>
            <li><strong>Scale:</strong> Highest limits, priority support, all integrations, team features</li>
          </ul>

          <h3>4.2 Usage Limits</h3>
          <p>Current limits (subject to change with notice):</p>
          <ul>
            <li>Unauthenticated users: 5 messages per day (gpt-4.1-nano only)</li>
            <li>Authenticated users: 1,000 messages per day</li>
            <li>Pro models: 500 lifetime calls per user</li>
            <li>File uploads: 5 files per day, 10MB max per file</li>
            <li>Google Drive documents: Limited per user based on plan</li>
          </ul>
          <p>We reserve the right to modify limits to ensure fair usage and service stability.</p>

          <h3>4.3 Billing</h3>
          <p>
            Paid subscriptions are billed monthly or annually via Stripe through Autumn. Prices are in USD. You authorize us to charge your payment method automatically. Refunds are at our discretion.
          </p>

          <h2>5. Google Workspace Integration</h2>
          <p>When you connect your Google account, you authorize Rōmy to:</p>

          <h3>5.1 Gmail Access</h3>
          <ul>
            <li><strong>Read emails:</strong> AI can read your inbox and sent mail to provide context for research</li>
            <li><strong>Create drafts:</strong> AI can compose email drafts matching your writing style</li>
            <li><strong>Never send:</strong> We <strong>cannot and will not</strong> automatically send emails. You must review and send all drafts manually from Gmail</li>
          </ul>

          <h3>5.2 Google Drive Access</h3>
          <ul>
            <li><strong>File picker:</strong> You select which files to import — we only access files you explicitly choose</li>
            <li><strong>Document indexing:</strong> Selected files are processed and indexed for AI-powered search</li>
            <li><strong>No bulk access:</strong> We use the <code>drive.file</code> scope, limiting access to files you select</li>
          </ul>

          <h3>5.3 Revocation</h3>
          <p>
            You can disconnect Google access anytime in Settings. This removes our access and deletes associated data (writing style profile, indexed documents).
          </p>

          <h2>6. CRM Integrations</h2>
          <p>The Service integrates with nonprofit CRMs:</p>
          <ul>
            <li><strong>Bloomerang:</strong> Import constituents and transactions</li>
            <li><strong>Virtuous:</strong> Import contacts and gifts</li>
            <li><strong>Neon CRM:</strong> Import accounts and donations</li>
          </ul>
          <p>
            <strong>Your credentials:</strong> API keys are encrypted using AES-256-GCM before storage. We never store plaintext credentials.
          </p>
          <p>
            <strong>Your data:</strong> CRM data synced to Rōmy remains your property. We use it solely to provide the Service. We do not sell, share, or use your CRM data for any other purpose.
          </p>

          <h2>7. Acceptable Use</h2>
          <h3>7.1 Prohibited Activities</h3>
          <p>You agree <strong>not</strong> to use the Service to:</p>
          <ul>
            <li>Violate any applicable laws, regulations, or third-party rights</li>
            <li>Transmit harmful, threatening, abusive, harassing, defamatory, or offensive content</li>
            <li>Attempt unauthorized access to the Service, other accounts, or related systems</li>
            <li>Interfere with or disrupt the Service, servers, or networks</li>
            <li>Use automated tools, bots, scrapers, or scripts without written permission</li>
            <li>Reverse engineer, decompile, or extract source code</li>
            <li>Generate spam, phishing, malware, or deceptive content</li>
            <li>Circumvent usage limits, rate limits, or access controls</li>
            <li>Impersonate others or misrepresent your affiliation</li>
            <li>Use the Service for any illegal purpose, including harassment or stalking</li>
          </ul>

          <h3>7.2 AI Model Terms</h3>
          <p>
            When using AI models through our Service, you must comply with each model provider's acceptable use policies (xAI, OpenAI, Anthropic, Google, etc.). Violations may result in immediate termination.
          </p>

          <h2>8. Data Ownership and Use Restrictions</h2>
          <h3>8.1 Your Data Ownership</h3>
          <p>
            <strong>You retain all right, title, and interest</strong> in your Customer Data, including donor lists, CRM data, uploaded files, chat content, and any other information you provide. You grant us a limited, non-exclusive, non-transferable license to use Customer Data <strong>solely to provide the Service to you.</strong>
          </p>

          <h3>8.2 What We Will NOT Do</h3>
          <p>We will <strong>never</strong>:</p>
          <ul>
            <li>Sell, rent, lease, or disclose your data to third parties for their own purposes</li>
            <li>Use your data to train AI models (except AI memory features you explicitly enable)</li>
            <li>Include your data in shared datasets accessible to other customers</li>
            <li>Use your data for any purpose other than providing the Service</li>
            <li>Access your data except as necessary for support (with your consent) or legal compliance</li>
          </ul>

          <h3>8.3 AI-Generated Content</h3>
          <p>
            <strong>AI makes mistakes.</strong> Content generated by AI models is provided as-is. You are solely responsible for reviewing and verifying all AI-generated content before use. We make no warranties regarding accuracy, completeness, reliability, or suitability of AI outputs.
          </p>

          <h3>8.4 AI Memory</h3>
          <p>
            If you enable AI Memory, the system extracts and stores facts from your conversations to personalize future responses. You can view, edit, or delete memories at any time in Settings. Disabling memory deletes all stored memories.
          </p>

          <h2>9. FCRA Compliance — Critical Restriction</h2>
          <div className="rounded-lg border-2 border-red-500/30 bg-red-500/5 p-4">
            <p className="font-semibold text-red-600 dark:text-red-400">⚠️ Important Legal Notice</p>
            <p>
              Rōmy is <strong>NOT a consumer reporting agency</strong> under the Fair Credit Reporting Act (15 U.S.C. § 1681 et seq.) ("FCRA").
            </p>
            <p>
              <strong>You agree NOT to use</strong> any data or insights from the Service to determine any individual's eligibility for:
            </p>
            <ul>
              <li>Credit or lending</li>
              <li>Insurance</li>
              <li>Employment or hiring</li>
              <li>Housing or rental applications</li>
              <li>Educational opportunities</li>
              <li>Any other purpose requiring FCRA-compliant data</li>
            </ul>
            <p>
              The Service is designed <strong>solely for nonprofit fundraising research</strong> — identifying potential donors based on publicly available information and philanthropic indicators.
            </p>
          </div>

          <h2>10. Privacy and Data Protection</h2>
          <p>
            Your use of the Service is subject to our <Link href="/privacy" className="text-foreground hover:underline">Privacy Policy</Link>, incorporated by reference. Key points:
          </p>
          <ul>
            <li>We collect account info, chat content, usage data, and data you provide</li>
            <li>We share data only with essential service providers (AI models, hosting, analytics)</li>
            <li>You have rights under GDPR, CCPA, and other privacy laws</li>
            <li>We do not sell your personal information</li>
            <li>You can request data export or deletion at any time</li>
          </ul>

          <h2>11. Intellectual Property</h2>
          <h3>11.1 Our IP</h3>
          <p>
            The Service, including its design, code, branding, documentation, and non-open-source components, is owned by GetRomy LLC and protected by copyright, trademark, and other intellectual property laws.
          </p>

          <h3>11.2 Open Source</h3>
          <p>
            Rōmy includes open-source components. The source code for the main application is available under the license specified in our GitHub repository. This does not grant rights to our trademarks (Rōmy, GetRomy) or proprietary features.
          </p>

          <h3>11.3 Your Content</h3>
          <p>
            You retain ownership of all content you upload or create. By using the Service, you grant us a license to process, store, and display your content solely to provide the Service.
          </p>

          <h2>12. Third-Party Services</h2>
          <p>The Service integrates with third parties. You are subject to their terms:</p>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>xAI (Grok)</td>
                <td>AI model inference</td>
              </tr>
              <tr>
                <td>OpenRouter</td>
                <td>Multi-model AI access</td>
              </tr>
              <tr>
                <td>Google</td>
                <td>Authentication, Gmail, Drive</td>
              </tr>
              <tr>
                <td>Supabase</td>
                <td>Database, auth, storage</td>
              </tr>
              <tr>
                <td>PostHog</td>
                <td>Product analytics</td>
              </tr>
              <tr>
                <td>Perplexity / Linkup</td>
                <td>Web search</td>
              </tr>
              <tr>
                <td>Autumn / Stripe</td>
                <td>Payments</td>
              </tr>
              <tr>
                <td>Bloomerang / Virtuous / Neon</td>
                <td>CRM integration</td>
              </tr>
            </tbody>
          </table>
          <p>We are not responsible for third-party practices, content, or service availability.</p>

          <h2>13. Disclaimers and Limitation of Liability</h2>
          <h3>13.1 "As Is" Service</h3>
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>

          <h3>13.2 No Guarantees</h3>
          <p>We do not warrant that:</p>
          <ul>
            <li>The Service will be uninterrupted, secure, or error-free</li>
            <li>AI outputs will be accurate, complete, or reliable</li>
            <li>Donor research will result in successful fundraising</li>
            <li>Data from third-party sources is accurate or current</li>
            <li>Integrations with third parties will always function correctly</li>
          </ul>

          <h3>13.3 Liability Cap</h3>
          <p>
            <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong> Neither party's aggregate liability arising from this Agreement shall exceed the total amount paid by Customer in the twelve (12) months preceding the claim.
          </p>
          <p><strong>Exceptions:</strong> This cap does not apply to:</p>
          <ul>
            <li>Indemnification obligations</li>
            <li>Gross negligence or willful misconduct</li>
            <li>Breaches of data security obligations involving personal data</li>
            <li>Your violation of Section 9 (FCRA restrictions)</li>
          </ul>

          <h3>13.4 Consequential Damages Waiver</h3>
          <p>
            NEITHER PARTY SHALL BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS OPPORTUNITIES, REGARDLESS OF WHETHER ADVISED OF THE POSSIBILITY.
          </p>

          <h2>14. Indemnification</h2>
          <h3>14.1 By Us</h3>
          <p>We will indemnify and defend you against third-party claims alleging that the Service infringes intellectual property rights, provided you notify us promptly and cooperate in the defense.</p>

          <h3>14.2 By You</h3>
          <p>You will indemnify and defend us against claims arising from:</p>
          <ul>
            <li>Your content and data</li>
            <li>Your violation of these Terms</li>
            <li>Your use of the Service in violation of law (especially FCRA)</li>
            <li>Your violation of third-party rights</li>
            <li>Your use of AI outputs without proper verification</li>
          </ul>

          <h2>15. Termination</h2>
          <h3>15.1 By You</h3>
          <p>
            You may stop using the Service at any time. To delete your account and data, contact <a href="mailto:privacy@getromy.app">privacy@getromy.app</a> or use the account deletion feature in Settings.
          </p>

          <h3>15.2 By Us</h3>
          <p>We may suspend or terminate your access immediately, with or without notice, for:</p>
          <ul>
            <li>Violation of these Terms</li>
            <li>Fraudulent, abusive, or illegal activity</li>
            <li>Non-payment (after notice and cure period)</li>
            <li>Extended inactivity (24+ months, with notice)</li>
            <li>Technical or security reasons</li>
            <li>Discontinuation of the Service</li>
          </ul>

          <h3>15.3 Data Export</h3>
          <p>
            Upon termination, you have <strong>30 days</strong> to export your data. We will provide your Customer Data in a standard format (CSV, JSON). After 30 days, we may delete your data per our retention policies.
          </p>

          <h3>15.4 Survival</h3>
          <p>Sections on data ownership, liability, indemnification, governing law, and dispute resolution survive termination.</p>

          <h2>16. Changes to Terms</h2>
          <p>We may modify these Terms at any time. We will notify you of material changes by:</p>
          <ul>
            <li>Posting updated Terms with a new effective date</li>
            <li>Email notification (for registered users)</li>
            <li>In-app notification</li>
          </ul>
          <p>
            <strong>Material changes take effect 30 days after notice.</strong> Continued use after the effective date constitutes acceptance. If you disagree, you must stop using the Service before the changes take effect.
          </p>

          <h2>17. Governing Law and Dispute Resolution</h2>
          <h3>17.1 Governing Law</h3>
          <p>
            These Terms are governed by the laws of the <strong>State of Texas</strong>, without regard to conflict of law principles. The United Nations Convention on Contracts for the International Sale of Goods does not apply.
          </p>

          <h3>17.2 Informal Resolution</h3>
          <p>
            Before filing any claim, you agree to contact us at <a href="mailto:legal@getromy.app">legal@getromy.app</a> and attempt good-faith negotiation for at least 30 days.
          </p>

          <h3>17.3 Binding Arbitration</h3>
          <p>
            If informal resolution fails, disputes shall be resolved through <strong>binding arbitration</strong> administered by the American Arbitration Association (AAA) under their Commercial Arbitration Rules. The arbitration shall be held in <strong>Kerrville, Texas</strong> (or remotely by agreement). The arbitrator's decision is final and binding.
          </p>

          <h3>17.4 Class Action Waiver</h3>
          <p>
            <strong>YOU WAIVE ANY RIGHT TO PARTICIPATE IN CLASS ACTIONS.</strong> All disputes must be brought individually. You cannot bring claims as a plaintiff or class member in any class, consolidated, or representative proceeding.
          </p>

          <h3>17.5 Small Claims Exception</h3>
          <p>
            Either party may bring qualifying claims in small claims court in Kerr County, Texas.
          </p>

          <h2>18. General Provisions</h2>
          <h3>18.1 Entire Agreement</h3>
          <p>These Terms and our Privacy Policy constitute the entire agreement between you and GetRomy LLC.</p>

          <h3>18.2 Severability</h3>
          <p>If any provision is unenforceable, the remaining provisions remain in effect.</p>

          <h3>18.3 No Waiver</h3>
          <p>Our failure to enforce any provision does not waive our right to enforce it later.</p>

          <h3>18.4 Assignment</h3>
          <p>You cannot assign these Terms without our consent. We may assign our rights and obligations without restriction.</p>

          <h3>18.5 Force Majeure</h3>
          <p>Neither party is liable for failures caused by circumstances beyond reasonable control (natural disasters, war, government actions, internet outages, etc.).</p>

          <h3>18.6 Export Compliance</h3>
          <p>You agree to comply with all applicable export and import laws and regulations.</p>

          <h2>19. Contact Us</h2>
          <p>For questions about these Terms:</p>
          <p>
            <strong>Email:</strong> <a href="mailto:legal@getromy.app" className="text-foreground hover:underline">legal@getromy.app</a><br />
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
            <p>Last updated: December 27, 2024</p>
            <p>Version: 3.0</p>
          </div>
        </div>
      </div>
    </>
  )
}
