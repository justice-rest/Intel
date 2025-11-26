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
          <time className="text-foreground">Effective November 25, 2025</time>
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
          <h2>1. Introduction</h2>
          <p>
            Rōmy ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered chat platform designed to help small nonprofits find new major donors.
          </p>
          <p>
            This policy applies to all users of Rōmy, whether you use the Service with cloud storage (Supabase) or in local-only mode. By using the Service, you consent to the data practices described in this policy.
          </p>

          <h2>2. Information We Collect</h2>
          <h3>2.1 Information You Provide Directly</h3>
          <p>
            <strong>Account Information:</strong> When you create an account using Google authentication, we collect:
          </p>
          <ul>
            <li>Name</li>
            <li>Email address</li>
            <li>Profile picture (from Google)</li>
            <li>Google account ID</li>
          </ul>

          <p>
            <strong>Chat Content:</strong> We collect and store:
          </p>
          <ul>
            <li>Your messages and prompts</li>
            <li>AI-generated responses</li>
            <li>Chat titles and metadata</li>
            <li>System prompts and preferences</li>
            <li>Message timestamps and groupings</li>
          </ul>

          <p>
            <strong>Files and Attachments:</strong> When you upload files, we collect:
          </p>
          <ul>
            <li>File content (images, PDFs, text documents, spreadsheets)</li>
            <li>File metadata (name, size, type, upload timestamp)</li>
            <li>File attachments are limited to 10MB per file and 5 files per day</li>
          </ul>

          <p>
            <strong>User Preferences:</strong> We collect your settings and preferences, including:
          </p>
          <ul>
            <li>UI layout preferences</li>
            <li>Prompt suggestion settings</li>
            <li>Favorite models</li>
            <li>Hidden models</li>
            <li>Tool invocation display preferences</li>
          </ul>

          <h3>2.2 Information Collected Automatically</h3>
          <p>
            <strong>Usage Data:</strong> We automatically collect:
          </p>
          <ul>
            <li>Message counts and usage statistics</li>
            <li>Model selection and usage patterns</li>
            <li>Feature interactions</li>
            <li>Rate limit tracking (daily message count, file upload count)</li>
            <li>Timestamps of service interactions</li>
          </ul>

          <p>
            <strong>Technical Information:</strong> We may collect:
          </p>
          <ul>
            <li>Browser type and version</li>
            <li>Device information</li>
            <li>IP address</li>
            <li>Operating system</li>
            <li>Referring URLs</li>
          </ul>

          <p>
            <strong>Analytics Data:</strong> Through PostHog (optional, when configured):
          </p>
          <ul>
            <li>Page views and navigation patterns</li>
            <li>User interaction events (chat creation, model selection, settings changes)</li>
            <li>Feature usage statistics</li>
            <li>Session recordings (only when explicitly enabled and for authenticated users)</li>
            <li>We use a "identified_only" profile policy, creating user profiles only for logged-in users</li>
          </ul>

          <h3>2.3 Information from Third Parties</h3>
          <p>
            <strong>Authentication Provider (Google):</strong> We receive basic profile information when you sign in with Google.
          </p>
          <p>
            <strong>AI Service Provider:</strong> When you use AI models, your prompts and content are processed by xAI (Grok). xAI has its own privacy policy governing their data practices.
          </p>

          <h2>3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li><strong>Provide the Service:</strong> Process your prompts, generate AI responses, store conversations, and manage file uploads</li>
            <li><strong>Maintain Accounts:</strong> Authenticate users, manage account settings, and provide personalized experiences</li>
            <li><strong>Enforce Usage Limits:</strong> Track and enforce rate limits to ensure fair usage and service stability</li>
            <li><strong>Improve the Service:</strong> Analyze usage patterns, identify bugs, develop new features, and optimize performance</li>
            <li><strong>Security:</strong> Detect and prevent fraud, abuse, and security incidents</li>
            <li><strong>Communicate:</strong> Send service updates, respond to inquiries, and provide customer support</li>
            <li><strong>Comply with Law:</strong> Meet legal obligations and respond to lawful requests</li>
            <li><strong>Analytics:</strong> Understand how users interact with the Service to improve user experience (when PostHog is configured)</li>
          </ul>

          <h2>4. Data Storage and Architecture</h2>
          <h3>4.1 Hybrid Storage Architecture</h3>
          <p>
            Rōmy operates in a hybrid architecture that supports both cloud and local storage:
          </p>

          <p>
            <strong>With Supabase Enabled (Cloud Mode):</strong>
          </p>
          <ul>
            <li>User accounts, messages, chats, and preferences are stored in Supabase (PostgreSQL database)</li>
            <li>File attachments are stored in Supabase Storage buckets</li>
            <li>Data is synchronized across devices</li>
            <li>Encrypted API keys are stored in the database</li>
            <li>Data is cached locally in IndexedDB for performance</li>
          </ul>

          <p>
            <strong>Without Supabase (Local-Only Mode):</strong>
          </p>
          <ul>
            <li>All data is stored exclusively in your browser using IndexedDB</li>
            <li>No data is transmitted to our servers</li>
            <li>Data is device-specific and not synchronized</li>
            <li>File uploads are not available in local-only mode</li>
            <li>Guest user mode is automatically enabled</li>
          </ul>

          <h3>4.2 Data Retention</h3>
          <p>
            <strong>Active Accounts:</strong> We retain your data for as long as your account is active or as needed to provide the Service.
          </p>
          <p>
            <strong>Inactive Accounts:</strong> Accounts inactive for extended periods may be subject to deletion after notice.
          </p>
          <p>
            <strong>Deleted Accounts:</strong> When you delete your account, we will delete your personal information within 30 days, except where retention is required by law.
          </p>
          <p>
            <strong>Local Storage:</strong> Data in IndexedDB remains on your device until you clear your browser data.
          </p>

          <h2>5. How We Share Your Information</h2>
          <h3>5.1 Third-Party AI Provider</h3>
          <p>
            When you use AI models, your prompts and content are sent to xAI (Grok) for processing. Your content is sent using our service infrastructure, subject to xAI's privacy policies.
          </p>

          <h3>5.2 Service Providers</h3>
          <p>We may share data with trusted service providers who assist us in operating the Service:</p>
          <ul>
            <li><strong>Supabase:</strong> Cloud database and storage (when enabled)</li>
            <li><strong>PostHog:</strong> Analytics and product insights (when configured)</li>
            <li><strong>Exa:</strong> Web search capabilities (when enabled)</li>
            <li><strong>Google:</strong> Authentication services</li>
          </ul>
          <p>
            These providers are contractually obligated to protect your information and use it only for specified purposes.
          </p>

          <h3>5.3 Legal Requirements</h3>
          <p>We may disclose your information if required to:</p>
          <ul>
            <li>Comply with legal obligations, court orders, or government requests</li>
            <li>Enforce our Terms of Service</li>
            <li>Protect our rights, property, or safety, or that of others</li>
            <li>Investigate fraud, security issues, or technical problems</li>
          </ul>

          <h3>5.4 Business Transfers</h3>
          <p>
            In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity. We will notify you of any such change in ownership.
          </p>

          <h3>5.5 Aggregated Data</h3>
          <p>
            We may share aggregated, anonymized data that does not identify you personally for research, marketing, or analytics purposes.
          </p>

          <h2>6. Your Privacy Rights</h2>
          <h3>6.1 GDPR Rights (European Users)</h3>
          <p>If you are in the European Economic Area, you have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
            <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
            <li><strong>Restriction:</strong> Restrict processing of your data</li>
            <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
            <li><strong>Object:</strong> Object to processing of your data</li>
            <li><strong>Withdraw Consent:</strong> Withdraw consent at any time (without affecting prior processing)</li>
            <li><strong>Complain:</strong> Lodge a complaint with your supervisory authority</li>
          </ul>

          <h3>6.2 CCPA Rights (California Users)</h3>
          <p>If you are a California resident, you have the right to:</p>
          <ul>
            <li><strong>Know:</strong> Request disclosure of personal information collected, used, and shared</li>
            <li><strong>Delete:</strong> Request deletion of your personal information</li>
            <li><strong>Opt-Out:</strong> Opt out of the sale of personal information (Note: We do not sell personal information)</li>
            <li><strong>Non-Discrimination:</strong> Not receive discriminatory treatment for exercising your rights</li>
            <li><strong>Correct:</strong> Request correction of inaccurate personal information</li>
            <li><strong>Limit Use:</strong> Limit use and disclosure of sensitive personal information</li>
          </ul>

          <h3>6.3 Other State Privacy Laws</h3>
          <p>
            Residents of Colorado, Connecticut, Delaware, Iowa, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Texas, Utah, Virginia, and other states with comprehensive privacy laws have similar rights. Please contact us to exercise your rights.
          </p>

          <h3>6.4 How to Exercise Your Rights</h3>
          <p>
            To exercise any of these rights, please contact:
          </p>
          <ul>
            <li>CEO: <a href="mailto:howard@getromy.app" className="text-foreground hover:underline">howard@getromy.app</a></li>
            <li>VP of Product: <a href="mailto:solomon@getromy.app" className="text-foreground hover:underline">solomon@getromy.app</a></li>
          </ul>
          <p>
            We will respond within the timeframes required by applicable law (typically 30-45 days).
          </p>

          <h2>7. Data Security</h2>
          <p>We implement industry-standard security measures to protect your information:</p>
          <ul>
            <li><strong>HTTPS:</strong> All data transmitted between your browser and our servers uses TLS encryption</li>
            <li><strong>Authentication:</strong> Secure OAuth 2.0 authentication via Google</li>
            <li><strong>CSRF Protection:</strong> Cross-Site Request Forgery tokens on all state-changing requests</li>
            <li><strong>Content Security Policy:</strong> Strict CSP headers to prevent XSS attacks</li>
            <li><strong>Input Sanitization:</strong> All user inputs are sanitized before storage</li>
            <li><strong>Row Level Security:</strong> Database-level access controls in Supabase</li>
            <li><strong>Access Controls:</strong> Limited employee access to production data</li>
          </ul>
          <p>
            However, no system is completely secure. You use the Service at your own risk and should take appropriate precautions with sensitive information.
          </p>

          <h2>8. Cookies and Tracking Technologies</h2>
          <h3>8.1 Cookies We Use</h3>
          <p>
            <strong>Essential Cookies:</strong> Required for authentication, session management, and CSRF protection.
          </p>
          <p>
            <strong>Preference Cookies:</strong> Store your settings and preferences locally.
          </p>
          <p>
            <strong>Analytics Cookies:</strong> When PostHog is configured, we use cookies to analyze usage patterns and improve the Service.
          </p>

          <h3>8.2 Local Storage</h3>
          <p>
            We use IndexedDB and localStorage to cache data locally for performance and offline functionality. This includes chat history, preferences, and model information.
          </p>

          <h3>8.3 Managing Cookies</h3>
          <p>
            You can control cookies through your browser settings. Note that disabling essential cookies may affect Service functionality.
          </p>

          <h2>9. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws than your jurisdiction.
          </p>
          <p>
            When we transfer data internationally, we ensure appropriate safeguards are in place, such as:
          </p>
          <ul>
            <li>Standard Contractual Clauses approved by the European Commission</li>
            <li>Adequacy decisions</li>
            <li>Appropriate security measures</li>
          </ul>

          <h2>10. Children's Privacy</h2>
          <p>
            Rōmy is not intended for children under 13 years of age (or 16 in the European Economic Area). We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately and we will delete it.
          </p>

          <h2>11. AI-Specific Privacy Considerations</h2>
          <h3>11.1 AI Training</h3>
          <p>
            <strong>Our Service:</strong> We do not use your conversations to train our own AI models. Rōmy is a platform that connects you to xAI's Grok model.
          </p>
          <p>
            <strong>xAI (Grok):</strong> xAI has its own policies on data usage for model training. Please review xAI's privacy policy for details on their training practices and data usage policies.
          </p>

          <h3>11.2 Automated Decision-Making</h3>
          <p>
            The Service uses AI models to generate responses based on your prompts. You are not subject to automated decision-making that produces legal or similarly significant effects without human oversight. All AI outputs should be reviewed and verified by you before use.
          </p>

          <h3>11.3 Data Processing Transparency</h3>
          <p>
            When you submit a prompt:
          </p>
          <ol>
            <li>Your message is stored in our database (cloud or local)</li>
            <li>The message is sent to the selected AI provider for processing</li>
            <li>The AI-generated response is received and stored</li>
            <li>Both your message and the response are displayed in your chat interface</li>
          </ol>
          <p>
            You can see which model generated each response in your chat history.
          </p>

          <h2>12. Web Search and External Data</h2>
          <p>
            When you enable web search features:
          </p>
          <ul>
            <li>Search queries may be sent to Exa (when configured) or OpenRouter's search engine</li>
            <li>Search results and sources are displayed in your chat</li>
            <li>Search queries and results are stored as part of your conversation</li>
            <li>External websites may track your visits when you click on search result links</li>
          </ul>

          <h2>13. Third-Party Links</h2>
          <p>
            The Service may contain links to third-party websites and services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any information.
          </p>

          <h2>14. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of material changes by:
          </p>
          <ul>
            <li>Posting the updated policy with a new "Effective Date"</li>
            <li>Providing notice through the Service or via email (for authenticated users)</li>
            <li>Requiring acceptance for material changes that affect your rights</li>
          </ul>
          <p>
            Your continued use of the Service after changes become effective constitutes acceptance of the updated Privacy Policy.
          </p>

          <h2>15. Data Protection Officer</h2>
          <p>
            For privacy-related inquiries, you may contact our team at:
          </p>
          <ul>
            <li>CEO: <a href="mailto:howard@getromy.app" className="text-foreground hover:underline">howard@getromy.app</a></li>
            <li>VP of Product: <a href="mailto:solomon@getromy.app" className="text-foreground hover:underline">solomon@getromy.app</a></li>
          </ul>

          <h2>16. Open Source Transparency</h2>
          <p>
            Rōmy is open-source software. You can review our code, data handling practices, and security implementations in our public repository. This transparency allows independent verification of our privacy practices.
          </p>

          <h2>17. Your Consent</h2>
          <p>
            By using Rōmy, you consent to this Privacy Policy and agree to its terms. If you do not agree, please do not use the Service.
          </p>

          <h2>18. Contact Us</h2>
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
          </p>
          <ul>
            <li>CEO: <a href="mailto:howard@getromy.app" className="text-foreground hover:underline">howard@getromy.app</a></li>
            <li>VP of Product: <a href="mailto:solomon@getromy.app" className="text-foreground hover:underline">solomon@getromy.app</a></li>
          </ul>

          <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
            <p>Last updated: November 25, 2025</p>
          </div>
        </div>
      </div>
    </>
  )
}
