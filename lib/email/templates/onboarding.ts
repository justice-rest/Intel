/**
 * Onboarding Email Templates
 * 4-email sequence for new user onboarding
 *
 * Email 1: Welcome (immediate)
 * Email 2: How It Works (day 2-3)
 * Email 3: Common Challenges (day 4-5)
 * Email 4: Moving Forward (day 6-7)
 */

export interface OnboardingEmailData {
  firstName: string
  email: string
  appUrl?: string
}

const APP_URL = "https://intel.getromy.app"
const LOGO_URL = "https://the-romy.vercel.app/BrandmarkRōmy.png"

// Common email wrapper for all onboarding emails
function getEmailWrapper(content: string, subject: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<title>${subject}</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" content="" />
<meta content="target-densitydpi=device-dpi" name="viewport" />
<meta content="true" name="HandheldFriendly" />
<meta content="width=device-width" name="viewport" />
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
<style type="text/css">
table {
  border-collapse: separate;
  table-layout: fixed;
  mso-table-lspace: 0pt;
  mso-table-rspace: 0pt;
}
table td {
  border-collapse: collapse;
}
body, a, li, p, h1, h2, h3 {
  -ms-text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
}
body {
  min-width: 100%;
  margin: 0;
  padding: 0;
  background-color: #F9F9F9;
  font-family: Inter, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
}
a {
  text-decoration: none;
  color: #00A5E4;
}
.email-container {
  max-width: 600px;
  margin: 0 auto;
  background-color: #FFFFFF;
}
.email-header {
  padding: 40px 40px 30px;
  text-align: center;
}
.email-body {
  padding: 0 40px 40px;
}
.email-footer {
  padding: 30px 40px;
  background-color: #F2EFF3;
  text-align: center;
}
.logo {
  max-width: 200px;
  height: auto;
}
h1 {
  font-size: 24px;
  font-weight: 600;
  color: #111111;
  margin: 0 0 20px;
  line-height: 1.3;
  letter-spacing: -0.5px;
}
h2 {
  font-size: 18px;
  font-weight: 600;
  color: #111111;
  margin: 25px 0 15px;
  line-height: 1.3;
}
p {
  font-size: 15px;
  color: #424040;
  line-height: 1.6;
  margin: 0 0 15px;
}
.btn-primary {
  display: inline-block;
  padding: 14px 32px;
  background-color: #00A5E4;
  color: #FFFFFF !important;
  font-weight: 600;
  font-size: 15px;
  border-radius: 8px;
  text-decoration: none;
  margin: 20px 0;
}
.tip-box {
  background-color: #F2EFF3;
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
}
.tip-box h3 {
  font-size: 14px;
  font-weight: 600;
  color: #111111;
  margin: 0 0 10px;
}
.tip-box p {
  font-size: 14px;
  margin: 0;
}
.signature {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #E5E5E5;
}
.signature p {
  margin: 5px 0;
  font-size: 14px;
}
.footer-text {
  font-size: 12px;
  color: #84828E;
  margin: 0;
}
ul {
  margin: 15px 0;
  padding-left: 20px;
}
li {
  font-size: 15px;
  color: #424040;
  line-height: 1.6;
  margin-bottom: 10px;
}
@media (max-width: 600px) {
  .email-header, .email-body, .email-footer {
    padding-left: 20px !important;
    padding-right: 20px !important;
  }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#F9F9F9;">
<div style="background-color:#F9F9F9;padding:40px 20px;">
<table class="email-container" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background-color:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E5E5E5;">
${content}
</table>
</div>
</body>
</html>`
}

// ============================================================================
// EMAIL 1: WELCOME (Immediate)
// ============================================================================

export function getWelcomeEmailHtml(data: OnboardingEmailData): string {
  const { firstName, appUrl = APP_URL } = data

  const content = `
<tr>
  <td class="email-header">
    <a href="${appUrl}"><img src="${LOGO_URL}" alt="Rōmy" class="logo" style="max-width:180px;height:auto;" /></a>
  </td>
</tr>
<tr>
  <td class="email-body">
    <h1>Welcome to Rōmy, ${firstName}!</h1>

    <p>Thank you for joining us. You've just taken the first step toward transforming how your nonprofit finds and cultivates major donors.</p>

    <p>Rōmy is designed specifically for small nonprofits like yours who deserve access to the same powerful prospect research tools that large organizations use - without the enterprise price tag.</p>

    <h2>What You Can Do Right Now:</h2>

    <ul>
      <li><strong>Quick Research:</strong> Ask Rōmy about any potential donor and get instant insights on their giving capacity, philanthropic interests, and connection points.</li>
      <li><strong>Batch Research:</strong> Upload a list of prospects and let Rōmy research them all at once - perfect for event follow-up or database screening.</li>
      <li><strong>Export Reports:</strong> Generate professional PDF reports to share with your board or development committee.</li>
    </ul>

    <div style="text-align:center;">
      <a href="${appUrl}" class="btn-primary">Start Researching</a>
    </div>

    <div class="tip-box">
      <h3>Quick Tip</h3>
      <p>Try your first search by typing something like: "Research John Smith, 123 Main Street, Seattle, WA - what's his giving capacity?"</p>
    </div>

    <div class="signature">
      <p>With Warm Regards,</p>
      <p><strong>Howard Freeman</strong></p>
      <p>Founder & CEO, Rōmy</p>
    </div>
  </td>
</tr>
<tr>
  <td class="email-footer">
    <p class="footer-text">Rōmy helps small nonprofits find new major donors at a fraction of the cost of existing solutions.</p>
    <p class="footer-text" style="margin-top:15px;">Questions? Reply to this email - we read every message.</p>
  </td>
</tr>`

  return getEmailWrapper(content, "Welcome to Rōmy!")
}

export function getWelcomeEmailSubject(firstName: string): string {
  return `Welcome to Rōmy, ${firstName}!`
}

// ============================================================================
// EMAIL 2: HOW IT WORKS (Day 2-3)
// ============================================================================

export function getHowItWorksEmailHtml(data: OnboardingEmailData): string {
  const { firstName, appUrl = APP_URL } = data

  const content = `
<tr>
  <td class="email-header">
    <a href="${appUrl}"><img src="${LOGO_URL}" alt="Rōmy" class="logo" style="max-width:180px;height:auto;" /></a>
  </td>
</tr>
<tr>
  <td class="email-body">
    <h1>How Rōmy Works, ${firstName}</h1>

    <p>Now that you've had a chance to explore, let me share how other nonprofits are getting the most out of Rōmy.</p>

    <h2>The 3 Research Modes</h2>

    <p><strong>1. Quick Research (Chat)</strong></p>
    <p>Just ask a question in natural language. Rōmy searches public records, FEC filings, SEC data, property records, and more to build a complete picture of any prospect.</p>

    <p><strong>2. Deep Research</strong></p>
    <p>Toggle on "Deep Research" for comprehensive reports that include spouse information, business valuations, philanthropic history, and detailed giving capacity analysis.</p>

    <p><strong>3. Batch Research</strong></p>
    <p>Upload a CSV with your prospect list. Rōmy will research each person and deliver exportable reports - perfect for event attendee lists or database enrichment.</p>

    <h2>What Rōmy Searches</h2>

    <ul>
      <li><strong>Property Records:</strong> Home values, additional properties, ownership history</li>
      <li><strong>Business Affiliations:</strong> LLC ownership, executive roles, board positions</li>
      <li><strong>SEC Filings:</strong> Stock holdings, insider transactions</li>
      <li><strong>FEC Data:</strong> Political contributions and patterns</li>
      <li><strong>Nonprofit 990s:</strong> Foundation connections, board service, giving history</li>
    </ul>

    <div class="tip-box">
      <h3>Pro Tip</h3>
      <p>The more specific your query, the better. Include full name, city/state, and any known affiliations for the most accurate results.</p>
    </div>

    <div style="text-align:center;">
      <a href="${appUrl}" class="btn-primary">Try Deep Research</a>
    </div>

    <div class="signature">
      <p>With Warm Regards,</p>
      <p><strong>Howard Freeman</strong></p>
      <p>Founder & CEO, Rōmy</p>
    </div>
  </td>
</tr>
<tr>
  <td class="email-footer">
    <p class="footer-text">Rōmy helps small nonprofits find new major donors at a fraction of the cost of existing solutions.</p>
  </td>
</tr>`

  return getEmailWrapper(content, "How Rōmy Works")
}

export function getHowItWorksEmailSubject(): string {
  return "How to get the most out of Rōmy"
}

// ============================================================================
// EMAIL 3: COMMON CHALLENGES (Day 4-5)
// ============================================================================

export function getCommonChallengesEmailHtml(data: OnboardingEmailData): string {
  const { firstName, appUrl = APP_URL } = data

  const content = `
<tr>
  <td class="email-header">
    <a href="${appUrl}"><img src="${LOGO_URL}" alt="Rōmy" class="logo" style="max-width:180px;height:auto;" /></a>
  </td>
</tr>
<tr>
  <td class="email-body">
    <h1>We've All Been There, ${firstName}</h1>

    <p>Before Rōmy, our team worked with dozens of small nonprofits. We heard the same challenges over and over:</p>

    <h2>Challenge #1: "I don't have time for research"</h2>
    <p><strong>Solution:</strong> Rōmy does the research in seconds, not hours. What used to take a development officer 2-3 hours per prospect now takes 30 seconds.</p>

    <h2>Challenge #2: "Professional research tools are too expensive"</h2>
    <p><strong>Solution:</strong> Enterprise platforms like iWave or DonorSearch cost $10,000-$50,000/year. Rōmy delivers the same quality research at a fraction of the cost.</p>

    <h2>Challenge #3: "I don't know where to start with a prospect"</h2>
    <p><strong>Solution:</strong> Every Rōmy report includes a "Cultivation Strategy" section with specific, actionable next steps tailored to that prospect's profile and interests.</p>

    <h2>Challenge #4: "My board wants me to find major donors, but I don't have leads"</h2>
    <p><strong>Solution:</strong> Use Batch Research on your event attendees, newsletter subscribers, or existing donor list. Rōmy will identify hidden capacity you didn't know existed.</p>

    <div class="tip-box">
      <h3>Quick Win</h3>
      <p>Take your last event's attendee list and run it through Batch Research. You'll likely find 2-3 major gift prospects you didn't know about.</p>
    </div>

    <div style="text-align:center;">
      <a href="${appUrl}/batch" class="btn-primary">Try Batch Research</a>
    </div>

    <div class="signature">
      <p>With Warm Regards,</p>
      <p><strong>Howard Freeman</strong></p>
      <p>Founder & CEO, Rōmy</p>
    </div>
  </td>
</tr>
<tr>
  <td class="email-footer">
    <p class="footer-text">Rōmy helps small nonprofits find new major donors at a fraction of the cost of existing solutions.</p>
  </td>
</tr>`

  return getEmailWrapper(content, "Common Challenges")
}

export function getCommonChallengesEmailSubject(): string {
  return "The challenges every nonprofit faces (and how to solve them)"
}

// ============================================================================
// EMAIL 4: MOVING FORWARD (Day 6-7)
// ============================================================================

export function getMovingForwardEmailHtml(data: OnboardingEmailData): string {
  const { firstName, appUrl = APP_URL } = data

  const content = `
<tr>
  <td class="email-header">
    <a href="${appUrl}"><img src="${LOGO_URL}" alt="Rōmy" class="logo" style="max-width:180px;height:auto;" /></a>
  </td>
</tr>
<tr>
  <td class="email-body">
    <h1>What's Next, ${firstName}?</h1>

    <p>You've been with us for almost a week now. Here's how to take your prospect research to the next level:</p>

    <h2>Build a Research Routine</h2>
    <p>The most successful development teams research prospects before every meeting, call, or event. With Rōmy, this takes seconds - not hours.</p>

    <h2>Create a Prospect Portfolio</h2>
    <p>Use Rōmy's project folders to organize your research by campaign, event, or portfolio. Keep your top 25 prospects organized and easily accessible.</p>

    <h2>Share with Your Team</h2>
    <p>Export PDF reports to share with your executive director, board members, or development committee. Professional reports build confidence in your major gift strategy.</p>

    <h2>Upgrade When You're Ready</h2>
    <p>Our Growth plan is perfect for getting started. When you're ready for more research capacity, our Pro and Scale plans unlock higher limits and priority processing.</p>

    <div class="tip-box">
      <h3>We're Here to Help</h3>
      <p>Have questions? Want to learn how other nonprofits are using Rōmy? Just reply to this email. Our team reads and responds to every message.</p>
    </div>

    <div style="text-align:center;">
      <a href="${appUrl}" class="btn-primary">Continue Researching</a>
    </div>

    <p style="text-align:center;margin-top:30px;font-size:14px;">
      <a href="${appUrl}/settings/subscription" style="color:#00A5E4;">View subscription options</a>
    </p>

    <div class="signature">
      <p>With Warm Regards,</p>
      <p><strong>Howard Freeman</strong></p>
      <p>Founder & CEO, Rōmy</p>
    </div>
  </td>
</tr>
<tr>
  <td class="email-footer">
    <p class="footer-text">Rōmy helps small nonprofits find new major donors at a fraction of the cost of existing solutions.</p>
    <p class="footer-text" style="margin-top:15px;">This is the last email in our welcome series. You'll only hear from us about important updates and features.</p>
  </td>
</tr>`

  return getEmailWrapper(content, "Moving Forward")
}

export function getMovingForwardEmailSubject(): string {
  return "What's next for your prospect research?"
}
