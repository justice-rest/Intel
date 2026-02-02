/**
 * Onboarding Email Templates
 * 4-email sequence for new user onboarding
 *
 * Email 1: Welcome (immediate)
 * Email 2: How It Works (day 2)
 * Email 3: Common Challenges (day 4)
 * Email 4: Moving Forward (day 6)
 */

export interface OnboardingEmailData {
  firstName: string
  email: string
  appUrl?: string
}

const APP_URL = "https://intel.getromy.app"
const LOGO_URL = "https://the-romy.vercel.app/BrandmarkRōmy.png"

// Shared email styles for consistency
const emailStyles = `
table { border-collapse: separate; table-layout: fixed; mso-table-lspace: 0pt; mso-table-rspace: 0pt }
table td { border-collapse: collapse }
.ExternalClass { width: 100% }
.ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100% }
body, a, li, p, h1, h2, h3 { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
html { -webkit-text-size-adjust: none !important }
body { min-width: 100%; Margin: 0px; padding: 0px; }
body, #innerTable { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale }
#innerTable img+div { display: none; display: none !important }
img { Margin: 0; padding: 0; -ms-interpolation-mode: bicubic }
h1, h2, h3, p, a { line-height: inherit; overflow-wrap: normal; white-space: normal; word-break: break-word }
a { text-decoration: none }
h1, h2, h3, p { min-width: 100%!important; width: 100%!important; max-width: 100%!important; display: inline-block!important; border: 0; padding: 0; margin: 0 }
`

// Common email wrapper
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
<style type="text/css">${emailStyles}</style>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet" type="text/css" />
</head>
<body id="body" style="min-width:100%;Margin:0px;padding:0px;background-color:#F4F4F5;">
<div style="background-color:#F4F4F5;padding:50px 20px;">
${content}
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
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td width="520" style="width:520px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
<tr><td style="overflow:hidden;background-color:#FFFFFF;padding:48px 40px 40px 40px;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

<!-- Logo -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<a href="${appUrl}" style="font-size:0px;" target="_blank">
<img style="display:block;border:0;height:auto;width:160px;max-width:100%;" width="160" alt="Rōmy" src="${LOGO_URL}"/>
</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:36px;line-height:36px;font-size:1px;display:block;">&nbsp;</div>

<!-- Heading -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<h1 style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:32px;font-weight:600;font-size:24px;letter-spacing:-0.5px;color:#18181B;text-align:center;">Welcome to Rōmy, ${firstName}!</h1>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:20px;line-height:20px;font-size:1px;display:block;">&nbsp;</div>

<!-- Intro -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<p style="margin:0 0 16px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:26px;font-weight:400;font-size:15px;color:#52525B;">
Thank you for joining us. You've just taken the first step toward transforming how your nonprofit finds and cultivates major donors.
</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:26px;font-weight:400;font-size:15px;color:#52525B;">
Rōmy is designed specifically for small nonprofits like yours who deserve access to the same powerful prospect research tools that large organizations use - without the enterprise price tag.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- What You Can Do -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<h2 style="margin:0 0 16px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:600;font-size:16px;color:#18181B;">What You Can Do Right Now</h2>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:12px 0;border-bottom:1px solid #E4E4E7;">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:15px;line-height:24px;color:#52525B;">
<strong style="color:#18181B;">Quick Research</strong> — Ask Rōmy about any potential donor and get instant insights on their giving capacity, philanthropic interests, and connection points.
</p>
</td></tr>
<tr><td style="padding:12px 0;border-bottom:1px solid #E4E4E7;">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:15px;line-height:24px;color:#52525B;">
<strong style="color:#18181B;">Batch Research</strong> — Upload a list of prospects and let Rōmy research them all at once - perfect for event follow-up or database screening.
</p>
</td></tr>
<tr><td style="padding:12px 0;">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:15px;line-height:24px;color:#52525B;">
<strong style="color:#18181B;">Export Reports</strong> — Generate professional PDF reports to share with your board or development committee.
</p>
</td></tr>
</table>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- CTA Button -->
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td style="overflow:hidden;background-color:#00A5E4;text-align:center;line-height:48px;border-radius:10px;">
<a href="${appUrl}" style="display:inline-block;padding:0 32px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:48px;font-weight:600;font-size:15px;color:#FFFFFF;text-align:center;" target="_blank">Start Researching</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- Tip Box -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 24px;background-color:#F4F4F5;border-radius:12px;border-left:3px solid #00A5E4;">
<p style="margin:0 0 8px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:13px;font-weight:600;color:#18181B;text-transform:uppercase;letter-spacing:0.5px;">Quick Tip</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">
Try your first search by typing something like: "Research John Smith, 123 Main Street, Seattle, WA - what's his giving capacity?"
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:32px;line-height:32px;font-size:1px;display:block;">&nbsp;</div>

<!-- Signature -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding-top:24px;border-top:1px solid #E4E4E7;">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">With Warm Regards,</p>
<p style="margin:8px 0 0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#18181B;font-weight:600;">Howard Freeman</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:13px;line-height:20px;color:#71717A;">Founder & CEO, Rōmy</p>
</td></tr>
</table>

</td></tr>
</table>
</td></tr>
</table>

<!-- Footer -->
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;margin-top:32px;">
<tr><td width="520" style="width:520px;" align="center">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:18px;font-weight:400;font-size:12px;color:#A1A1AA;text-align:center;">
Rōmy helps small nonprofits find new major donors at a fraction of the cost of existing solutions.
</p>
<p style="margin:12px 0 0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:18px;font-weight:400;font-size:12px;color:#A1A1AA;text-align:center;">
Questions? Reply to this email - we read every message.
</p>
</td></tr>
</table>`

  return getEmailWrapper(content, "Welcome to Rōmy!")
}

export function getWelcomeEmailSubject(firstName: string): string {
  return `Welcome to Rōmy, ${firstName}!`
}

// ============================================================================
// EMAIL 2: HOW IT WORKS (Day 2)
// ============================================================================

export function getHowItWorksEmailHtml(data: OnboardingEmailData): string {
  const { firstName, appUrl = APP_URL } = data

  const content = `
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td width="520" style="width:520px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
<tr><td style="overflow:hidden;background-color:#FFFFFF;padding:48px 40px 40px 40px;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

<!-- Logo -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<a href="${appUrl}" style="font-size:0px;" target="_blank">
<img style="display:block;border:0;height:auto;width:160px;max-width:100%;" width="160" alt="Rōmy" src="${LOGO_URL}"/>
</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:36px;line-height:36px;font-size:1px;display:block;">&nbsp;</div>

<!-- Heading -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<h1 style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:32px;font-weight:600;font-size:24px;letter-spacing:-0.5px;color:#18181B;text-align:center;">How Rōmy Works</h1>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:20px;line-height:20px;font-size:1px;display:block;">&nbsp;</div>

<!-- Intro -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:26px;font-weight:400;font-size:15px;color:#52525B;">
Now that you've had a chance to explore, ${firstName}, let me share how other nonprofits are getting the most out of Rōmy.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- The 3 Research Modes -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<h2 style="margin:0 0 20px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:600;font-size:16px;color:#18181B;">The 3 Research Modes</h2>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:16px;background-color:#F4F4F5;border-radius:10px;margin-bottom:12px;">
<p style="margin:0 0 6px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;font-weight:600;color:#18181B;">1. Quick Research (Chat)</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">Just ask a question in natural language. Rōmy searches public records, FEC filings, SEC data, property records, and more.</p>
</td></tr>
</table>

<div style="height:12px;"></div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:16px;background-color:#F4F4F5;border-radius:10px;">
<p style="margin:0 0 6px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;font-weight:600;color:#18181B;">2. Deep Research</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">Toggle on "Deep Research" for comprehensive reports with spouse info, business valuations, and detailed capacity analysis.</p>
</td></tr>
</table>

<div style="height:12px;"></div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:16px;background-color:#F4F4F5;border-radius:10px;">
<p style="margin:0 0 6px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;font-weight:600;color:#18181B;">3. Batch Research</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">Upload a CSV with your prospect list. Rōmy will research each person and deliver exportable reports.</p>
</td></tr>
</table>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- What Rōmy Searches -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<h2 style="margin:0 0 16px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:600;font-size:16px;color:#18181B;">What Rōmy Searches</h2>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:8px 0;"><p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;"><strong style="color:#18181B;">Property Records</strong> — Home values, additional properties, ownership</p></td></tr>
<tr><td style="padding:8px 0;"><p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;"><strong style="color:#18181B;">Business Affiliations</strong> — LLC ownership, executive roles, board positions</p></td></tr>
<tr><td style="padding:8px 0;"><p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;"><strong style="color:#18181B;">SEC Filings</strong> — Stock holdings, insider transactions</p></td></tr>
<tr><td style="padding:8px 0;"><p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;"><strong style="color:#18181B;">FEC Data</strong> — Political contributions and patterns</p></td></tr>
<tr><td style="padding:8px 0;"><p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;"><strong style="color:#18181B;">Nonprofit 990s</strong> — Foundation connections, giving history</p></td></tr>
</table>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- Tip Box -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 24px;background-color:#F4F4F5;border-radius:12px;border-left:3px solid #00A5E4;">
<p style="margin:0 0 8px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:13px;font-weight:600;color:#18181B;text-transform:uppercase;letter-spacing:0.5px;">Pro Tip</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">
The more specific your query, the better. Include full name, city/state, and any known affiliations for the most accurate results.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- CTA Button -->
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td style="overflow:hidden;background-color:#00A5E4;text-align:center;line-height:48px;border-radius:10px;">
<a href="${appUrl}" style="display:inline-block;padding:0 32px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:48px;font-weight:600;font-size:15px;color:#FFFFFF;text-align:center;" target="_blank">Try Deep Research</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:32px;line-height:32px;font-size:1px;display:block;">&nbsp;</div>

<!-- Signature -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding-top:24px;border-top:1px solid #E4E4E7;">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">With Warm Regards,</p>
<p style="margin:8px 0 0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#18181B;font-weight:600;">Howard Freeman</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:13px;line-height:20px;color:#71717A;">Founder & CEO, Rōmy</p>
</td></tr>
</table>

</td></tr>
</table>
</td></tr>
</table>

<!-- Footer -->
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;margin-top:32px;">
<tr><td width="520" style="width:520px;" align="center">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:18px;font-weight:400;font-size:12px;color:#A1A1AA;text-align:center;">
Rōmy · Donor Intelligence for Nonprofits
</p>
</td></tr>
</table>`

  return getEmailWrapper(content, "How Rōmy Works")
}

export function getHowItWorksEmailSubject(): string {
  return "How to get the most out of Rōmy"
}

// ============================================================================
// EMAIL 3: COMMON CHALLENGES (Day 4)
// ============================================================================

export function getCommonChallengesEmailHtml(data: OnboardingEmailData): string {
  const { firstName, appUrl = APP_URL } = data

  const content = `
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td width="520" style="width:520px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
<tr><td style="overflow:hidden;background-color:#FFFFFF;padding:48px 40px 40px 40px;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

<!-- Logo -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<a href="${appUrl}" style="font-size:0px;" target="_blank">
<img style="display:block;border:0;height:auto;width:160px;max-width:100%;" width="160" alt="Rōmy" src="${LOGO_URL}"/>
</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:36px;line-height:36px;font-size:1px;display:block;">&nbsp;</div>

<!-- Heading -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<h1 style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:32px;font-weight:600;font-size:24px;letter-spacing:-0.5px;color:#18181B;text-align:center;">We've All Been There</h1>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:20px;line-height:20px;font-size:1px;display:block;">&nbsp;</div>

<!-- Intro -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:26px;font-weight:400;font-size:15px;color:#52525B;">
Before Rōmy, our team worked with dozens of small nonprofits, ${firstName}. We heard the same challenges over and over:
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- Challenge Cards -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px;background-color:#F4F4F5;border-radius:10px;margin-bottom:16px;">
<p style="margin:0 0 8px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;font-weight:600;color:#18181B;">"I don't have time for research"</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">
<strong style="color:#00A5E4;">Solution:</strong> Rōmy does it in seconds. What used to take 2-3 hours per prospect now takes 30 seconds.
</p>
</td></tr>
</table>

<div style="height:12px;"></div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px;background-color:#F4F4F5;border-radius:10px;">
<p style="margin:0 0 8px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;font-weight:600;color:#18181B;">"Professional tools are too expensive"</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">
<strong style="color:#00A5E4;">Solution:</strong> Enterprise platforms cost $10,000-$50,000/year. Rōmy delivers the same quality at a fraction of the cost.
</p>
</td></tr>
</table>

<div style="height:12px;"></div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px;background-color:#F4F4F5;border-radius:10px;">
<p style="margin:0 0 8px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;font-weight:600;color:#18181B;">"I don't know where to start"</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">
<strong style="color:#00A5E4;">Solution:</strong> Every report includes a "Cultivation Strategy" with specific next steps tailored to that prospect.
</p>
</td></tr>
</table>

<div style="height:12px;"></div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px;background-color:#F4F4F5;border-radius:10px;">
<p style="margin:0 0 8px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;font-weight:600;color:#18181B;">"My board wants major donors, but I don't have leads"</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">
<strong style="color:#00A5E4;">Solution:</strong> Run Batch Research on your event attendees or donor list. You'll find hidden capacity you didn't know existed.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- Tip Box -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 24px;background-color:#F4F4F5;border-radius:12px;border-left:3px solid #00A5E4;">
<p style="margin:0 0 8px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:13px;font-weight:600;color:#18181B;text-transform:uppercase;letter-spacing:0.5px;">Quick Win</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">
Take your last event's attendee list and run it through Batch Research. You'll likely find 2-3 major gift prospects you didn't know about.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- CTA Button -->
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td style="overflow:hidden;background-color:#00A5E4;text-align:center;line-height:48px;border-radius:10px;">
<a href="${appUrl}/labs" style="display:inline-block;padding:0 32px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:48px;font-weight:600;font-size:15px;color:#FFFFFF;text-align:center;" target="_blank">Try Batch Research</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:32px;line-height:32px;font-size:1px;display:block;">&nbsp;</div>

<!-- Signature -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding-top:24px;border-top:1px solid #E4E4E7;">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">With Warm Regards,</p>
<p style="margin:8px 0 0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#18181B;font-weight:600;">Howard Freeman</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:13px;line-height:20px;color:#71717A;">Founder & CEO, Rōmy</p>
</td></tr>
</table>

</td></tr>
</table>
</td></tr>
</table>

<!-- Footer -->
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;margin-top:32px;">
<tr><td width="520" style="width:520px;" align="center">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:18px;font-weight:400;font-size:12px;color:#A1A1AA;text-align:center;">
Rōmy · Donor Intelligence for Nonprofits
</p>
</td></tr>
</table>`

  return getEmailWrapper(content, "Common Challenges")
}

export function getCommonChallengesEmailSubject(): string {
  return "The challenges every nonprofit faces (and how to solve them)"
}

// ============================================================================
// EMAIL 4: MOVING FORWARD (Day 6)
// ============================================================================

export function getMovingForwardEmailHtml(data: OnboardingEmailData): string {
  const { firstName, appUrl = APP_URL } = data

  const content = `
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td width="520" style="width:520px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
<tr><td style="overflow:hidden;background-color:#FFFFFF;padding:48px 40px 40px 40px;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

<!-- Logo -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<a href="${appUrl}" style="font-size:0px;" target="_blank">
<img style="display:block;border:0;height:auto;width:160px;max-width:100%;" width="160" alt="Rōmy" src="${LOGO_URL}"/>
</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:36px;line-height:36px;font-size:1px;display:block;">&nbsp;</div>

<!-- Heading -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<h1 style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:32px;font-weight:600;font-size:24px;letter-spacing:-0.5px;color:#18181B;text-align:center;">What's Next, ${firstName}?</h1>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:20px;line-height:20px;font-size:1px;display:block;">&nbsp;</div>

<!-- Intro -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:26px;font-weight:400;font-size:15px;color:#52525B;">
You've been with us for almost a week now. Here's how to take your prospect research to the next level:
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- Tips -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<h2 style="margin:0 0 12px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:600;font-size:16px;color:#18181B;">Build a Research Routine</h2>
<p style="margin:0 0 24px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:15px;line-height:24px;color:#52525B;">
The most successful development teams research prospects before every meeting, call, or event. With Rōmy, this takes seconds - not hours.
</p>

<h2 style="margin:0 0 12px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:600;font-size:16px;color:#18181B;">Create a Prospect Portfolio</h2>
<p style="margin:0 0 24px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:15px;line-height:24px;color:#52525B;">
Use Rōmy's project folders to organize your research by campaign, event, or portfolio. Keep your top 25 prospects organized and easily accessible.
</p>

<h2 style="margin:0 0 12px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:600;font-size:16px;color:#18181B;">Share with Your Team</h2>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:15px;line-height:24px;color:#52525B;">
Export PDF reports to share with your executive director, board members, or development committee. Professional reports build confidence in your major gift strategy.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- Help Box -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 24px;background-color:#F4F4F5;border-radius:12px;border-left:3px solid #00A5E4;">
<p style="margin:0 0 8px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:13px;font-weight:600;color:#18181B;text-transform:uppercase;letter-spacing:0.5px;">We're Here to Help</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">
Have questions? Want to learn how other nonprofits are using Rōmy? Just reply to this email. Our team reads and responds to every message.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- CTA Button -->
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td style="overflow:hidden;background-color:#00A5E4;text-align:center;line-height:48px;border-radius:10px;">
<a href="${appUrl}" style="display:inline-block;padding:0 32px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:48px;font-weight:600;font-size:15px;color:#FFFFFF;text-align:center;" target="_blank">Continue Researching</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:32px;line-height:32px;font-size:1px;display:block;">&nbsp;</div>

<!-- Signature -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding-top:24px;border-top:1px solid #E4E4E7;">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#52525B;">With Warm Regards,</p>
<p style="margin:8px 0 0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:22px;color:#18181B;font-weight:600;">Howard Freeman</p>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:13px;line-height:20px;color:#71717A;">Founder & CEO, Rōmy</p>
</td></tr>
</table>

</td></tr>
</table>
</td></tr>
</table>

<!-- Footer -->
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;margin-top:32px;">
<tr><td width="520" style="width:520px;" align="center">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:18px;font-weight:400;font-size:12px;color:#A1A1AA;text-align:center;">
Rōmy · Donor Intelligence for Nonprofits
</p>
<p style="margin:12px 0 0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:18px;font-weight:400;font-size:12px;color:#A1A1AA;text-align:center;">
This is the last email in our welcome series. You'll only hear from us about important updates.
</p>
</td></tr>
</table>`

  return getEmailWrapper(content, "Moving Forward")
}

export function getMovingForwardEmailSubject(): string {
  return "What's next for your prospect research?"
}
