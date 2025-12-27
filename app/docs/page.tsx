import { APP_DOMAIN } from "@/lib/config"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr"
import BloomerangIcon from "@/components/icons/bloomerang"
import VirtuousIcon from "@/components/icons/virtuous"
import NeonCRMIcon from "@/components/icons/neoncrm"
import DonorPerfectIcon from "@/components/icons/donorperfect"
import SalesforceIcon from "@/components/icons/salesforce"
import BlackbaudIcon from "@/components/icons/blackbaud"
import EveryActionIcon from "@/components/icons/everyaction"

export const metadata: Metadata = {
  title: "Integration Documentation - Rōmy",
  description: "Step-by-step guides for connecting your CRM to Rōmy",
  openGraph: {
    title: "Integration Documentation - Rōmy",
    description: "Step-by-step guides for connecting your CRM to Rōmy",
    type: "website",
    url: `${APP_DOMAIN}/docs`,
  },
}

export default function IntegrationDocs() {
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-24">
        <div className="mb-8 flex items-center justify-center gap-2 text-sm font-medium">
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
            BETA
          </span>
          <time className="text-foreground">Last updated December 2024</time>
        </div>

        <h1 className="mb-4 text-center text-4xl font-medium tracking-tight md:text-5xl">
          CRM Integration Guide
        </h1>

        <p className="text-foreground mb-8 text-center text-lg">
          Connect your donor management system to unlock AI-powered prospect research
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
          {/* Table of Contents */}
          <nav className="rounded-lg border border-border bg-muted/50 p-6 mb-12">
            <h2 className="mt-0 text-lg font-semibold">Quick Navigation</h2>
            <ul className="mb-0">
              <li><a href="#prerequisites">Prerequisites</a></li>
              <li><a href="#overview">Overview</a></li>
              <li><a href="#bloomerang">Bloomerang Setup</a></li>
              <li><a href="#virtuous">Virtuous Setup</a></li>
              <li><a href="#neoncrm">Neon CRM Setup</a></li>
              <li><a href="#donorperfect">DonorPerfect Setup</a></li>
              <li><a href="#salesforce">Salesforce NPSP Setup</a></li>
              <li><a href="#blackbaud">Raiser's Edge NXT Setup</a></li>
              <li><a href="#everyaction">EveryAction Setup</a></li>
              <li><a href="#syncing">Syncing Your Data</a></li>
              <li><a href="#troubleshooting">Troubleshooting</a></li>
              <li><a href="#security">Security & Privacy</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </nav>

          {/* Prerequisites */}
          <h2 id="prerequisites">Prerequisites</h2>
          <p>Before connecting your CRM, make sure you have:</p>
          <ul>
            <li><strong>A Rōmy account</strong> — You must be signed in (not using guest mode)</li>
            <li><strong>Admin access to your CRM</strong> — You'll need permission to generate API keys</li>
            <li><strong>Your CRM API key</strong> — Generated from your CRM's settings</li>
          </ul>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 my-4">
            <p className="mt-0 mb-0 text-sm"><strong>Note:</strong> CRM integrations require a Rōmy account. Guest users cannot connect CRMs. If you're using Rōmy locally without Supabase, this feature will not be available.</p>
          </div>

          <hr className="my-12" />

          {/* Overview */}
          <h2 id="overview">Overview</h2>
          <p>
            Rōmy's CRM integrations allow you to connect your existing donor management system to unlock powerful AI-powered prospect research. Once connected, Rōmy can:
          </p>
          <ul>
            <li><strong>Sync your constituent data</strong> — Import donors, contacts, and their giving history</li>
            <li><strong>Enrich donor profiles</strong> — Cross-reference with public data sources for wealth indicators</li>
            <li><strong>Identify major gift prospects</strong> — Use AI to surface high-potential donors</li>
            <li><strong>Research individuals</strong> — Deep-dive into specific donors with comprehensive research</li>
          </ul>

          <h3>Supported CRMs</h3>
          <div className="not-prose overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-medium">CRM</th>
                  <th className="py-3 px-4 text-left font-medium">Auth Method</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2">
                      <BloomerangIcon className="size-5" />
                      <strong>Bloomerang</strong>
                    </span>
                  </td>
                  <td className="py-3 px-4">API Key</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2">
                      <VirtuousIcon className="size-5" />
                      <strong>Virtuous</strong>
                    </span>
                  </td>
                  <td className="py-3 px-4">API Key (Bearer Token)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2">
                      <NeonCRMIcon className="size-5" />
                      <strong>Neon CRM</strong>
                    </span>
                  </td>
                  <td className="py-3 px-4">Org ID + API Key</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2">
                      <DonorPerfectIcon className="size-5" />
                      <strong>DonorPerfect</strong>
                    </span>
                  </td>
                  <td className="py-3 px-4">API Key</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2">
                      <SalesforceIcon className="size-5" />
                      <strong>Salesforce NPSP</strong>
                    </span>
                  </td>
                  <td className="py-3 px-4">Instance URL + Access Token (OAuth 2.0)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2">
                      <BlackbaudIcon className="size-5" />
                      <strong>Raiser's Edge NXT</strong>
                    </span>
                  </td>
                  <td className="py-3 px-4">Subscription Key + Access Token (OAuth 2.0)</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2">
                      <EveryActionIcon className="size-5" />
                      <strong>EveryAction</strong>
                    </span>
                  </td>
                  <td className="py-3 px-4">Application Name + API Key</td>
                </tr>
              </tbody>
            </table>
          </div>

          <hr className="my-12" />

          {/* Bloomerang */}
          <h2 id="bloomerang">Bloomerang Setup</h2>
          <p>
            <a href="https://bloomerang.co" target="_blank" rel="noopener noreferrer">Bloomerang</a> is a popular donor management CRM designed specifically for nonprofits. Follow these steps to connect your Bloomerang account.
          </p>

          <h3>Step 1: Generate Your API Key</h3>
          <ol>
            <li>Log in to your <strong>Bloomerang account</strong> as an administrator</li>
            <li>Navigate to <strong>Settings</strong> (gear icon in the top right)</li>
            <li>Select <strong>Integrations</strong> from the left sidebar</li>
            <li>Click on <strong>API Keys</strong></li>
            <li>Click <strong>Generate New API Key</strong></li>
            <li>Give your key a descriptive name (e.g., "Rōmy Integration")</li>
            <li><strong>Copy the API key immediately</strong> — it will only be shown once!</li>
          </ol>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 my-4">
            <p className="mt-0 mb-0 text-sm"><strong>Important:</strong> Bloomerang API keys are only displayed once when created. If you lose your key, you'll need to generate a new one.</p>
          </div>

          <h3>Step 2: Connect in Rōmy</h3>
          <ol>
            <li>Open Rōmy and go to <strong>Settings → Integrations</strong></li>
            <li>Click on the <strong>Bloomerang</strong> card</li>
            <li>Paste your API key into the input field</li>
            <li>Click <strong>Save Key</strong></li>
            <li>Wait for validation — Rōmy will verify your key works</li>
          </ol>

          <h3>Step 3: Sync Your Data</h3>
          <p>After connecting, click <strong>Sync Now</strong> to import your constituents and donation history. Initial syncs may take several minutes depending on your database size.</p>

          <h3>What Gets Synced</h3>
          <ul>
            <li><strong>Constituents:</strong> Names, addresses, emails, phone numbers</li>
            <li><strong>Donations:</strong> Gift amounts, dates, campaigns, funds</li>
            <li><strong>Giving Summary:</strong> Lifetime giving, largest gift, last gift date</li>
          </ul>

          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 my-4">
            <p className="mt-0 mb-0 text-sm"><strong>Note:</strong> Only <strong>"Active" constituents</strong> are synced from Bloomerang. Inactive, deceased, or archived constituents are not imported. This ensures you're working with current, relevant data.</p>
          </div>

          <p><strong>API Documentation:</strong> <a href="https://bloomerang.co/product/integrations-data-management/api/" target="_blank" rel="noopener noreferrer">Bloomerang API Reference</a></p>

          <hr className="my-12" />

          {/* Virtuous */}
          <h2 id="virtuous">Virtuous Setup</h2>
          <p>
            <a href="https://virtuous.org" target="_blank" rel="noopener noreferrer">Virtuous</a> is a responsive fundraising CRM that helps nonprofits build better donor relationships. Here's how to connect it.
          </p>

          <h3>Step 1: Generate Your API Key</h3>
          <ol>
            <li>Log in to your <strong>Virtuous account</strong></li>
            <li>Click your <strong>profile icon</strong> in the top right</li>
            <li>Select <strong>My Settings</strong></li>
            <li>Navigate to the <strong>API Keys</strong> tab</li>
            <li>Click <strong>Create New API Key</strong></li>
            <li>Name your key (e.g., "Rōmy Integration")</li>
            <li>Set appropriate permissions:
              <ul>
                <li><strong>Read</strong> access to Contacts is required</li>
                <li><strong>Read</strong> access to Gifts is required</li>
              </ul>
            </li>
            <li><strong>Copy the generated API key</strong></li>
          </ol>

          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 my-4">
            <p className="mt-0 mb-0 text-sm"><strong>Note:</strong> Virtuous uses Bearer token authentication. Rōmy handles the "Bearer " prefix automatically — just paste your raw API key.</p>
          </div>

          <h3>Step 2: Connect in Rōmy</h3>
          <ol>
            <li>Open Rōmy and go to <strong>Settings → Integrations</strong></li>
            <li>Click on the <strong>Virtuous</strong> card</li>
            <li>Paste your API key into the input field</li>
            <li>Click <strong>Save Key</strong></li>
            <li>Rōmy will validate your key against the Virtuous API</li>
          </ol>

          <h3>Step 3: Sync Your Data</h3>
          <p>Click <strong>Sync Now</strong> to begin importing your contacts and gift history.</p>

          <h3>What Gets Synced</h3>
          <ul>
            <li><strong>Contacts:</strong> Individual and household records with full contact details</li>
            <li><strong>Gifts:</strong> Donation amounts, dates, designations, and payment methods</li>
            <li><strong>Giving History:</strong> Aggregated giving statistics per contact</li>
          </ul>

          <h3>Rate Limits</h3>
          <p>Virtuous allows <strong>10,000 API requests per hour</strong>. Rōmy automatically throttles requests to stay within this limit.</p>

          <p><strong>API Documentation:</strong> <a href="https://docs.virtuoussoftware.com/" target="_blank" rel="noopener noreferrer">Virtuous API Reference</a></p>

          <hr className="my-12" />

          {/* Neon CRM */}
          <h2 id="neoncrm">Neon CRM Setup</h2>
          <p>
            <a href="https://neoncrm.com" target="_blank" rel="noopener noreferrer">Neon CRM</a> (formerly NeonCRM, by Neon One) is a comprehensive nonprofit software platform. Neon CRM requires <strong>two credentials</strong>: your Organization ID and an API Key.
          </p>

          <h3>Step 1: Find Your Organization ID</h3>
          <ol>
            <li>Log in to your <strong>Neon CRM account</strong></li>
            <li>Navigate to <strong>Settings</strong> (gear icon)</li>
            <li>Go to <strong>Organization Profile → Account Information</strong></li>
            <li>Your <strong>Organization ID</strong> is displayed at the top (usually a short alphanumeric code)</li>
            <li>Copy this ID — you'll need it in Rōmy</li>
          </ol>

          <h3>Step 2: Generate Your API Key</h3>
          <ol>
            <li>In Neon CRM, go to <strong>Settings → User Management</strong></li>
            <li>Select your user account (or a dedicated API user)</li>
            <li>Navigate to the <strong>API Access</strong> section</li>
            <li>Click <strong>Generate API Key</strong></li>
            <li>Copy the generated key</li>
          </ol>

          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 my-4">
            <p className="mt-0 mb-0 text-sm"><strong>Tip:</strong> Create a dedicated "API User" in your Neon CRM account specifically for integrations. This makes it easier to manage access and revoke if needed.</p>
          </div>

          <h3>Step 3: Connect in Rōmy</h3>
          <ol>
            <li>Open Rōmy and go to <strong>Settings → Integrations</strong></li>
            <li>Click on the <strong>Neon CRM</strong> card</li>
            <li>Enter your <strong>Organization ID</strong> in the first field</li>
            <li>Enter your <strong>API Key</strong> in the second field</li>
            <li>Click <strong>Save Key</strong></li>
            <li>Rōmy will validate both credentials</li>
          </ol>

          <h3>Step 4: Sync Your Data</h3>
          <p>After successful connection, click <strong>Sync Now</strong> to import your accounts and donations.</p>

          <h3>What Gets Synced</h3>
          <ul>
            <li><strong>Accounts:</strong> Individual and organization records</li>
            <li><strong>Account Details:</strong> Addresses, emails, phone numbers, custom fields</li>
            <li><strong>Donations:</strong> Gift records with amounts, dates, campaigns</li>
          </ul>

          <h3>Trial vs. Production</h3>
          <p>If you're using a <strong>Neon CRM trial instance</strong> (trial.neoncrm.com), the API endpoints are slightly different. Rōmy automatically handles this, but ensure your trial hasn't expired.</p>

          <p><strong>API Documentation:</strong> <a href="https://developer.neoncrm.com/api-v2/" target="_blank" rel="noopener noreferrer">Neon CRM API v2 Reference</a></p>

          <hr className="my-12" />

          {/* DonorPerfect */}
          <h2 id="donorperfect">DonorPerfect Setup</h2>
          <p>
            <a href="https://donorperfect.com" target="_blank" rel="noopener noreferrer">DonorPerfect</a> is one of the most widely-used nonprofit CRMs, trusted by thousands of organizations. DonorPerfect uses an XML-based API.
          </p>

          <h3>Step 1: Request API Access</h3>
          <p>DonorPerfect API access must be enabled by their support team:</p>
          <ol>
            <li>Contact <strong>DonorPerfect Support</strong> to request API access
              <ul>
                <li>Email: <a href="mailto:support@donorperfect.com">support@donorperfect.com</a></li>
                <li>Or call: 1-800-220-8111</li>
              </ul>
            </li>
            <li>Request an <strong>XML API key</strong> for your account</li>
            <li>Specify that you need access to:
              <ul>
                <li><code>dp_donorsearch</code> — for searching donors</li>
                <li><code>dp_gifts</code> — for retrieving gift records</li>
                <li>SELECT queries on <code>DP</code> and <code>DPGIFT</code> tables</li>
              </ul>
            </li>
            <li>DonorPerfect will provision your API key (usually within 1-2 business days)</li>
          </ol>

          <h3>Step 2: Retrieve Your API Key</h3>
          <p>Once DonorPerfect enables API access:</p>
          <ol>
            <li>Log in to <strong>DonorPerfect Online</strong></li>
            <li>Navigate to <strong>Admin → System Settings → API Settings</strong></li>
            <li>Your API key will be displayed (it's typically a long alphanumeric string, 100+ characters)</li>
            <li>Copy the entire key</li>
          </ol>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 my-4">
            <p className="mt-0 mb-0 text-sm"><strong>Important:</strong> DonorPerfect API keys are very long (100+ characters). Make sure you copy the entire key without truncation.</p>
          </div>

          <h3>Step 3: Connect in Rōmy</h3>
          <ol>
            <li>Open Rōmy and go to <strong>Settings → Integrations</strong></li>
            <li>Click on the <strong>DonorPerfect</strong> card</li>
            <li>Paste your full API key</li>
            <li>Click <strong>Save Key</strong></li>
            <li>Rōmy will validate your key by making a test query</li>
          </ol>

          <h3>Step 4: Sync Your Data</h3>
          <p>Click <strong>Sync Now</strong> to begin importing. DonorPerfect has a <strong>500 record limit per query</strong>, so large databases may take longer to sync.</p>

          <h3>What Gets Synced</h3>
          <ul>
            <li><strong>Donors (DP table):</strong> Names, addresses, contact info, donor types</li>
            <li><strong>Gifts (DPGIFT table):</strong> Gift records with amounts, dates, GL codes, campaigns</li>
            <li><strong>Giving Summary:</strong> Lifetime giving totals, largest gifts, giving history</li>
          </ul>

          <h3>Technical Notes</h3>
          <ul>
            <li>DonorPerfect uses <strong>XML responses</strong> (not JSON). Rōmy handles parsing automatically.</li>
            <li>The API has a <strong>500 row limit</strong> per query. Rōmy paginates automatically using <code>WHERE donor_id &gt; [lastId]</code>.</li>
            <li>Date formats are <code>MM/DD/YYYY</code> — Rōmy normalizes these to ISO format.</li>
          </ul>

          <p><strong>API Documentation:</strong> <a href="https://www.donorperfect.com/support" target="_blank" rel="noopener noreferrer">DonorPerfect Support Center</a></p>

          <hr className="my-12" />

          {/* Salesforce NPSP */}
          <h2 id="salesforce">Salesforce NPSP Setup</h2>
          <p>
            <a href="https://www.salesforce.org/nonprofit/nonprofit-success-pack/" target="_blank" rel="noopener noreferrer">Salesforce NPSP</a> (Nonprofit Success Pack) is an enterprise-grade CRM built on the Salesforce platform. NPSP extends Salesforce with nonprofit-specific features like donation tracking, household management, and engagement plans.
          </p>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 my-4">
            <p className="mt-0 mb-0 text-sm"><strong>Note:</strong> Salesforce uses OAuth 2.0 for authentication. You'll need to create a Connected App in Salesforce to generate access tokens. This is more complex than simple API keys.</p>
          </div>

          <h3>Step 1: Create a Connected App</h3>
          <ol>
            <li>Log in to your <strong>Salesforce org</strong> as an administrator</li>
            <li>Go to <strong>Setup</strong> (gear icon → Setup)</li>
            <li>In Quick Find, search for <strong>"App Manager"</strong></li>
            <li>Click <strong>New Connected App</strong></li>
            <li>Fill in the basic information:
              <ul>
                <li>Connected App Name: "Rōmy Integration"</li>
                <li>API Name: "Romy_Integration"</li>
                <li>Contact Email: Your admin email</li>
              </ul>
            </li>
            <li>Enable OAuth Settings:
              <ul>
                <li>Check <strong>Enable OAuth Settings</strong></li>
                <li>Callback URL: <code>https://intel.getromy.app/auth/callback</code></li>
                <li>Selected OAuth Scopes: Add "Full access (full)" and "Perform requests at any time (refresh_token)"</li>
              </ul>
            </li>
            <li>Click <strong>Save</strong> and wait 2-10 minutes for activation</li>
          </ol>

          <h3>Step 2: Get Your Consumer Key and Secret</h3>
          <ol>
            <li>After saving, click <strong>Manage Consumer Details</strong></li>
            <li>Verify with MFA if prompted</li>
            <li>Copy the <strong>Consumer Key</strong> and <strong>Consumer Secret</strong></li>
          </ol>

          <h3>Step 3: Generate an Access Token</h3>
          <p>For the beta integration, you'll need to generate a token manually:</p>
          <ol>
            <li>Go to <strong>Workbench</strong>: <a href="https://workbench.developerforce.com" target="_blank" rel="noopener noreferrer">workbench.developerforce.com</a></li>
            <li>Accept terms and log in with your Salesforce credentials</li>
            <li>Go to <strong>Utilities → REST Explorer</strong></li>
            <li>Your session is now authenticated — note your <strong>Instance URL</strong> (e.g., <code>https://yourorg.my.salesforce.com</code>)</li>
            <li>For the Access Token, use your session ID from Workbench or generate one via OAuth flow</li>
          </ol>

          <h3>Step 4: Connect in Rōmy</h3>
          <ol>
            <li>Open Rōmy and go to <strong>Settings → Integrations</strong></li>
            <li>Click on the <strong>Salesforce NPSP</strong> card</li>
            <li>Enter your <strong>Instance URL</strong> (e.g., <code>https://yourorg.my.salesforce.com</code>)</li>
            <li>Enter your <strong>Access Token</strong></li>
            <li>Click <strong>Save Key</strong></li>
          </ol>

          <h3>What Gets Synced</h3>
          <ul>
            <li><strong>Contacts:</strong> Name, email, phone, addresses from NPSP Contact records</li>
            <li><strong>Opportunities:</strong> Donations (Closed Won opportunities) with amounts and dates</li>
            <li><strong>NPSP Rollups:</strong> Lifetime giving, first/last gift dates from NPSP rollup fields</li>
          </ul>

          <h3>Rate Limits</h3>
          <p>Salesforce has generous rate limits (100,000+ API calls/day for most orgs), but respects HTTP 429 responses. Rōmy automatically handles throttling.</p>

          <p><strong>API Documentation:</strong> <a href="https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest.htm" target="_blank" rel="noopener noreferrer">Salesforce REST API Developer Guide</a></p>

          <hr className="my-12" />

          {/* Blackbaud / Raiser's Edge NXT */}
          <h2 id="blackbaud">Raiser's Edge NXT Setup</h2>
          <p>
            <a href="https://www.blackbaud.com/products/blackbaud-raisers-edge-nxt" target="_blank" rel="noopener noreferrer">Raiser's Edge NXT</a> by Blackbaud is one of the most widely-used enterprise fundraising platforms. It uses the <strong>Blackbaud SKY API</strong> for integrations.
          </p>

          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 my-4">
            <p className="mt-0 mb-0 text-sm"><strong>Important:</strong> SKY API requires both an OAuth 2.0 access token AND a subscription key. You'll need to register as a SKY API developer.</p>
          </div>

          <h3>Step 1: Register for SKY API Access</h3>
          <ol>
            <li>Go to <a href="https://developer.blackbaud.com" target="_blank" rel="noopener noreferrer">developer.blackbaud.com</a></li>
            <li>Click <strong>Sign Up</strong> and create a Blackbaud ID (or use existing)</li>
            <li>Complete the developer registration form</li>
            <li>Accept the API terms of service</li>
          </ol>

          <h3>Step 2: Create an Application</h3>
          <ol>
            <li>In the developer portal, click <strong>My Applications</strong></li>
            <li>Click <strong>Create an Application</strong></li>
            <li>Fill in application details:
              <ul>
                <li>Application Name: "Rōmy Integration"</li>
                <li>Organization: Your organization name</li>
                <li>Redirect URIs: <code>https://intel.getromy.app/auth/callback</code></li>
              </ul>
            </li>
            <li>After creation, note your <strong>Application ID</strong> and <strong>Primary Application Secret</strong></li>
          </ol>

          <h3>Step 3: Get Your Subscription Key</h3>
          <ol>
            <li>In the developer portal, go to <strong>My Subscriptions</strong></li>
            <li>You'll see your <strong>Primary Key</strong> and <strong>Secondary Key</strong></li>
            <li>Copy the <strong>Primary Key</strong> — this is your subscription key</li>
          </ol>

          <h3>Step 4: Authorize Your Application</h3>
          <ol>
            <li>You need to connect your app to a Blackbaud environment (your RE NXT org)</li>
            <li>Use the OAuth 2.0 authorization code flow to get an access token</li>
            <li>The access token provides access to your constituent and gift data</li>
          </ol>

          <h3>Step 5: Connect in Rōmy</h3>
          <ol>
            <li>Open Rōmy and go to <strong>Settings → Integrations</strong></li>
            <li>Click on the <strong>Raiser's Edge NXT</strong> card</li>
            <li>Enter your <strong>Subscription Key</strong></li>
            <li>Enter your <strong>Access Token</strong></li>
            <li>Click <strong>Save Key</strong></li>
          </ol>

          <h3>What Gets Synced</h3>
          <ul>
            <li><strong>Constituents:</strong> Individuals and organizations with contact information</li>
            <li><strong>Gifts:</strong> Posted donations with amounts, dates, and fund designations</li>
            <li><strong>Giving Summary:</strong> Lifetime giving, largest gift, consecutive giving years</li>
          </ul>

          <h3>Rate Limits</h3>
          <p>SKY API allows <strong>10 calls per second</strong> and 50,000-100,000 daily calls. Rōmy respects these limits with built-in throttling.</p>

          <p><strong>API Documentation:</strong> <a href="https://developer.blackbaud.com/skyapi/docs" target="_blank" rel="noopener noreferrer">SKY API Documentation</a></p>

          <hr className="my-12" />

          {/* EveryAction */}
          <h2 id="everyaction">EveryAction Setup</h2>
          <p>
            <a href="https://www.everyaction.com" target="_blank" rel="noopener noreferrer">EveryAction</a> (part of NGP VAN/Bonterra) is a powerful platform for progressive organizations, combining fundraising, advocacy, and voter contact tools.
          </p>

          <h3>Step 1: Request API Access</h3>
          <ol>
            <li>Contact your EveryAction account manager to request API access</li>
            <li>Or email <a href="mailto:apiteam@ngpvan.com">apiteam@ngpvan.com</a></li>
            <li>Specify you need access to the <strong>People</strong> and <strong>Contributions</strong> endpoints</li>
          </ol>

          <h3>Step 2: Receive Your Credentials</h3>
          <p>EveryAction will provide you with:</p>
          <ul>
            <li><strong>Application Name:</strong> A short string identifying your application</li>
            <li><strong>API Key:</strong> Your authentication key (includes database mode indicator)</li>
          </ul>

          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 my-4">
            <p className="mt-0 mb-0 text-sm"><strong>Note:</strong> EveryAction API keys often include a pipe character and number (e.g., <code>abc123|1</code>). The number indicates database mode: <code>0</code> for VoterFile, <code>1</code> for MyCampaign/MyMembers.</p>
          </div>

          <h3>Step 3: Connect in Rōmy</h3>
          <ol>
            <li>Open Rōmy and go to <strong>Settings → Integrations</strong></li>
            <li>Click on the <strong>EveryAction</strong> card</li>
            <li>Enter your <strong>Application Name</strong></li>
            <li>Enter your <strong>API Key</strong></li>
            <li>Click <strong>Save Key</strong></li>
          </ol>

          <h3>What Gets Synced</h3>
          <ul>
            <li><strong>People:</strong> Individual records with emails, phones, and addresses</li>
            <li><strong>Contributions:</strong> Donation records with amounts, dates, and designations</li>
            <li><strong>Codes:</strong> Associated tags and codes for segmentation</li>
          </ul>

          <h3>Rate Limits</h3>
          <p>EveryAction doesn't publish specific rate limits but may throttle during high-volume periods. Rōmy uses conservative request pacing.</p>

          <p><strong>API Documentation:</strong> <a href="https://docs.everyaction.com" target="_blank" rel="noopener noreferrer">EveryAction API Reference</a></p>

          <hr className="my-12" />

          {/* Syncing Your Data */}
          <h2 id="syncing">Syncing Your Data</h2>

          <h3>Initial Sync</h3>
          <p>Your first sync imports all constituents and donations from your CRM. Depending on your database size:</p>
          <ul>
            <li><strong>Small databases (&lt;1,000 records):</strong> 1-2 minutes</li>
            <li><strong>Medium databases (1,000-10,000 records):</strong> 5-15 minutes</li>
            <li><strong>Large databases (10,000+ records):</strong> 15-60 minutes</li>
          </ul>

          <h3>Incremental Syncs</h3>
          <p>After the initial sync, subsequent syncs only pull updated records (where supported by the CRM API). This is much faster.</p>

          <h3>Sync Limits</h3>
          <ul>
            <li><strong>Maximum records:</strong> 50,000 constituents per account</li>
            <li><strong>Minimum sync interval:</strong> 5 minutes between syncs</li>
            <li><strong>Batch size:</strong> 100 records per API request</li>
          </ul>

          <h3>Manual Sync</h3>
          <p>To manually trigger a sync:</p>
          <ol>
            <li>Go to <strong>Settings → Integrations</strong></li>
            <li>Find your connected CRM</li>
            <li>Click the <strong>Sync</strong> button (circular arrow icon)</li>
          </ol>

          <h3>Updating Your API Key</h3>
          <p>If you need to update or replace your API key (e.g., after rotating keys in your CRM):</p>
          <ol>
            <li>Go to <strong>Settings → Integrations</strong></li>
            <li>Click on the connected CRM card</li>
            <li>Enter your new API key in the input field</li>
            <li>Click the <strong>Update</strong> button (instead of "Connect")</li>
          </ol>
          <p>Your synced data will be preserved — only the API key is replaced.</p>

          <h3>Viewing Synced Data</h3>
          <p>After syncing, your constituent and donation data is available for AI-powered research:</p>
          <ul>
            <li><strong>Record count:</strong> Visible on the CRM card in Settings → Integrations (e.g., "Records: 1,234")</li>
            <li><strong>Last sync time:</strong> Shows when data was last updated (e.g., "Last sync: 2h ago")</li>
            <li><strong>Using the data:</strong> Start a new chat and ask Rōmy to research a donor by name. Rōmy will automatically use your synced CRM data along with public records for comprehensive prospect research.</li>
          </ul>

          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 my-4">
            <p className="mt-0 mb-0 text-sm"><strong>Tip:</strong> Try asking: "Research [donor name] from my CRM" or "Who are my top 10 donors by lifetime giving?" to leverage your synced data.</p>
          </div>

          <h3>Recommended Sync Frequency</h3>
          <p>How often you sync depends on how frequently your CRM data changes:</p>
          <ul>
            <li><strong>Daily:</strong> For organizations with frequent new gifts or constituent updates</li>
            <li><strong>Weekly:</strong> For most organizations with moderate activity</li>
            <li><strong>Monthly:</strong> For organizations with stable donor bases</li>
          </ul>
          <p>Rōmy enforces a <strong>minimum 5-minute interval</strong> between syncs to prevent API overuse.</p>

          <hr className="my-12" />

          {/* Troubleshooting */}
          <h2 id="troubleshooting">Troubleshooting</h2>

          <h3>"Invalid API Key" Error</h3>
          <ul>
            <li><strong>Double-check your key:</strong> Ensure you copied the entire key without extra spaces</li>
            <li><strong>Key expiration:</strong> Some CRMs expire API keys. Generate a new one if needed.</li>
            <li><strong>Permissions:</strong> Ensure your API key has read access to contacts/donors and gifts</li>
            <li><strong>Account status:</strong> Verify your CRM subscription is active</li>
          </ul>

          <h3>"Connection Timeout" Error</h3>
          <ul>
            <li><strong>CRM maintenance:</strong> The CRM provider may be performing maintenance</li>
            <li><strong>Rate limits:</strong> You may have exceeded API rate limits. Wait 15-30 minutes and try again.</li>
            <li><strong>Network issues:</strong> Check your internet connection</li>
          </ul>

          <h3>"Sync Failed" Error</h3>
          <ul>
            <li><strong>Large database:</strong> Very large databases may timeout. Try again — progress is saved.</li>
            <li><strong>API changes:</strong> The CRM provider may have updated their API. Contact us if persistent.</li>
          </ul>

          <h3>Missing Data After Sync</h3>
          <ul>
            <li><strong>Filter settings:</strong> Check if your CRM has data filters or views applied</li>
            <li><strong>User permissions:</strong> Ensure your API key user has access to all records</li>
            <li><strong>Data types:</strong> We sync donors/contacts and gifts. Other record types (events, volunteers) aren't yet supported.</li>
          </ul>

          <h3>DonorPerfect-Specific Issues</h3>
          <ul>
            <li><strong>"Received HTML instead of XML":</strong> Your API key may be invalid or expired. Contact DonorPerfect support.</li>
            <li><strong>Slow syncs:</strong> DonorPerfect's 500-row limit means large databases require many requests. This is normal.</li>
          </ul>

          <h3>Virtuous-Specific Issues</h3>

          <h4>"No Access to Data" or Empty Sync Results</h4>
          <p>
            If your Virtuous API key connects successfully but syncs return no data, this is almost always a <strong>user permissions issue</strong> in Virtuous, not a Rōmy bug.
          </p>

          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 my-4">
            <p className="mt-0 mb-2 text-sm font-semibold">Important: API keys inherit the permissions of the user who created them</p>
            <p className="mt-0 mb-0 text-sm">If your Virtuous user account has limited permissions, your API key will have those same limitations — even if the key itself is valid.</p>
          </div>

          <p><strong>Common causes:</strong></p>
          <ul>
            <li><strong>Insufficient Contact/Gift permissions:</strong> Your user role may not have Read access to Contacts or Gifts</li>
            <li><strong>Private data restrictions:</strong> Contacts or Gifts marked as "private" in Virtuous won't sync unless your user has "View Private Data" permission</li>
            <li><strong>Non-Admin role:</strong> Only Admin users have full access to all data by default</li>
          </ul>

          <p><strong>How to fix:</strong></p>
          <ol>
            <li>Log in to Virtuous as an <strong>Admin user</strong></li>
            <li>Go to <strong>Settings → User Management → Permissions</strong></li>
            <li>Check the permission group for the user who generated the API key</li>
            <li>Ensure they have:
              <ul>
                <li><strong>Contact Read</strong> permission</li>
                <li><strong>Gift Read</strong> permission</li>
                <li><strong>View Private Data</strong> (if your org uses private records)</li>
              </ul>
            </li>
            <li>Alternatively, generate a new API key as an Admin user</li>
          </ol>

          <p><strong>Helpful Virtuous documentation:</strong></p>
          <ul>
            <li><a href="https://support.virtuous.org/hc/en-us/articles/360050985731-How-Do-I-Manage-User-Permissions" target="_blank" rel="noopener noreferrer">How Do I Manage User Permissions?</a></li>
            <li><a href="https://support.virtuous.org/hc/en-us/articles/6984382728589-Understanding-Private-Data-in-Virtuous-CRM" target="_blank" rel="noopener noreferrer">Understanding Private Data in Virtuous CRM+</a></li>
            <li><a href="https://support.virtuous.org/hc/en-us/articles/360052340251-Virtuous-API-Authentication" target="_blank" rel="noopener noreferrer">Virtuous API Authentication</a></li>
          </ul>

          <hr className="my-12" />

          {/* Security & Privacy */}
          <h2 id="security">Security & Privacy</h2>

          <h3>How We Protect Your Data</h3>
          <ul>
            <li><strong>Encrypted storage:</strong> API keys are encrypted using AES-256 before being stored</li>
            <li><strong>Encrypted transmission:</strong> All API calls use TLS 1.3 encryption</li>
            <li><strong>Minimal access:</strong> We only request read access — we never modify your CRM data</li>
            <li><strong>User-scoped:</strong> Your CRM data is only accessible to your account</li>
          </ul>

          <h3>Data Handling</h3>
          <ul>
            <li><strong>Synced data</strong> is stored in your Rōmy account's secure database</li>
            <li><strong>Original data</strong> remains in your CRM — we create a copy for analysis</li>
            <li><strong>Deletion:</strong> Disconnect your CRM to remove synced data from Rōmy</li>
          </ul>

          <h3>API Key Security</h3>
          <ul>
            <li>Never share your API keys with anyone</li>
            <li>Rotate keys periodically (recommended: every 6-12 months)</li>
            <li>Use dedicated API users in your CRM when possible</li>
            <li>Revoke keys immediately if you suspect compromise</li>
          </ul>

          <h3>Disconnecting a CRM</h3>
          <p>To disconnect a CRM and remove your API key:</p>
          <ol>
            <li>Go to <strong>Settings → Integrations</strong></li>
            <li>Find the connected CRM</li>
            <li>Click the <strong>Disconnect</strong> button (trash icon)</li>
            <li>Confirm the disconnection</li>
          </ol>
          <p>This will delete your API key from Rōmy. Your synced constituent data will remain unless you explicitly delete it.</p>

          <hr className="my-12" />

          {/* FAQ */}
          <h2 id="faq">Frequently Asked Questions</h2>

          <h3>Can I connect multiple CRMs at once?</h3>
          <p>Yes! You can connect multiple CRMs simultaneously. Each CRM's data is synced separately and stored with its provider tag, so Rōmy knows which records came from which system.</p>

          <h3>Does Rōmy modify my CRM data?</h3>
          <p>No. Rōmy only has <strong>read access</strong> to your CRM. We pull a copy of your data for analysis but never write back or modify your original records.</p>

          <h3>What happens if my API key expires?</h3>
          <p>Your previously synced data will remain available, but new syncs will fail. Simply update your API key in Settings → Integrations to restore syncing. You don't need to disconnect and reconnect.</p>

          <h3>Can I sync only certain records?</h3>
          <p>Currently, Rōmy syncs all eligible records from your CRM. Some filtering happens automatically:</p>
          <ul>
            <li><strong>Bloomerang:</strong> Only "Active" constituents are synced</li>
            <li><strong>Other CRMs:</strong> All accessible records are synced up to the 50,000 record limit</li>
          </ul>

          <h3>How do I delete my synced data?</h3>
          <p>To remove synced data, disconnect the CRM integration. This deletes your API key but preserves synced data. To fully remove all data, contact support.</p>

          <h3>Why is my sync taking so long?</h3>
          <p>Sync times depend on your database size and the CRM's API limitations:</p>
          <ul>
            <li><strong>DonorPerfect:</strong> Limited to 500 records per API call, so large databases require many requests</li>
            <li><strong>Virtuous:</strong> Rate limited to 10,000 requests/hour</li>
            <li><strong>Large databases:</strong> 10,000+ records can take 15-60 minutes</li>
          </ul>
          <p>Syncs are performed in the background — you can continue using Rōmy while it runs.</p>

          <h3>Is my data secure?</h3>
          <p>Yes. API keys are encrypted with AES-256 before storage. All data transmission uses TLS 1.3. Your data is only accessible to your account and is never shared or used for training AI models.</p>

          <hr className="my-12" />

          {/* Getting Help */}
          <h2>Need Help?</h2>
          <p>If you're having trouble connecting your CRM or encounter issues not covered here:</p>
          <ul>
            <li><strong>Email:</strong> <a href="mailto:support@getromy.app">support@getromy.app</a></li>
          </ul>
          <p>When reporting issues, please include:</p>
          <ul>
            <li>Which CRM you're trying to connect</li>
            <li>The exact error message you're seeing</li>
            <li>Steps to reproduce the issue</li>
          </ul>

          <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
            <p>Last updated: December 2024</p>
            <p>Version: 1.0</p>
          </div>
        </div>
      </div>
    </>
  )
}
