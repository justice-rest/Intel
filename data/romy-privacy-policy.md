# Privacy Policy

**Last updated:** November 28, 2025

Rōmy ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered chat platform designed to help small nonprofits find new major donors (the "Service").

This policy applies to all users of Rōmy, whether you use the Service with cloud storage (Supabase) or in local-only mode. By accessing and using the Service, you consent to the data practices described in this policy. If you do not agree with this policy, please do not use the Service.

---

## 1. Information We Collect

### 1.1 Account Information

When you create an account using Google authentication, we collect:
- Your name and email address from your Google profile
- Your Google authentication credentials (via OAuth 2.0)
- Account creation date and last login timestamp

### 1.2 Chat Content and Prompts

We collect and store:
- All chat messages, prompts, and queries you submit to the Service
- AI model responses generated in response to your prompts
- Files, documents, and donor lists you upload to the Service
- Conversation history associated with your account

### 1.3 Files and Attachments

When you upload files (donor lists, spreadsheets, documents), we collect:
- File name, file type, and file size
- File content and metadata
- Upload timestamp and associated chat session
- In some cases, financial data or personally identifiable information (PII) contained in files you provide

### 1.4 User Preferences and Settings

We collect your settings and preferences, including:
- Display language and timezone
- Model preferences and AI configuration choices
- Feature toggles and personalization settings
- Notification preferences

### 1.5 Usage Data

We automatically collect:
- Features you access and actions you take within the Service
- Time spent in the application
- Button clicks, searches, and interactions
- Error logs and performance metrics
- Frequency and duration of Service usage

### 1.6 Technical Information

We may collect:
- IP address and hostname
- Device type, operating system, and browser information
- Cookies and similar tracking technologies (see Section 7)
- Session identifiers and unique device identifiers
- Referrer URLs and access patterns

### 1.7 Analytics Data

Through PostHog (optional, when configured):
- Anonymous and aggregated usage patterns
- Feature adoption and product analytics
- Session recordings and user interaction flows (only when explicitly enabled)
- Error and crash reporting

### 1.8 Authentication Provider

When you sign in with Google:
- We receive basic profile information (name, email, profile picture URL)
- Google's servers process authentication; we do not receive or store your Google password

### 1.9 Third-Party Service Data

When you use the Service with integrated search or data services (e.g., Exa, Linkup):
- Search queries and prompts sent through these integrations
- Results returned by third-party search providers
- Donor wealth data or other third-party data returned to the Service

---

## 2. How We Use Your Information

We use the information we collect to:

- **Provide and maintain the Service:** Deliver chat functionality, store conversations, and enable account management
- **Personalize your experience:** Tailor the Service to your preferences, settings, and usage patterns
- **Process AI requests:** Send prompts and context to AI model providers (xAI/Grok) to generate responses
- **Improve the Service:** Analyze usage patterns, identify bugs, and develop new features (analytics)
- **Communicate with you:** Send service updates, security notices, and responses to your inquiries
- **Ensure security and compliance:** Detect fraud, prevent abuse, enforce our Terms of Service, and comply with legal obligations
- **Comply with legal requirements:** Respond to lawful requests from government agencies and courts
- **Monitor and audit:** Maintain logs for security, performance, and compliance purposes

---

## 3. Legal Basis for Processing (GDPR)

If you are located in the European Economic Area (EEA) or United Kingdom, we process your personal data on the following legal bases:

- **Performance of a Contract:** Processing necessary to provide the Service and fulfill our obligations to you
- **Legitimate Interests:** Processing for security, fraud prevention, analytics, and service improvement
- **Consent:** Where you explicitly consent to optional processing (e.g., analytics cookies, session recordings)
- **Compliance with Legal Obligations:** Where required by law or court order

You have the right to object to processing based on legitimate interests. See Section 8 for how to exercise this right.

---

## 4. Data Storage and Retention

### 4.1 Active Accounts

We retain your data for as long as your account is active or as needed to provide the Service. This includes:
- Chat history and conversation data
- Account information and preferences
- Uploaded files and attachments
- Analytics and usage logs

### 4.2 Inactive Accounts

Accounts inactive for 24 months or longer may be subject to deletion after we provide notice (via email or in-app message). You will have 30 days to reactivate your account before deletion.

### 4.3 Deleted Accounts

When you delete your account, we will:
- Delete your personal information within 30 days
- Anonymize or delete chat history and uploaded files
- Retain only aggregated, anonymized data for analytics
- Exception: We may retain data where required by law or for legal dispute resolution

### 4.4 Local Storage

Data stored in your browser's IndexedDB or localStorage remains on your device until you:
- Clear your browser data
- Delete the application cache
- Uninstall the application

We do not have access to this locally stored data unless you explicitly sync it to our cloud services (Supabase).

---

## 5. Data Architecture: Cloud vs. Local Storage

### 5.1 With Supabase Enabled (Cloud Mode)

When you enable cloud synchronization:
- Your chat history, prompts, uploaded files, and account data are encrypted and stored in Supabase (a PostgreSQL cloud database)
- Your data is backed up and can be accessed across devices
- Data is subject to Supabase's security and privacy practices (see: https://supabase.com/privacy)
- Your data remains encrypted at rest and in transit (TLS 1.3)

### 5.2 Without Supabase (Local-Only Mode)

When you use local-only mode:
- All chat history, uploaded files, and data remain on your device
- Data is stored only in your browser's IndexedDB
- We do not collect, store, or access this data on our servers
- You remain solely responsible for backing up and securing your local data

---

## 6. Data Sharing and Third-Party Service Providers

We do not sell, rent, or trade your personal information. However, we may share your data with trusted service providers who assist us in operating the Service:

### 6.1 Essential Service Providers

| Provider | Purpose | Data Shared | Privacy Policy |
|----------|---------|-------------|----------------|
| **Supabase** | Cloud database, authentication, data storage | Account info, chat history, uploaded files | https://supabase.com/privacy |
| **Google** | OAuth authentication, sign-in | Email, name, profile picture | https://policies.google.com/privacy |
| **xAI (Grok)** | AI model inference and responses | Prompts, chat content, context | https://grok.com/privacy |
| **PostHog** | Usage analytics and product insights | Anonymized usage patterns, event data | https://posthog.com/privacy |
| **Exa / Linkup** | Third-party search and data enrichment | Search queries, donor data requests | See third-party terms |

### 6.2 Vendor Responsibility

We remain responsible for your personal information handled by these third parties on our behalf. All vendors are contractually obligated to:
- Protect your information using industry-standard security measures
- Use your information only for specified purposes
- Not disclose your information to unauthorized parties
- Comply with applicable data protection laws

### 6.3 Other Disclosures

We may disclose your information if required to:
- Comply with a legal subpoena, court order, or government request
- Enforce our Terms of Service and other agreements
- Protect against fraud, security threats, or illegal activity
- Protect the rights, privacy, safety, and property of Rōmy, our users, and the public

### 6.4 Business Transfers

In the event of a merger, acquisition, bankruptcy, or sale of assets:
- Your information may be transferred to the acquiring entity
- We will provide notice to affected users via email or prominent in-app notification
- The acquiring entity must comply with this Privacy Policy or provide equivalent protections

### 6.5 Aggregated and Anonymized Data

We may share aggregated, anonymized data that does not identify you personally for:
- Research and academic purposes
- Marketing and benchmarking
- Analytics and industry reports
- Public statistics about nonprofit fundraising

---

## 7. Cookies, Tracking, and Local Storage

### 7.1 Essential Cookies

Essential cookies are required for basic Service functionality:
- Authentication and session management
- CSRF (Cross-Site Request Forgery) protection
- User preference storage
- **These cookies are necessary and cannot be disabled without losing core functionality**

### 7.2 Analytics Cookies (Optional)

When PostHog is configured, we use optional cookies to:
- Track feature usage and user behavior
- Analyze aggregate trends and user journeys
- Improve Service performance
- **You can opt out of analytics cookies by:**
  - Adjusting your browser's cookie settings
  - Using browser privacy/do-not-track modes
  - Contacting us at [privacy contact] to request opt-out

### 7.3 Preference Cookies

Preference cookies store your settings:
- Display language and timezone
- UI preferences (light/dark mode, layout)
- Notification settings
- **These are locally stored and do not track across sites**

### 7.4 Local Storage

We use IndexedDB and localStorage to cache data locally for:
- Performance optimization and faster load times
- Offline functionality
- Chat history and model caching
- Preference persistence

You can control or clear local storage through your browser developer tools or settings. Clearing storage may affect performance and require re-downloading cached data.

### 7.5 Cookie Control

You can control cookies through your browser settings:
- Most browsers allow you to refuse cookies or alert you when cookies are being set
- Disabling essential cookies may impair Service functionality
- Disabling analytics cookies will not affect basic Service use

Consult your browser's help documentation for cookie management options.

---

## 8. Your Privacy Rights and How to Exercise Them

Your rights vary depending on your location. Please see the section(s) applicable to you.

### 8.1 European Economic Area and United Kingdom (GDPR and UK GDPR)

If you are located in the EEA or UK, you have the following rights:

- **Right of Access:** You can request a copy of your personal data that we hold
- **Right to Rectification:** You can request correction of inaccurate or incomplete information
- **Right to Erasure ("Right to be Forgotten"):** You can request deletion of your personal data, except where we have a legal obligation to retain it
- **Right to Restrict Processing:** You can request that we limit how we use your information
- **Right to Data Portability:** You can request your personal data in a portable, machine-readable format
- **Right to Object:** You can object to processing based on legitimate interests or for direct marketing
- **Right to Withdraw Consent:** If processing is based on consent, you can withdraw consent at any time
- **Right to Lodge a Complaint:** You have the right to lodge a complaint with your local data protection authority

**Data Protection Authority contacts:**
- **EU:** https://edpb.ec.europa.eu/about-edpb/members_en
- **UK:** Information Commissioner's Office (ICO) – https://ico.org.uk/

### 8.2 California Residents (CCPA and CPRA)

California residents have the right to:

- **Right to Know:** Request what personal information we collect, use, and share
- **Right to Delete:** Request deletion of personal information we hold (with some exceptions)
- **Right to Correct:** Request correction of inaccurate information
- **Right to Opt-Out of "Sales" or "Sharing":** If we engage in targeted advertising or cross-context behavioral advertising, you have the right to opt out
- **Right to Limit Use:** Limit our use of sensitive personal information (SSN, financial account info, geolocation, health data)
- **Right to Non-Discrimination:** We will not discriminate against you for exercising your rights

**Current Status:** Rōmy does not engage in "sales" of personal information or cross-context behavioral advertising. We do not "share" personal information for targeted advertising purposes. If this changes, we will update this policy and provide a "Do Not Sell or Share My Personal Information" link.

### 8.3 Other U.S. State Laws (Colorado, Connecticut, Delaware, Iowa, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Texas, Utah, Virginia, and others)

If you reside in a state with comprehensive privacy laws, you may have rights similar to California, including:
- Right to access, delete, and correct personal information
- Right to opt out of targeted advertising and profiling
- Right to data portability
- Right to appeal company decisions

Please contact us (see Section 9) to exercise these rights. We will verify your identity and respond within 45 days.

### 8.4 Canada (PIPEDA and Provincial Privacy Laws)

If you are located in Canada, you have rights under the Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable provincial privacy laws:

- **Right of Access:** You can request access to personal information we hold about you
- **Right to Correction:** You can request correction of inaccurate information
- **Right to Withdraw Consent:** You can withdraw consent for collection, use, or disclosure (except where required by law)
- **Right to Complain:** You can file a complaint with the Office of the Privacy Commissioner of Canada

We remain responsible for personal information handled by our service providers on your behalf. We will facilitate your requests with vendors as needed.

### 8.5 How to Exercise Your Rights

To exercise any of the rights listed above, please contact:

**Email:** privacy@getromy.app  
**Mailing Address:**  
Rōmy (GetRomy LLC)  
Kerrville, TX 78028  
United States

**Include in your request:**
- Your name and account email address
- Specific right(s) you are exercising
- A description of your request
- Proof of identity (if required for verification)

**Our Response:**
- We will acknowledge receipt of your request within 10 business days
- We will verify your identity and process your request (typically 30–45 days, depending on jurisdiction)
- We will respond in the manner and format you request (email, downloadable file, etc.)
- If we cannot fulfill your request, we will explain the reason

**Appeal:**
If we deny or partially deny your request, you may appeal our decision by sending a written appeal to privacy@getromy.app with the original request reference number.

---

## 9. Data Processing and AI Models

### 9.1 AI Model Processing

When you submit a prompt or content to the Service:
- Your prompts and context are sent to xAI's Grok model for processing
- Your content is sent via our service infrastructure using TLS 1.3 encryption
- xAI processes your request and returns a generated response
- We store your prompt, response, and metadata in your chat history

### 9.2 Model Training

**Rōmy's Policy:** We do not use your conversations, prompts, or uploaded files to train our own AI models or create derivative models.

**xAI's Policy:** xAI may use data processed through their API to improve their models, subject to their own privacy policy. Please review xAI's privacy practices at https://grok.com/privacy for details.

You can see which model generated each response in your chat history.

### 9.3 Automated Decision-Making

You are not subject to fully automated decision-making that produces legal or similarly significant effects without human oversight. While our Service uses AI to generate suggestions and donor insights, all AI-generated recommendations should be reviewed and verified by you before use in donor identification or fundraising decisions.

### 9.4 Web Search Integration

When you enable web search features (if available):
- Your search queries may be sent to third-party search providers (e.g., Exa, Linkup)
- Results are returned and stored in your chat history
- Third-party providers may log your search queries subject to their privacy policies

---

## 10. Security Measures

We implement industry-standard security measures to protect your information:

- **Encryption in Transit:** All data transmitted between your device and our servers uses TLS 1.3 encryption
- **Encryption at Rest:** Sensitive data stored in Supabase is encrypted using AES-256 encryption
- **Access Controls:** Only authorized employees with a legitimate business need have access to personal data
- **Authentication:** Google OAuth 2.0 authentication with secure session management
- **Audit Logging:** We maintain logs of system access and data handling for security monitoring
- **Intrusion Detection:** We monitor for unauthorized access attempts and security threats
- **Vendor Security:** We require service providers to maintain SOC 2 Type II or equivalent certifications

**Limitations:**
However, no system is completely secure. You use the Service at your own risk. We cannot guarantee absolute security of data transmitted over the internet. Please take appropriate precautions with sensitive information and use strong, unique passwords.

---

## 11. International Data Transfers

Your information may be transferred to, stored in, and processed in countries other than your country of residence, including the United States. These countries may have different data protection laws than your jurisdiction.

**When we transfer data internationally, we ensure appropriate safeguards are in place:**

- **Standard Contractual Clauses (SCCs):** We use EU Standard Contractual Clauses for transfers involving EU/EEA data subjects to the United States and other countries
- **Adequacy Decisions:** We rely on countries with EU adequacy determinations where applicable
- **Contractual Protections:** We require data processors to commit to equivalent protection standards
- **Your Consent:** By using the Service, you consent to the transfer, storage, and processing of your information as described in this policy

If you have concerns about international transfers, please contact us at privacy@getromy.app.

---

## 12. Children's Privacy

**Rōmy is not intended for children under 13 years of age** (or 16 in the European Economic Area). We do not knowingly collect personal information from children under these ages.

If you believe we have collected information from a child under the applicable age threshold, please contact us immediately at privacy@getromy.app, and we will delete the information within 30 days.

**Note:** If you are a nonprofit staff member or volunteer under 13 or 16 using the Service on behalf of your organization, please alert your organization's account administrator, and we will work to address it.

---

## 13. Third-Party Links and Services

The Service may contain links to third-party websites, services, and applications. We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party sites or services before providing any information or using their services.

This Privacy Policy applies only to information collected through Rōmy. Third-party services are governed by their own terms and privacy policies.

---

## 14. Transparency: Open-Source Code

**Rōmy is open-source software.** You can review our code, data handling practices, and security implementations in our public repository on GitHub. This transparency allows independent verification of our privacy practices and security measures.

**GitHub Repository:** [Insert repository URL]

---

## 15. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect:
- Changes in our data practices
- New technologies and security measures
- Evolving legal requirements
- Feedback from users and regulators

**Notice of Changes:**
We will notify you of material changes by:
- Posting an updated policy on our website with a new "Last updated" date
- Sending an email notification to your registered email address
- Displaying a prominent in-app notification

**Your Rights:**
- Material changes will be effective 30 days after notice
- Your continued use of the Service after changes become effective constitutes acceptance of the updated Privacy Policy
- If you do not agree with material changes, you may delete your account before the changes take effect

---

## 16. Contact Us

For privacy-related inquiries, concerns, or requests, please contact our team:

**Email:** privacy@getromy.app  

**Mailing Address:**  
Rōmy (GetRomy LLC)  
Kerrville, TX 78028  
United States

**Response Time:**
We will acknowledge your inquiry within 10 business days and provide a substantive response within 30–45 days.

**For EU/EEA Residents:**
If you have concerns about our privacy practices and wish to escalate, you may lodge a complaint with your national data protection authority:
- **EU:** https://edpb.ec.europa.eu/about-edpb/members_en
- **UK:** https://ico.org.uk/

**For Canadian Residents:**
You may lodge a complaint with the Office of the Privacy Commissioner of Canada:
- **Website:** https://www.priv.gc.ca/
- **Telephone:** 1-800-282-1376

---

## 17. Acknowledgment

By using Rōmy, you consent to this Privacy Policy and agree to its terms. If you do not agree with this policy, please do not use the Service.

If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us using the information in Section 16.

---

**Last updated:** November 28, 2025  
**Effective date:** November 28, 2025  
**Version:** 2.0 (Multi-jurisdiction)
