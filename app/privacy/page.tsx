/* eslint-disable react/no-unescaped-entities */

import { APP_DOMAIN } from "@/lib/config"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr"

export const metadata: Metadata = {
  title: "Privacy Policy - Rōmy",
  description: "Privacy Policy for Rōmy",
  openGraph: {
    title: "Privacy Policy - Rōmy",
    description: "Privacy Policy for Rōmy",
    type: "website",
    url: `${APP_DOMAIN}/privacy`,
  },
}

export default function PrivacyPolicy() {
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-24">
        <div className="mb-8 flex items-center justify-center gap-2 text-sm font-medium">
          <time className="text-foreground">Effective December 27, 2024</time>
        </div>

        <h1 className="mb-4 text-center text-4xl font-medium tracking-tight md:text-5xl">
          Privacy Policy
        </h1>

        <p className="text-foreground mb-8 text-center text-lg">
          How we protect and handle your data
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
              🔒 TL;DR — Privacy at a Glance
            </h2>
            <p className="text-sm mb-4">
              <em>This summary is for convenience only. The full policy below is legally binding.</em>
            </p>
            <ul className="text-sm space-y-2 mb-0">
              <li><strong>We don't sell your data.</strong> Ever. Not to advertisers, not to data brokers, not to anyone.</li>
              <li><strong>Your donor data stays yours.</strong> We only use it to power the AI features you're paying for.</li>
              <li><strong>AI providers see your prompts.</strong> When you chat, your messages go to AI providers (xAI, OpenAI, etc.) to generate responses. They have their own privacy policies.</li>
              <li><strong>Google Workspace access is limited.</strong> We only read what you authorize. Gmail = read emails + create drafts (never send). Drive = only files you pick.</li>
              <li><strong>CRM data is encrypted.</strong> API keys use AES-256-GCM encryption. Synced data stays in your account only.</li>
              <li><strong>Analytics are privacy-focused.</strong> We use PostHog. No cross-site tracking. You can opt out.</li>
              <li><strong>You can delete everything.</strong> Instant deletion — your data is gone immediately when you delete your account. Export first if you want a copy.</li>
              <li><strong>We log consent.</strong> When you accept cookies or connect services, we record it with timestamps for compliance.</li>
              <li><strong>California/EU users:</strong> You have extra rights (access, delete, opt-out). See Sections 10-11.</li>
              <li><strong>Texas-based company.</strong> GetRomy LLC, Kerrville, TX. Questions? privacy@getromy.app</li>
            </ul>
          </div>

          <h2>1. Introduction</h2>
          <p>
            Rōmy ("we," "us," "our," or "Company"), operated by GetRomy LLC, a Texas limited liability company, is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered donor research platform (the "Service").
          </p>
          <p>
            <strong>By using Rōmy, you agree to this Privacy Policy.</strong> If you do not agree, please do not use the Service.
          </p>

          <h2>2. Data We Collect</h2>
          <p>We believe in transparency. Here's exactly what we collect, why, and how long we keep it:</p>

          {/* Data Mapping Table - GDPR/CCPA compliant */}
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th>Data Category</th>
                  <th>What We Collect</th>
                  <th>Why (Lawful Basis)</th>
                  <th>Retention</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Account Info</strong></td>
                  <td>Name, email, profile picture (from Google OAuth or email signup)</td>
                  <td>Contract performance — to create and manage your account</td>
                  <td>Until account deletion + 30 days</td>
                </tr>
                <tr>
                  <td><strong>Chat Content</strong></td>
                  <td>Messages, prompts, AI responses, conversation history</td>
                  <td>Contract performance — core service functionality</td>
                  <td>Until you delete or account closure + 30 days</td>
                </tr>
                <tr>
                  <td><strong>Uploaded Files</strong></td>
                  <td>PDFs, spreadsheets, documents (donor lists, etc.)</td>
                  <td>Contract performance — document analysis feature</td>
                  <td>Until you delete or account closure + 30 days</td>
                </tr>
                <tr>
                  <td><strong>AI Memory</strong></td>
                  <td>Extracted facts and preferences from conversations</td>
                  <td>Consent — you enable this feature</td>
                  <td>Until you disable memory or delete account</td>
                </tr>
                <tr>
                  <td><strong>Gmail Data</strong></td>
                  <td>Email content, writing style profile, draft metadata</td>
                  <td>Consent — you connect Google account</td>
                  <td>Until you disconnect Google or delete account</td>
                </tr>
                <tr>
                  <td><strong>Google Drive</strong></td>
                  <td>Selected files, document text, embeddings</td>
                  <td>Consent — you select files via picker</td>
                  <td>Until you remove documents or disconnect</td>
                </tr>
                <tr>
                  <td><strong>CRM Data</strong></td>
                  <td>Constituents, donations, contacts (from Bloomerang, Virtuous, Neon)</td>
                  <td>Consent — you connect your CRM</td>
                  <td>Until you disconnect CRM or delete account</td>
                </tr>
                <tr>
                  <td><strong>Usage Data</strong></td>
                  <td>Features used, clicks, session duration, errors</td>
                  <td>Legitimate interest — product improvement</td>
                  <td>90 days (anonymized after)</td>
                </tr>
                <tr>
                  <td><strong>Technical Data</strong></td>
                  <td>IP address, browser, device, OS</td>
                  <td>Legitimate interest — security, debugging</td>
                  <td>30 days</td>
                </tr>
                <tr>
                  <td><strong>Payment Info</strong></td>
                  <td>Card details (via Stripe — we don't store full card numbers)</td>
                  <td>Contract performance — billing</td>
                  <td>Per Stripe's retention policy</td>
                </tr>
                <tr>
                  <td><strong>Consent Records</strong></td>
                  <td>Cookie consent, integration authorizations, timestamps</td>
                  <td>Legal obligation — GDPR/CCPA compliance</td>
                  <td>3 years after consent given</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>3. How We Use Your Data</h2>
          <p>We use your information to:</p>
          <ul>
            <li><strong>Provide the Service:</strong> Power AI conversations, store chats, enable integrations</li>
            <li><strong>Process AI requests:</strong> Send your prompts to AI providers (xAI, OpenAI, Anthropic, etc.) to generate responses</li>
            <li><strong>Personalize experience:</strong> Remember your preferences, enable AI Memory (if enabled)</li>
            <li><strong>Improve the product:</strong> Analyze usage patterns, fix bugs, develop features</li>
            <li><strong>Communicate:</strong> Send service updates, security notices, respond to support requests</li>
            <li><strong>Ensure security:</strong> Detect fraud, prevent abuse, enforce Terms of Service</li>
            <li><strong>Comply with law:</strong> Respond to legal requests, maintain required records</li>
          </ul>

          <h2>4. Google Workspace Integration</h2>
          <p>If you connect your Google account, here's exactly what we access:</p>

          <h3>4.1 Gmail Access</h3>
          <ul>
            <li><strong>Scope:</strong> <code>gmail.readonly</code> (read emails) + <code>gmail.compose</code> (create drafts)</li>
            <li><strong>What we read:</strong> Inbox and sent emails to provide AI context</li>
            <li><strong>What we create:</strong> Draft emails matching your writing style</li>
            <li><strong>What we NEVER do:</strong> Send emails, delete emails, or access emails without your request</li>
            <li><strong>Writing style:</strong> We analyze your sent emails to learn your tone, greetings, and phrasing</li>
          </ul>

          <h3>4.2 Google Drive Access</h3>
          <ul>
            <li><strong>Scope:</strong> <code>drive.file</code> (per-file access via picker only)</li>
            <li><strong>What we access:</strong> Only files you explicitly select using the file picker</li>
            <li><strong>What we do:</strong> Extract text, create embeddings for semantic search</li>
            <li><strong>What we NEVER do:</strong> Scan your entire Drive or access files you didn't select</li>
          </ul>

          <h3>4.3 Revocation</h3>
          <p>
            Disconnect anytime in Settings → Integrations → Google. This immediately revokes access and deletes:
          </p>
          <ul>
            <li>Writing style profile</li>
            <li>Draft metadata</li>
            <li>Indexed Drive documents</li>
            <li>OAuth tokens</li>
          </ul>

          <h2>5. CRM Integrations</h2>
          <p>When you connect a CRM (Bloomerang, Virtuous, or Neon CRM):</p>
          <ul>
            <li><strong>Credentials:</strong> Your API keys are encrypted with AES-256-GCM before storage</li>
            <li><strong>Data synced:</strong> Constituents/contacts, donations/gifts, basic metadata</li>
            <li><strong>Access:</strong> Only you can access your synced CRM data</li>
            <li><strong>Deletion:</strong> Disconnect in Settings to remove all synced data and credentials</li>
          </ul>

          <h2>6. AI Providers and Data Sharing</h2>
          <p>When you use Rōmy, your prompts are sent to AI providers to generate responses:</p>

          <table className="text-sm">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Data Shared</th>
                <th>Their Privacy Policy</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>xAI (Grok)</td>
                <td>Prompts, chat context</td>
                <td><a href="https://x.ai/legal/privacy-policy" target="_blank" rel="noopener noreferrer">x.ai/privacy</a></td>
              </tr>
              <tr>
                <td>OpenAI</td>
                <td>Prompts, chat context (via OpenRouter)</td>
                <td><a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer">openai.com/privacy</a></td>
              </tr>
              <tr>
                <td>Anthropic</td>
                <td>Prompts, chat context (via OpenRouter)</td>
                <td><a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer">anthropic.com/privacy</a></td>
              </tr>
              <tr>
                <td>Google</td>
                <td>Prompts (Gemini), OAuth data, Gmail/Drive data</td>
                <td><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a></td>
              </tr>
              <tr>
                <td>LinkUp</td>
                <td>Search queries for web research</td>
                <td><a href="https://linkup.so/privacy" target="_blank" rel="noopener noreferrer">linkup.so/privacy</a></td>
              </tr>
              <tr>
                <td>Supabase</td>
                <td>All cloud-stored data</td>
                <td><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a></td>
              </tr>
              <tr>
                <td>PostHog</td>
                <td>Usage analytics (anonymized)</td>
                <td><a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer">posthog.com/privacy</a></td>
              </tr>
              <tr>
                <td>Stripe (via Autumn)</td>
                <td>Payment information</td>
                <td><a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a></td>
              </tr>
            </tbody>
          </table>

          <p><strong>We do NOT:</strong></p>
          <ul>
            <li>Sell your data to third parties</li>
            <li>Share data with advertisers</li>
            <li>Use your data to train our own AI models</li>
            <li>Share your donor lists or CRM data with anyone</li>
          </ul>

          <h3>6.1 Client Data Protection Assurance</h3>
          <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-4">
            <p className="font-semibold text-green-600 dark:text-green-400">✓ Contractual Data Protection Commitments</p>
            <p>GetRomy LLC provides the following <strong>written assurances</strong> regarding your donor data:</p>
            <ul>
              <li><strong>a) Purpose Limitation:</strong> Your donor data will be used <strong>SOLELY</strong> for the purpose of helping your organization achieve its charitable mission through prospect research and donor intelligence.</li>
              <li><strong>b) No Sale of Data:</strong> We will <strong>NEVER</strong> sell, license, rent, or transfer your donor data to any third party for any purpose.</li>
              <li><strong>c) No Cross-Client Use:</strong> Your donor data will <strong>NEVER</strong> be used to benefit any other client of GetRomy LLC. Each client's data is completely isolated through Row-Level Security (RLS) policies.</li>
              <li><strong>d) No Marketing Use:</strong> Your donor data will <strong>NEVER</strong> be used for marketing, advertising, lead generation, or any purpose other than providing the contracted services.</li>
              <li><strong>e) Confidentiality:</strong> All personnel with access to your data are bound by confidentiality agreements. Access is limited to those who need it to provide the Service.</li>
            </ul>
            <p className="mb-0"><strong>These assurances are contractually binding and survive termination of service.</strong></p>
          </div>

          <h3>6.2 Authorized Subprocessors</h3>
          <p>The following subprocessors are authorized to process your data as part of delivering the Service:</p>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th>Subprocessor</th>
                  <th>Purpose</th>
                  <th>Location</th>
                  <th>Compliance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Supabase Inc.</td>
                  <td>Database, Authentication, File Storage</td>
                  <td>US (AWS)</td>
                  <td>SOC 2 Type II, HIPAA</td>
                </tr>
                <tr>
                  <td>OpenRouter Inc.</td>
                  <td>AI Model Routing</td>
                  <td>US</td>
                  <td>SOC 2 Type II</td>
                </tr>
                <tr>
                  <td>xAI Corp</td>
                  <td>Grok AI Model</td>
                  <td>US</td>
                  <td>Enterprise Terms</td>
                </tr>
                <tr>
                  <td>Stripe Inc.</td>
                  <td>Payment Processing</td>
                  <td>US</td>
                  <td>SOC 2 Type II, PCI DSS Level 1</td>
                </tr>
                <tr>
                  <td>PostHog Inc.</td>
                  <td>Product Analytics (anonymized)</td>
                  <td>US</td>
                  <td>GDPR Compliant, SOC 2 Type II</td>
                </tr>
                <tr>
                  <td>LinkUp Inc.</td>
                  <td>Web Research</td>
                  <td>US</td>
                  <td>Enterprise Terms</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <strong>Notification of Changes:</strong> We will provide <strong>30 days written notice</strong> before adding new subprocessors. You may object to new subprocessors within 14 days of notification by contacting <a href="mailto:privacy@getromy.app">privacy@getromy.app</a>.
          </p>
          <p className="text-sm text-muted-foreground">
            <em>Subprocessor list last updated: January 2025</em>
          </p>

          <h2>7. Cookies and Tracking</h2>

          <h3>7.1 What We Use</h3>
          <table className="text-sm">
            <thead>
              <tr>
                <th>Cookie Type</th>
                <th>Purpose</th>
                <th>Can You Opt Out?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Essential</strong></td>
                <td>Authentication, CSRF protection, session management</td>
                <td>No (required for the app to work)</td>
              </tr>
              <tr>
                <td><strong>Preferences</strong></td>
                <td>Theme (dark/light), language, UI settings</td>
                <td>Clearing these resets your preferences</td>
              </tr>
              <tr>
                <td><strong>Analytics (PostHog)</strong></td>
                <td>Feature usage, product improvement</td>
                <td>Yes — see below</td>
              </tr>
            </tbody>
          </table>

          <h3>7.2 Consent Logging</h3>
          <p>
            When you accept cookies or consent to optional features, we log:
          </p>
          <ul>
            <li>What you consented to</li>
            <li>Timestamp of consent</li>
            <li>Your user ID (if logged in)</li>
            <li>IP address (hashed)</li>
          </ul>
          <p>This log allows you to withdraw consent and proves compliance if regulators ask.</p>

          <h3>7.3 Opting Out of Analytics</h3>
          <p>You can opt out of PostHog analytics by:</p>
          <ul>
            <li>Enabling "Do Not Track" in your browser</li>
            <li>Using a privacy-focused browser (Brave, Firefox with tracking protection)</li>
            <li>Emailing <a href="mailto:privacy@getromy.app">privacy@getromy.app</a> with "Opt out of analytics"</li>
          </ul>

          <h2>8. Data Storage and Security</h2>

          <h3>8.1 Where Data Lives</h3>
          <ul>
            <li><strong>Cloud mode:</strong> Data stored in Supabase (AWS infrastructure, US regions)</li>
            <li><strong>Local mode:</strong> Data stays in your browser's IndexedDB — we never see it</li>
          </ul>

          <h3>8.2 Security Measures</h3>
          <ul>
            <li><strong>Encryption in transit:</strong> TLS 1.3 for all connections</li>
            <li><strong>Encryption at rest:</strong> AES-256 for database, AES-256-GCM for API keys</li>
            <li><strong>Authentication:</strong> OAuth 2.0, secure session tokens</li>
            <li><strong>Access control:</strong> Row-level security (RLS) — users only see their own data</li>
            <li><strong>Audit logging:</strong> Security events logged for monitoring</li>
          </ul>

          <h3>8.3 Data Retention</h3>
          <ul>
            <li><strong>Active accounts:</strong> Data kept while your account is active</li>
            <li><strong>Inactive accounts:</strong> Accounts inactive 24+ months may be deleted (with 30-day notice)</li>
            <li><strong>Deleted accounts:</strong> Data deleted within 30 days (except legal holds)</li>
            <li><strong>Backups:</strong> Retained up to 30 days, then purged</li>
          </ul>

          <h2>9. Your Rights — Everyone</h2>
          <p>Regardless of where you live, you can:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your data</li>
            <li><strong>Delete:</strong> Request deletion of your account and data</li>
            <li><strong>Export:</strong> Download your data in standard formats (JSON, CSV)</li>
            <li><strong>Correct:</strong> Update inaccurate information</li>
            <li><strong>Disconnect:</strong> Revoke access to Google, CRMs, and third-party integrations</li>
          </ul>
          <p>
            <strong>To exercise these rights:</strong> Email <a href="mailto:privacy@getromy.app">privacy@getromy.app</a> with your request. We'll respond within 10 business days and complete requests within 30 days.
          </p>

          <h2>10. California Residents (CCPA/CPRA)</h2>
          <div className="rounded-lg border-2 border-blue-500/30 bg-blue-500/5 p-4">
            <p className="font-semibold text-blue-600 dark:text-blue-400">🇺🇸 California Privacy Rights</p>

            <p><strong>Your Rights:</strong></p>
            <ul>
              <li><strong>Right to Know:</strong> What personal information we collect, use, and share</li>
              <li><strong>Right to Delete:</strong> Request deletion of your personal information</li>
              <li><strong>Right to Correct:</strong> Fix inaccurate personal information</li>
              <li><strong>Right to Opt-Out of Sale/Sharing:</strong> See below</li>
              <li><strong>Right to Limit Use:</strong> Restrict use of sensitive personal information</li>
              <li><strong>Right to Non-Discrimination:</strong> We won't penalize you for exercising your rights</li>
            </ul>

            <p><strong>Do We Sell or Share Your Data?</strong></p>
            <p>
              <strong>No.</strong> Rōmy does not sell personal information. We do not share personal information for cross-context behavioral advertising.
            </p>
            <p>
              We share data only with service providers who help us operate the Service (AI providers, hosting, analytics). This is not a "sale" or "sharing" under CCPA because these providers are contractually prohibited from using your data for their own purposes.
            </p>
            <p>
              <strong>If this ever changes</strong>, we will update this policy and add a "Do Not Sell or Share My Personal Information" link.
            </p>

            <p><strong>Categories of PI Collected:</strong></p>
            <ul>
              <li>Identifiers (name, email, IP address)</li>
              <li>Commercial information (subscription, usage)</li>
              <li>Internet activity (browsing, interactions)</li>
              <li>Inferences (AI-generated insights)</li>
              <li>Sensitive: None collected beyond what you voluntarily provide</li>
            </ul>
          </div>

          <h2>11. European Users (GDPR)</h2>
          <div className="rounded-lg border-2 border-purple-500/30 bg-purple-500/5 p-4">
            <p className="font-semibold text-purple-600 dark:text-purple-400">🇪🇺 EU/EEA/UK Privacy Rights</p>

            <p><strong>Legal Bases for Processing:</strong></p>
            <ul>
              <li><strong>Contract:</strong> Account creation, core service functionality</li>
              <li><strong>Consent:</strong> Optional features (AI Memory, Google integration, analytics)</li>
              <li><strong>Legitimate Interest:</strong> Security, fraud prevention, product improvement</li>
              <li><strong>Legal Obligation:</strong> Tax records, compliance requests</li>
            </ul>

            <p><strong>Your GDPR Rights:</strong></p>
            <ul>
              <li>Right of Access (Art. 15)</li>
              <li>Right to Rectification (Art. 16)</li>
              <li>Right to Erasure / Right to be Forgotten (Art. 17)</li>
              <li>Right to Restrict Processing (Art. 18)</li>
              <li>Right to Data Portability (Art. 20)</li>
              <li>Right to Object (Art. 21)</li>
              <li>Right to Withdraw Consent (Art. 7)</li>
            </ul>

            <p><strong>International Transfers:</strong></p>
            <p>
              Your data may be transferred to the United States. We use Standard Contractual Clauses (SCCs) approved by the European Commission to ensure adequate protection.
            </p>

            <p><strong>Complaints:</strong></p>
            <p>
              You may lodge a complaint with your local Data Protection Authority:
            </p>
            <ul>
              <li><strong>EU:</strong> <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener noreferrer">Find your DPA</a></li>
              <li><strong>UK:</strong> <a href="https://ico.org.uk/" target="_blank" rel="noopener noreferrer">ICO</a></li>
            </ul>
          </div>

          <h2>12. Other Jurisdictions</h2>

          <h3>12.1 Texas (TDPSA)</h3>
          <p>
            Texas residents have rights under the Texas Data Privacy and Security Act, including access, deletion, correction, and opt-out of targeted advertising. Contact us at <a href="mailto:privacy@getromy.app">privacy@getromy.app</a> to exercise these rights.
          </p>

          <h3>12.2 Canada (PIPEDA)</h3>
          <p>
            Canadian users have rights under PIPEDA, including access to and correction of personal information. You may file complaints with the <a href="https://www.priv.gc.ca/" target="_blank" rel="noopener noreferrer">Office of the Privacy Commissioner of Canada</a>.
          </p>

          <h3>12.3 Other US States</h3>
          <p>
            If you reside in Colorado, Connecticut, Delaware, Iowa, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Utah, Virginia, or other states with privacy laws, you likely have similar rights to California residents. Contact us to exercise them.
          </p>

          <h2>13. Children's Privacy</h2>
          <p>
            <strong>Rōmy is not for children under 18.</strong> We do not knowingly collect personal information from anyone under 18 (or 16 in the EEA). If you believe a child has provided us data, contact <a href="mailto:privacy@getromy.app">privacy@getromy.app</a> immediately. We will delete it within 30 days.
          </p>

          <h2>14. Data Deletion and Export</h2>
          <p><strong>You have full control over your data.</strong> You can export and/or delete your data at any time — completely or selectively.</p>

          <h3>14.1 Export Your Data</h3>
          <p><strong>Complete Export:</strong></p>
          <ul>
            <li>Download everything: chats, files, AI memories, CRM data, settings</li>
            <li>Formats: JSON (structured) or CSV (spreadsheet-compatible)</li>
            <li>Go to Settings → Data → Export All, or email <a href="mailto:privacy@getromy.app">privacy@getromy.app</a></li>
          </ul>
          <p><strong>Partial Export:</strong></p>
          <ul>
            <li>Export specific chats or conversations</li>
            <li>Export by date range (e.g., "last 30 days")</li>
            <li>Export by data type (e.g., "only CRM data" or "only chat history")</li>
            <li>Email <a href="mailto:privacy@getromy.app">privacy@getromy.app</a> with your specific request</li>
          </ul>

          <h3>14.2 Delete Your Data</h3>
          <p><strong>Complete Deletion (Delete Everything):</strong></p>
          <ol>
            <li>Go to Settings → Account → Delete Account</li>
            <li>Confirm deletion</li>
            <li>All your data is <strong>permanently and instantly deleted</strong></li>
          </ol>
          <p>Or email <a href="mailto:privacy@getromy.app">privacy@getromy.app</a> with subject "Delete My Account".</p>
          <p className="text-sm bg-amber-500/10 border border-amber-500/30 rounded p-3">
            <strong>⚠️ Warning:</strong> Deletion is immediate and irreversible. Export your data first if you want to keep a copy.
          </p>

          <p><strong>Selective Deletion (Keep Your Account):</strong></p>
          <ul>
            <li><strong>Delete specific chats:</strong> Click the trash icon on any chat</li>
            <li><strong>Delete AI memories:</strong> Settings → Memory → Delete individual or all memories</li>
            <li><strong>Delete uploaded files:</strong> Remove files from chat attachments</li>
            <li><strong>Delete CRM data:</strong> Settings → Integrations → Disconnect CRM (removes all synced data)</li>
            <li><strong>Delete Google data:</strong> Settings → Integrations → Disconnect Google (removes writing style, drafts, indexed docs)</li>
          </ul>

          <h3>14.3 What Gets Deleted (Complete Deletion)</h3>
          <ul>
            <li>Account information (name, email, profile)</li>
            <li>All chat history and conversations</li>
            <li>All uploaded files and attachments</li>
            <li>All AI memories</li>
            <li>Google integration data (writing style profile, draft metadata, indexed Drive documents)</li>
            <li>CRM data and encrypted API credentials</li>
            <li>All preferences and settings</li>
          </ul>

          <h3>14.4 What We May Retain</h3>
          <ul>
            <li>Anonymized, aggregated analytics (cannot identify you)</li>
            <li>Billing records (legal/tax requirement — typically 7 years)</li>
            <li>Data subject to active legal holds or investigations</li>
          </ul>

          <h3>14.5 Deletion Timeline</h3>
          <ul>
            <li><strong>Account deletion:</strong> Instant — data removed immediately upon confirmation</li>
            <li><strong>Backups:</strong> Purged within 24 hours</li>
            <li><strong>Third-party systems:</strong> We request deletion from providers immediately; most complete within 24-48 hours</li>
          </ul>

          <h2>15. Changes to This Policy</h2>
          <p>We may update this Privacy Policy. When we do:</p>
          <ul>
            <li>We'll update the "Effective" date at the top</li>
            <li>For material changes, we'll email you and/or show an in-app notification</li>
            <li>Material changes take effect 30 days after notice</li>
            <li>Continued use after the effective date = acceptance</li>
          </ul>

          <h2>16. Contact Us</h2>
          <p>Questions, concerns, or requests? Contact us:</p>
          <p>
            <strong>Email:</strong> <a href="mailto:privacy@getromy.app">privacy@getromy.app</a><br />
            <strong>Security issues:</strong> <a href="mailto:security@getromy.app">security@getromy.app</a><br />
            <strong>Legal/Terms:</strong> <a href="mailto:legal@getromy.app">legal@getromy.app</a>
          </p>
          <p>
            <strong>Mailing Address:</strong><br />
            GetRomy LLC<br />
            Kerrville, TX 78028<br />
            United States
          </p>
          <p>
            <strong>Response Time:</strong> We acknowledge requests within 10 business days and complete them within 30-45 days depending on complexity and jurisdiction.
          </p>

          <h2>17. Open Source Transparency</h2>
          <p>
            Rōmy is open-source. You can review our code, data handling, and security implementations on GitHub. This transparency allows independent verification of our privacy practices.
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
