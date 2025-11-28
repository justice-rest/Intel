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
          <time className="text-foreground">Effective November 28, 2025</time>
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
            Rōmy ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered chat platform designed to help small nonprofits find new major donors (the "Service").
          </p>
          <p>
            This policy applies to all users of Rōmy, whether you use the Service with cloud storage (Supabase) or in local-only mode. By accessing and using the Service, you consent to the data practices described in this policy. If you do not agree with this policy, please do not use the Service.
          </p>

          <h2>2. Information We Collect</h2>

          <h3>2.1 Account Information</h3>
          <p>When you create an account using Google authentication, we collect:</p>
          <ul>
            <li>Your name and email address from your Google profile</li>
            <li>Your Google authentication credentials (via OAuth 2.0)</li>
            <li>Account creation date and last login timestamp</li>
          </ul>

          <h3>2.2 Chat Content and Prompts</h3>
          <p>We collect and store:</p>
          <ul>
            <li>All chat messages, prompts, and queries you submit to the Service</li>
            <li>AI model responses generated in response to your prompts</li>
            <li>Files, documents, and donor lists you upload to the Service</li>
            <li>Conversation history associated with your account</li>
          </ul>

          <h3>2.3 Files and Attachments</h3>
          <p>When you upload files (donor lists, spreadsheets, documents), we collect:</p>
          <ul>
            <li>File name, file type, and file size</li>
            <li>File content and metadata</li>
            <li>Upload timestamp and associated chat session</li>
            <li>In some cases, financial data or personally identifiable information (PII) contained in files you provide</li>
          </ul>

          <h3>2.4 User Preferences and Settings</h3>
          <p>We collect your settings and preferences, including:</p>
          <ul>
            <li>Display language and timezone</li>
            <li>Model preferences and AI configuration choices</li>
            <li>Feature toggles and personalization settings</li>
            <li>Notification preferences</li>
          </ul>

          <h3>2.5 Usage Data</h3>
          <p>We automatically collect:</p>
          <ul>
            <li>Features you access and actions you take within the Service</li>
            <li>Time spent in the application</li>
            <li>Button clicks, searches, and interactions</li>
            <li>Error logs and performance metrics</li>
            <li>Frequency and duration of Service usage</li>
          </ul>

          <h3>2.6 Technical Information</h3>
          <p>We may collect:</p>
          <ul>
            <li>IP address and hostname</li>
            <li>Device type, operating system, and browser information</li>
            <li>Cookies and similar tracking technologies (see Section 7)</li>
            <li>Session identifiers and unique device identifiers</li>
            <li>Referrer URLs and access patterns</li>
          </ul>

          <h3>2.7 Analytics Data</h3>
          <p>Through PostHog (optional, when configured):</p>
          <ul>
            <li>Anonymous and aggregated usage patterns</li>
            <li>Feature adoption and product analytics</li>
            <li>Session recordings and user interaction flows (only when explicitly enabled)</li>
            <li>Error and crash reporting</li>
          </ul>

          <h3>2.8 Authentication Provider</h3>
          <p>When you sign in with Google:</p>
          <ul>
            <li>We receive basic profile information (name, email, profile picture URL)</li>
            <li>Google's servers process authentication; we do not receive or store your Google password</li>
          </ul>

          <h3>2.9 Third-Party Service Data</h3>
          <p>When you use the Service with integrated search or data services (e.g., Exa, Linkup):</p>
          <ul>
            <li>Search queries and prompts sent through these integrations</li>
            <li>Results returned by third-party search providers</li>
            <li>Donor wealth data or other third-party data returned to the Service</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li><strong>Provide and maintain the Service:</strong> Deliver chat functionality, store conversations, and enable account management</li>
            <li><strong>Personalize your experience:</strong> Tailor the Service to your preferences, settings, and usage patterns</li>
            <li><strong>Process AI requests:</strong> Send prompts and context to AI model providers (xAI/Grok) to generate responses</li>
            <li><strong>Improve the Service:</strong> Analyze usage patterns, identify bugs, and develop new features (analytics)</li>
            <li><strong>Communicate with you:</strong> Send service updates, security notices, and responses to your inquiries</li>
            <li><strong>Ensure security and compliance:</strong> Detect fraud, prevent abuse, enforce our Terms of Service, and comply with legal obligations</li>
            <li><strong>Comply with legal requirements:</strong> Respond to lawful requests from government agencies and courts</li>
            <li><strong>Monitor and audit:</strong> Maintain logs for security, performance, and compliance purposes</li>
          </ul>

          <h2>4. Legal Basis for Processing (GDPR)</h2>
          <p>If you are located in the European Economic Area (EEA) or United Kingdom, we process your personal data on the following legal bases:</p>
          <ul>
            <li><strong>Performance of a Contract:</strong> Processing necessary to provide the Service and fulfill our obligations to you</li>
            <li><strong>Legitimate Interests:</strong> Processing for security, fraud prevention, analytics, and service improvement</li>
            <li><strong>Consent:</strong> Where you explicitly consent to optional processing (e.g., analytics cookies, session recordings)</li>
            <li><strong>Compliance with Legal Obligations:</strong> Where required by law or court order</li>
          </ul>
          <p>You have the right to object to processing based on legitimate interests. See Section 8 for how to exercise this right.</p>

          <h2>5. Data Storage and Retention</h2>

          <h3>5.1 Active Accounts</h3>
          <p>We retain your data for as long as your account is active or as needed to provide the Service. This includes:</p>
          <ul>
            <li>Chat history and conversation data</li>
            <li>Account information and preferences</li>
            <li>Uploaded files and attachments</li>
            <li>Analytics and usage logs</li>
          </ul>

          <h3>5.2 Inactive Accounts</h3>
          <p>
            Accounts inactive for 24 months or longer may be subject to deletion after we provide notice (via email or in-app message). You will have 30 days to reactivate your account before deletion.
          </p>

          <h3>5.3 Deleted Accounts</h3>
          <p>When you delete your account, we will:</p>
          <ul>
            <li>Delete your personal information within 30 days</li>
            <li>Anonymize or delete chat history and uploaded files</li>
            <li>Retain only aggregated, anonymized data for analytics</li>
            <li>Exception: We may retain data where required by law or for legal dispute resolution</li>
          </ul>

          <h3>5.4 Local Storage</h3>
          <p>Data stored in your browser's IndexedDB or localStorage remains on your device until you:</p>
          <ul>
            <li>Clear your browser data</li>
            <li>Delete the application cache</li>
            <li>Uninstall the application</li>
          </ul>
          <p>We do not have access to this locally stored data unless you explicitly sync it to our cloud services (Supabase).</p>

          <h2>6. Data Architecture: Cloud vs. Local Storage</h2>

          <h3>6.1 With Supabase Enabled (Cloud Mode)</h3>
          <p>When you enable cloud synchronization:</p>
          <ul>
            <li>Your chat history, prompts, uploaded files, and account data are encrypted and stored in Supabase (a PostgreSQL cloud database)</li>
            <li>Your data is backed up and can be accessed across devices</li>
            <li>Data is subject to Supabase's security and privacy practices (see: <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">https://supabase.com/privacy</a>)</li>
            <li>Your data remains encrypted at rest and in transit (TLS 1.3)</li>
          </ul>

          <h3>6.2 Without Supabase (Local-Only Mode)</h3>
          <p>When you use local-only mode:</p>
          <ul>
            <li>All chat history, uploaded files, and data remain on your device</li>
            <li>Data is stored only in your browser's IndexedDB</li>
            <li>We do not collect, store, or access this data on our servers</li>
            <li>You remain solely responsible for backing up and securing your local data</li>
          </ul>

          <h2>7. Data Sharing and Third-Party Service Providers</h2>
          <p>We do not sell, rent, or trade your personal information. However, we may share your data with trusted service providers who assist us in operating the Service:</p>

          <h3>7.1 Essential Service Providers</h3>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Purpose</th>
                <th>Data Shared</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Supabase</strong></td>
                <td>Cloud database, authentication, data storage</td>
                <td>Account info, chat history, uploaded files</td>
              </tr>
              <tr>
                <td><strong>Google</strong></td>
                <td>OAuth authentication, sign-in</td>
                <td>Email, name, profile picture</td>
              </tr>
              <tr>
                <td><strong>xAI (Grok)</strong></td>
                <td>AI model inference and responses</td>
                <td>Prompts, chat content, context</td>
              </tr>
              <tr>
                <td><strong>PostHog</strong></td>
                <td>Usage analytics and product insights</td>
                <td>Anonymized usage patterns, event data</td>
              </tr>
              <tr>
                <td><strong>Exa / Linkup</strong></td>
                <td>Third-party search and data enrichment</td>
                <td>Search queries, donor data requests</td>
              </tr>
            </tbody>
          </table>

          <h3>7.2 Vendor Responsibility</h3>
          <p>We remain responsible for your personal information handled by these third parties on our behalf. All vendors are contractually obligated to:</p>
          <ul>
            <li>Protect your information using industry-standard security measures</li>
            <li>Use your information only for specified purposes</li>
            <li>Not disclose your information to unauthorized parties</li>
            <li>Comply with applicable data protection laws</li>
          </ul>

          <h3>7.3 Other Disclosures</h3>
          <p>We may disclose your information if required to:</p>
          <ul>
            <li>Comply with a legal subpoena, court order, or government request</li>
            <li>Enforce our Terms of Service and other agreements</li>
            <li>Protect against fraud, security threats, or illegal activity</li>
            <li>Protect the rights, privacy, safety, and property of Rōmy, our users, and the public</li>
          </ul>

          <h3>7.4 Business Transfers</h3>
          <p>In the event of a merger, acquisition, bankruptcy, or sale of assets:</p>
          <ul>
            <li>Your information may be transferred to the acquiring entity</li>
            <li>We will provide notice to affected users via email or prominent in-app notification</li>
            <li>The acquiring entity must comply with this Privacy Policy or provide equivalent protections</li>
          </ul>

          <h3>7.5 Aggregated and Anonymized Data</h3>
          <p>We may share aggregated, anonymized data that does not identify you personally for:</p>
          <ul>
            <li>Research and academic purposes</li>
            <li>Marketing and benchmarking</li>
            <li>Analytics and industry reports</li>
            <li>Public statistics about nonprofit fundraising</li>
          </ul>

          <h2>8. Cookies, Tracking, and Local Storage</h2>

          <h3>8.1 Essential Cookies</h3>
          <p>Essential cookies are required for basic Service functionality:</p>
          <ul>
            <li>Authentication and session management</li>
            <li>CSRF (Cross-Site Request Forgery) protection</li>
            <li>User preference storage</li>
            <li><strong>These cookies are necessary and cannot be disabled without losing core functionality</strong></li>
          </ul>

          <h3>8.2 Analytics Cookies (Optional)</h3>
          <p>When PostHog is configured, we use optional cookies to:</p>
          <ul>
            <li>Track feature usage and user behavior</li>
            <li>Analyze aggregate trends and user journeys</li>
            <li>Improve Service performance</li>
          </ul>
          <p><strong>You can opt out of analytics cookies by:</strong></p>
          <ul>
            <li>Adjusting your browser's cookie settings</li>
            <li>Using browser privacy/do-not-track modes</li>
            <li>Contacting us at <a href="mailto:privacy@getromy.app">privacy@getromy.app</a> to request opt-out</li>
          </ul>

          <h3>8.3 Preference Cookies</h3>
          <p>Preference cookies store your settings:</p>
          <ul>
            <li>Display language and timezone</li>
            <li>UI preferences (light/dark mode, layout)</li>
            <li>Notification settings</li>
            <li><strong>These are locally stored and do not track across sites</strong></li>
          </ul>

          <h3>8.4 Local Storage</h3>
          <p>We use IndexedDB and localStorage to cache data locally for:</p>
          <ul>
            <li>Performance optimization and faster load times</li>
            <li>Offline functionality</li>
            <li>Chat history and model caching</li>
            <li>Preference persistence</li>
          </ul>
          <p>You can control or clear local storage through your browser developer tools or settings. Clearing storage may affect performance and require re-downloading cached data.</p>

          <h3>8.5 Cookie Control</h3>
          <p>You can control cookies through your browser settings:</p>
          <ul>
            <li>Most browsers allow you to refuse cookies or alert you when cookies are being set</li>
            <li>Disabling essential cookies may impair Service functionality</li>
            <li>Disabling analytics cookies will not affect basic Service use</li>
          </ul>
          <p>Consult your browser's help documentation for cookie management options.</p>

          <h2>9. Your Privacy Rights and How to Exercise Them</h2>
          <p>Your rights vary depending on your location. Please see the section(s) applicable to you.</p>

          <h3>9.1 European Economic Area and United Kingdom (GDPR and UK GDPR)</h3>
          <p>If you are located in the EEA or UK, you have the following rights:</p>
          <ul>
            <li><strong>Right of Access:</strong> You can request a copy of your personal data that we hold</li>
            <li><strong>Right to Rectification:</strong> You can request correction of inaccurate or incomplete information</li>
            <li><strong>Right to Erasure ("Right to be Forgotten"):</strong> You can request deletion of your personal data, except where we have a legal obligation to retain it</li>
            <li><strong>Right to Restrict Processing:</strong> You can request that we limit how we use your information</li>
            <li><strong>Right to Data Portability:</strong> You can request your personal data in a portable, machine-readable format</li>
            <li><strong>Right to Object:</strong> You can object to processing based on legitimate interests or for direct marketing</li>
            <li><strong>Right to Withdraw Consent:</strong> If processing is based on consent, you can withdraw consent at any time</li>
            <li><strong>Right to Lodge a Complaint:</strong> You have the right to lodge a complaint with your local data protection authority</li>
          </ul>
          <p><strong>Data Protection Authority contacts:</strong></p>
          <ul>
            <li><strong>EU:</strong> <a href="https://edpb.ec.europa.eu/about-edpb/members_en" target="_blank" rel="noopener noreferrer">https://edpb.ec.europa.eu/about-edpb/members_en</a></li>
            <li><strong>UK:</strong> Information Commissioner's Office (ICO) – <a href="https://ico.org.uk/" target="_blank" rel="noopener noreferrer">https://ico.org.uk/</a></li>
          </ul>

          <h3>9.2 California Residents (CCPA and CPRA)</h3>
          <p>California residents have the right to:</p>
          <ul>
            <li><strong>Right to Know:</strong> Request what personal information we collect, use, and share</li>
            <li><strong>Right to Delete:</strong> Request deletion of personal information we hold (with some exceptions)</li>
            <li><strong>Right to Correct:</strong> Request correction of inaccurate information</li>
            <li><strong>Right to Opt-Out of "Sales" or "Sharing":</strong> If we engage in targeted advertising or cross-context behavioral advertising, you have the right to opt out</li>
            <li><strong>Right to Limit Use:</strong> Limit our use of sensitive personal information (SSN, financial account info, geolocation, health data)</li>
            <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your rights</li>
          </ul>
          <p><strong>Current Status:</strong> Rōmy does not engage in "sales" of personal information or cross-context behavioral advertising. We do not "share" personal information for targeted advertising purposes. If this changes, we will update this policy and provide a "Do Not Sell or Share My Personal Information" link.</p>

          <h3>9.3 Other U.S. State Laws</h3>
          <p>If you reside in Colorado, Connecticut, Delaware, Iowa, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Texas, Utah, Virginia, or other states with comprehensive privacy laws, you may have rights similar to California, including:</p>
          <ul>
            <li>Right to access, delete, and correct personal information</li>
            <li>Right to opt out of targeted advertising and profiling</li>
            <li>Right to data portability</li>
            <li>Right to appeal company decisions</li>
          </ul>
          <p>Please contact us (see Section 10) to exercise these rights. We will verify your identity and respond within 45 days.</p>

          <h3>9.4 Canada (PIPEDA and Provincial Privacy Laws)</h3>
          <p>If you are located in Canada, you have rights under the Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable provincial privacy laws:</p>
          <ul>
            <li><strong>Right of Access:</strong> You can request access to personal information we hold about you</li>
            <li><strong>Right to Correction:</strong> You can request correction of inaccurate information</li>
            <li><strong>Right to Withdraw Consent:</strong> You can withdraw consent for collection, use, or disclosure (except where required by law)</li>
            <li><strong>Right to Complain:</strong> You can file a complaint with the Office of the Privacy Commissioner of Canada</li>
          </ul>
          <p>We remain responsible for personal information handled by our service providers on your behalf. We will facilitate your requests with vendors as needed.</p>

          <h3>9.5 How to Exercise Your Rights</h3>
          <p>To exercise any of the rights listed above, please contact:</p>
          <p><strong>Email:</strong> <a href="mailto:privacy@getromy.app">privacy@getromy.app</a></p>
          <p><strong>Mailing Address:</strong><br />
            Rōmy (GetRomy LLC)<br />
            Kerrville, TX 78028<br />
            United States
          </p>
          <p><strong>Include in your request:</strong></p>
          <ul>
            <li>Your name and account email address</li>
            <li>Specific right(s) you are exercising</li>
            <li>A description of your request</li>
            <li>Proof of identity (if required for verification)</li>
          </ul>
          <p><strong>Our Response:</strong></p>
          <ul>
            <li>We will acknowledge receipt of your request within 10 business days</li>
            <li>We will verify your identity and process your request (typically 30–45 days, depending on jurisdiction)</li>
            <li>We will respond in the manner and format you request (email, downloadable file, etc.)</li>
            <li>If we cannot fulfill your request, we will explain the reason</li>
          </ul>
          <p><strong>Appeal:</strong> If we deny or partially deny your request, you may appeal our decision by sending a written appeal to <a href="mailto:privacy@getromy.app">privacy@getromy.app</a> with the original request reference number.</p>

          <h2>10. Data Processing and AI Models</h2>

          <h3>10.1 AI Model Processing</h3>
          <p>When you submit a prompt or content to the Service:</p>
          <ul>
            <li>Your prompts and context are sent to xAI's Grok model for processing</li>
            <li>Your content is sent via our service infrastructure using TLS 1.3 encryption</li>
            <li>xAI processes your request and returns a generated response</li>
            <li>We store your prompt, response, and metadata in your chat history</li>
          </ul>

          <h3>10.2 Model Training</h3>
          <p><strong>Rōmy's Policy:</strong> We do not use your conversations, prompts, or uploaded files to train our own AI models or create derivative models.</p>
          <p><strong>xAI's Policy:</strong> xAI may use data processed through their API to improve their models, subject to their own privacy policy. Please review xAI's privacy practices at <a href="https://grok.com/privacy" target="_blank" rel="noopener noreferrer">https://grok.com/privacy</a> for details.</p>
          <p>You can see which model generated each response in your chat history.</p>

          <h3>10.3 Automated Decision-Making</h3>
          <p>You are not subject to fully automated decision-making that produces legal or similarly significant effects without human oversight. While our Service uses AI to generate suggestions and donor insights, all AI-generated recommendations should be reviewed and verified by you before use in donor identification or fundraising decisions.</p>

          <h3>10.4 Web Search Integration</h3>
          <p>When you enable web search features (if available):</p>
          <ul>
            <li>Your search queries may be sent to third-party search providers (e.g., Exa, Linkup)</li>
            <li>Results are returned and stored in your chat history</li>
            <li>Third-party providers may log your search queries subject to their privacy policies</li>
          </ul>

          <h2>11. Security Measures</h2>
          <p>We implement industry-standard security measures to protect your information:</p>
          <ul>
            <li><strong>Encryption in Transit:</strong> All data transmitted between your device and our servers uses TLS 1.3 encryption</li>
            <li><strong>Encryption at Rest:</strong> Sensitive data stored in Supabase is encrypted using AES-256 encryption</li>
            <li><strong>Access Controls:</strong> Only authorized employees with a legitimate business need have access to personal data</li>
            <li><strong>Authentication:</strong> Google OAuth 2.0 authentication with secure session management</li>
            <li><strong>Audit Logging:</strong> We maintain logs of system access and data handling for security monitoring</li>
            <li><strong>Intrusion Detection:</strong> We monitor for unauthorized access attempts and security threats</li>
            <li><strong>Vendor Security:</strong> We require service providers to maintain SOC 2 Type II or equivalent certifications</li>
          </ul>
          <p><strong>Limitations:</strong> However, no system is completely secure. You use the Service at your own risk. We cannot guarantee absolute security of data transmitted over the internet. Please take appropriate precautions with sensitive information and use strong, unique passwords.</p>

          <h2>12. International Data Transfers</h2>
          <p>Your information may be transferred to, stored in, and processed in countries other than your country of residence, including the United States. These countries may have different data protection laws than your jurisdiction.</p>
          <p><strong>When we transfer data internationally, we ensure appropriate safeguards are in place:</strong></p>
          <ul>
            <li><strong>Standard Contractual Clauses (SCCs):</strong> We use EU Standard Contractual Clauses for transfers involving EU/EEA data subjects to the United States and other countries</li>
            <li><strong>Adequacy Decisions:</strong> We rely on countries with EU adequacy determinations where applicable</li>
            <li><strong>Contractual Protections:</strong> We require data processors to commit to equivalent protection standards</li>
            <li><strong>Your Consent:</strong> By using the Service, you consent to the transfer, storage, and processing of your information as described in this policy</li>
          </ul>
          <p>If you have concerns about international transfers, please contact us at <a href="mailto:privacy@getromy.app">privacy@getromy.app</a>.</p>

          <h2>13. Children's Privacy</h2>
          <p><strong>Rōmy is not intended for children under 13 years of age</strong> (or 16 in the European Economic Area). We do not knowingly collect personal information from children under these ages.</p>
          <p>If you believe we have collected information from a child under the applicable age threshold, please contact us immediately at <a href="mailto:privacy@getromy.app">privacy@getromy.app</a>, and we will delete the information within 30 days.</p>
          <p><strong>Note:</strong> If you are a nonprofit staff member or volunteer under 13 or 16 using the Service on behalf of your organization, please alert your organization's account administrator, and we will work to address it.</p>

          <h2>14. Third-Party Links and Services</h2>
          <p>The Service may contain links to third-party websites, services, and applications. We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party sites or services before providing any information or using their services.</p>
          <p>This Privacy Policy applies only to information collected through Rōmy. Third-party services are governed by their own terms and privacy policies.</p>

          <h2>15. Transparency: Open-Source Code</h2>
          <p><strong>Rōmy is open-source software.</strong> You can review our code, data handling practices, and security implementations in our public repository on GitHub. This transparency allows independent verification of our privacy practices and security measures.</p>

          <h2>16. Changes to This Privacy Policy</h2>
          <p>We may update this Privacy Policy from time to time to reflect:</p>
          <ul>
            <li>Changes in our data practices</li>
            <li>New technologies and security measures</li>
            <li>Evolving legal requirements</li>
            <li>Feedback from users and regulators</li>
          </ul>
          <p><strong>Notice of Changes:</strong></p>
          <p>We will notify you of material changes by:</p>
          <ul>
            <li>Posting an updated policy on our website with a new "Last updated" date</li>
            <li>Sending an email notification to your registered email address</li>
            <li>Displaying a prominent in-app notification</li>
          </ul>
          <p><strong>Your Rights:</strong></p>
          <ul>
            <li>Material changes will be effective 30 days after notice</li>
            <li>Your continued use of the Service after changes become effective constitutes acceptance of the updated Privacy Policy</li>
            <li>If you do not agree with material changes, you may delete your account before the changes take effect</li>
          </ul>

          <h2>17. Contact Us</h2>
          <p>For privacy-related inquiries, concerns, or requests, please contact our team:</p>
          <p><strong>Email:</strong> <a href="mailto:privacy@getromy.app">privacy@getromy.app</a></p>
          <p><strong>Mailing Address:</strong><br />
            Rōmy (GetRomy LLC)<br />
            Kerrville, TX 78028<br />
            United States
          </p>
          <p><strong>Response Time:</strong> We will acknowledge your inquiry within 10 business days and provide a substantive response within 30–45 days.</p>
          <p><strong>For EU/EEA Residents:</strong> If you have concerns about our privacy practices and wish to escalate, you may lodge a complaint with your national data protection authority:</p>
          <ul>
            <li><strong>EU:</strong> <a href="https://edpb.ec.europa.eu/about-edpb/members_en" target="_blank" rel="noopener noreferrer">https://edpb.ec.europa.eu/about-edpb/members_en</a></li>
            <li><strong>UK:</strong> <a href="https://ico.org.uk/" target="_blank" rel="noopener noreferrer">https://ico.org.uk/</a></li>
          </ul>
          <p><strong>For Canadian Residents:</strong> You may lodge a complaint with the Office of the Privacy Commissioner of Canada:</p>
          <ul>
            <li><strong>Website:</strong> <a href="https://www.priv.gc.ca/" target="_blank" rel="noopener noreferrer">https://www.priv.gc.ca/</a></li>
            <li><strong>Telephone:</strong> 1-800-282-1376</li>
          </ul>

          <h2>18. Acknowledgment</h2>
          <p>By using Rōmy, you consent to this Privacy Policy and agree to its terms. If you do not agree with this policy, please do not use the Service.</p>
          <p>If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us using the information in Section 17.</p>

          <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
            <p>Last updated: November 28, 2025</p>
            <p>Version: 2.0 (Multi-jurisdiction)</p>
          </div>
        </div>
      </div>
    </>
  )
}
