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
          <time className="text-foreground">Effective November 28, 2025</time>
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
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Rōmy ("Service", "Platform", "we", "us", or "our"), operated by GetRomy LLC ("Provider"), you ("Customer") agree to be bound by these Terms of Service ("Terms" or "Agreement"). If you do not agree to these Terms, do not use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Rōmy is an AI-powered chat platform designed to help small nonprofits find new major donors. The Service provides:
          </p>
          <ul>
            <li>Access to xAI's Grok AI language model for intelligent conversations and research</li>
            <li>File upload capabilities for document analysis</li>
            <li>Web search integration for enhanced research capabilities</li>
            <li>Cloud-based or local-only data storage options</li>
          </ul>

          <h2>3. User Accounts and Authentication</h2>
          <h3>3.1 Account Creation</h3>
          <p>
            To access certain features, you may need to create an account using Google authentication. You are responsible for maintaining the confidentiality of your account credentials.
          </p>

          <h3>3.2 Guest Access</h3>
          <p>
            The Service may be used in guest mode with limited functionality. Guest users are subject to reduced rate limits and restricted features.
          </p>

          <h3>3.3 Account Responsibilities</h3>
          <p>
            You are responsible for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
          </p>

          <h2>4. Usage Limits and Rate Limiting</h2>
          <p>
            The Service implements the following usage limits:
          </p>
          <ul>
            <li>Unauthenticated users: 5 messages per day</li>
            <li>Authenticated users: 1,000 messages per day</li>
            <li>Pro models: 500 lifetime calls per user</li>
            <li>File uploads: 5 files per day (max 10MB per file)</li>
          </ul>
          <p>
            We reserve the right to modify these limits at any time to ensure fair usage and service stability.
          </p>

          <h2>5. Acceptable Use</h2>
          <h3>5.1 Prohibited Activities</h3>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe upon the rights of others, including intellectual property rights</li>
            <li>Transmit harmful, threatening, abusive, harassing, or offensive content</li>
            <li>Attempt to gain unauthorized access to the Service or related systems</li>
            <li>Interfere with or disrupt the Service or servers</li>
            <li>Use automated means to access the Service without permission</li>
            <li>Reverse engineer or attempt to extract source code</li>
            <li>Generate spam, phishing content, or malicious materials</li>
            <li>Violate the terms of service of xAI or our Service</li>
          </ul>

          <h3>5.2 Content Restrictions</h3>
          <p>
            When using AI models through our Service, you must comply with xAI's acceptable use policies. We reserve the right to refuse service or terminate accounts that violate these policies.
          </p>

          <h2>6. Data Ownership and Restricted Use</h2>
          <h3>6.1 Your Data Ownership</h3>
          <p>
            Customer retains all right, title, and interest in and to the Customer Data (including but not limited to donor lists, contact information, and website visitor logs). You grant Provider a limited, non-exclusive, non-transferable license to use Customer Data <strong>solely as necessary to provide the Services to Customer.</strong>
          </p>

          <h3>6.2 Data Use Restrictions</h3>
          <p>
            Provider shall not:
          </p>
          <ul>
            <li>Sell, rent, lease, or otherwise disclose Customer Data to any third party for such third party's own business purposes</li>
            <li>Incorporate Customer Data into any public or shared dataset that is accessible by other customers of Provider</li>
            <li>Use Customer Data for any purpose other than providing the Service to you</li>
          </ul>

          <h3>6.3 AI-Generated Content</h3>
          <p>
            Content generated by xAI's Grok model through the Service is provided as-is. You are responsible for reviewing and verifying all AI-generated content before use. We make no warranties regarding accuracy, completeness, or reliability of AI outputs.
          </p>

          <h3>6.4 Data Storage</h3>
          <p>
            Depending on your configuration:
          </p>
          <ul>
            <li>With Supabase enabled: Data is stored in our cloud database</li>
            <li>Without Supabase: Data is stored locally in your browser using IndexedDB</li>
          </ul>

          <h2>7. Privacy and Data Protection</h2>
          <p>
            Your use of the Service is subject to our Privacy Policy, which is incorporated by reference into these Terms. Please review our <Link href="/privacy" className="text-foreground hover:underline">Privacy Policy</Link> to understand our data practices.
          </p>

          <h2>8. Intellectual Property</h2>
          <h3>8.1 Service Ownership</h3>
          <p>
            The Service, including its design, code, branding, and documentation, is owned by Rōmy and protected by copyright, trademark, and other intellectual property laws.
          </p>

          <h3>8.2 Open Source</h3>
          <p>
            Rōmy is open-source software. The source code is available under the license specified in our repository. This does not grant rights to our trademarks or service marks.
          </p>

          <h2>9. Third-Party Services</h2>
          <p>
            The Service integrates with third-party providers, including:
          </p>
          <ul>
            <li>AI model provider (xAI)</li>
            <li>Search services (Exa, Linkup)</li>
            <li>Analytics (PostHog)</li>
            <li>Authentication (Google)</li>
            <li>Cloud storage (Supabase)</li>
          </ul>
          <p>
            Your use of these services is subject to their respective terms of service and privacy policies. We are not responsible for the practices or content of third-party services.
          </p>

          <h2>10. Disclaimers and Limitations of Liability</h2>
          <h3>10.1 Service Availability</h3>
          <p>
            The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement.
          </p>

          <h3>10.2 No Warranty</h3>
          <p>
            We do not warrant that:
          </p>
          <ul>
            <li>The Service will be uninterrupted, secure, or error-free</li>
            <li>AI-generated content will be accurate, complete, or reliable</li>
            <li>Defects will be corrected</li>
            <li>The Service is free from viruses or harmful components</li>
          </ul>

          <h3>10.3 Limitation of Liability</h3>
          <p>
            In no event shall either party's aggregate liability arising out of or related to this Agreement exceed the <strong>total amount paid by Customer hereunder in the twelve (12) months preceding the last event giving rise to liability.</strong>
          </p>
          <p>
            <strong>The foregoing limitation shall not apply to:</strong>
          </p>
          <ul>
            <li>Either party's indemnification obligations under Section 11 of this Agreement</li>
            <li>Liability resulting from gross negligence or willful misconduct</li>
            <li>Liability resulting from a breach of data security obligations involving Personal Data</li>
          </ul>
          <p>
            To the maximum extent permitted by law, neither party shall be liable for:
          </p>
          <ul>
            <li>Any indirect, incidental, special, consequential, or punitive damages</li>
            <li>Loss of profits, data, use, or goodwill</li>
            <li>Service interruptions or data loss</li>
            <li>Actions or inactions of third-party service providers</li>
          </ul>

          <h3>10.4 AI Model Disclaimer</h3>
          <p>
            xAI's Grok model may produce inaccurate, biased, or inappropriate content. You use AI-generated content at your own risk and should verify information independently before relying on it.
          </p>

          <h2>11. Mutual Indemnification</h2>
          <h3>11.1 Provider Indemnity</h3>
          <p>
            Provider shall indemnify, defend, and hold Customer harmless against any third-party claim, suit, or proceeding alleging that:
          </p>
          <ul>
            <li>The Service infringes any patent, copyright, or trademark; or</li>
            <li>The Service's tracking technology (including pixels, scripts, or cookies), when installed and used as instructed, violates any applicable privacy law, regulation, or third-party privacy right.</li>
          </ul>

          <h3>11.2 Customer Indemnity</h3>
          <p>
            Customer shall indemnify Provider against claims arising solely from:
          </p>
          <ul>
            <li>The Customer's own content</li>
            <li>Unauthorized use of the Service</li>
            <li>Customer's violation of these Terms</li>
            <li>Customer's violation of any third-party rights</li>
          </ul>

          <h2>12. Termination</h2>
          <h3>12.1 By You</h3>
          <p>
            You may stop using the Service at any time. If using Supabase storage, you may request deletion of your account and data by contacting us.
          </p>

          <h3>12.2 By Us</h3>
          <p>
            We reserve the right to suspend or terminate your access to the Service at any time, with or without cause, including for:
          </p>
          <ul>
            <li>Violation of these Terms</li>
            <li>Fraudulent, abusive, or illegal activity</li>
            <li>Extended periods of inactivity</li>
            <li>Technical or security reasons</li>
          </ul>

          <h3>12.3 Data Portability and Retrieval</h3>
          <p>
            Upon termination or expiration of this Agreement for any reason, Provider shall make available to Customer a downloadable file of the Customer Data (including all enriched fields, insights, and appended data generated during the term) in a standard, commercially usable format (e.g., .CSV or .JSON) for a period of at least <strong>thirty (30) days</strong>.
          </p>

          <h3>12.4 Effect of Termination</h3>
          <p>
            Upon termination, your right to use the Service will cease immediately. Data stored locally in IndexedDB will remain on your device. Cloud-stored data may be deleted after the 30-day data retrieval period in accordance with our data retention policies.
          </p>

          <h2>13. FCRA Compliance Clarification</h2>
          <p>
            The parties acknowledge that Provider is <strong>not a "consumer reporting agency"</strong> as defined by the Fair Credit Reporting Act (15 U.S.C. § 1681 et seq.) ("FCRA").
          </p>
          <p>
            Customer agrees <strong>not to use</strong> any data provided by the Service for the purpose of determining any individual's eligibility for:
          </p>
          <ul>
            <li>Credit</li>
            <li>Insurance</li>
            <li>Employment</li>
            <li>Housing</li>
            <li>Any other purpose that would require FCRA compliance</li>
          </ul>

          <h2>14. Modifications to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify users of material changes by:
          </p>
          <ul>
            <li>Posting the updated Terms with a new "Effective Date"</li>
            <li>Providing notice through the Service or via email (for authenticated users)</li>
          </ul>
          <p>
            Your continued use of the Service after changes become effective constitutes acceptance of the modified Terms.
          </p>

          <h2>15. Modifications to Service</h2>
          <p>
            We reserve the right to modify, suspend, or discontinue the Service (or any part thereof) at any time, with or without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuation of the Service.
          </p>

          <h2>16. Governing Law and Dispute Resolution</h2>
          <h3>16.1 Governing Law</h3>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without regard to conflict of law principles.
          </p>

          <h3>16.2 Dispute Resolution</h3>
          <p>
            Any disputes arising out of or relating to these Terms or the Service shall be resolved through good faith negotiation. If negotiation fails, disputes shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, with the arbitration venue located in Texas.
          </p>

          <h3>16.3 Class Action Waiver</h3>
          <p>
            You agree to resolve disputes on an individual basis and waive any right to participate in class action lawsuits or class-wide arbitration.
          </p>

          <h2>17. Miscellaneous</h2>
          <h3>17.1 Entire Agreement</h3>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire agreement between you and Rōmy regarding the Service.
          </p>

          <h3>17.2 Severability</h3>
          <p>
            If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
          </p>

          <h3>17.3 No Waiver</h3>
          <p>
            Our failure to enforce any right or provision of these Terms will not constitute a waiver of that right or provision.
          </p>

          <h3>17.4 Assignment</h3>
          <p>
            You may not assign or transfer these Terms without our prior written consent. We may assign our rights and obligations without restriction.
          </p>

          <h3>17.5 Export Compliance</h3>
          <p>
            You agree to comply with all applicable export and re-export control laws and regulations in your use of the Service.
          </p>

          <h2>18. Contact Information</h2>
          <p>
            For questions, concerns, or notices regarding these Terms, please contact us at:
          </p>
          <p><strong>Email:</strong> <a href="mailto:privacy@getromy.app" className="text-foreground hover:underline">privacy@getromy.app</a></p>
          <p><strong>Mailing Address:</strong><br />
            Rōmy (GetRomy LLC)<br />
            Kerrville, TX 78028<br />
            United States
          </p>

          <h2>19. Acknowledgment</h2>
          <p>
            By using Rōmy, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>

          <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
            <p>Last updated: November 28, 2025</p>
            <p>Version: 2.0</p>
          </div>
        </div>
      </div>
    </>
  )
}
