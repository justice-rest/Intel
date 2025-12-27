/**
 * GDPR Email Templates
 * Data Export and Account Deletion Emails
 * Brand-consistent email design matching existing templates
 */

export interface DataExportEmailData {
  userName?: string
  exportDate: string
  sectionsExported: string[]
  appUrl?: string
}

export interface AccountDeletionEmailData {
  userName?: string
  deletionDate: string
  appUrl?: string
}

/**
 * Data Export Confirmation Email
 * Sent when a user exports their data
 */
export function getDataExportEmailHtml(data: DataExportEmailData): string {
  const {
    userName = "there",
    exportDate,
    sectionsExported,
    appUrl = "https://intel.getromy.app",
  } = data

  const sectionsText = sectionsExported.length > 0
    ? sectionsExported.join(", ")
    : "all data"

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
<title>Your Data Export</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" content="" />
<meta content="target-densitydpi=device-dpi" name="viewport" />
<meta content="true" name="HandheldFriendly" />
<meta content="width=device-width" name="viewport" />
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
<style type="text/css">
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
</style>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&amp;family=Albert+Sans:wght@500&amp;display=swap" rel="stylesheet" type="text/css" />
</head>
<body id="body" style="min-width:100%;Margin:0px;padding:0px;background-color:#F9F9F9;">
<div style="background-color:#F9F9F9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center">
<tr><td style="font-size:0;line-height:0;background-color:#F9F9F9;" valign="top" align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" id="innerTable">
<tr><td><div style="mso-line-height-rule:exactly;mso-line-height-alt:70px;line-height:70px;font-size:1px;display:block;">&nbsp;</div></td></tr>
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td width="400" style="width:400px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
<tr><td style="border:1px solid #CECECE;overflow:hidden;background-color:#FFFFFF;padding:50px 40px 40px 40px;border-radius:20px;">

<!-- Logo -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<a href="${appUrl}" style="font-size:0px;" target="_blank">
<img style="display:block;border:0;height:auto;width:200px;max-width:100%;" width="200" alt="Rōmy" src="https://the-romy.vercel.app/BrandmarkRōmy.png"/>
</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:40px;line-height:40px;font-size:1px;display:block;">&nbsp;</div>

<!-- Heading -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<h1 style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:28px;font-weight:600;font-size:24px;letter-spacing:-1.2px;color:#111111;text-align:center;">Your Data Export is Ready</h1>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:20px;line-height:20px;font-size:1px;display:block;">&nbsp;</div>

<!-- Body -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:500;font-size:15px;letter-spacing:-0.4px;color:#424040;text-align:center;">
Hey ${userName}! Your data export has been completed. The download should have started automatically in your browser.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:25px;line-height:25px;font-size:1px;display:block;">&nbsp;</div>

<!-- Info Box -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px;background-color:#E8F4FD;border-radius:12px;">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-size:14px;color:#424040;text-align:center;">
<strong>Exported on:</strong> ${exportDate}<br/>
<strong>Included:</strong> ${sectionsText}
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:25px;line-height:25px;font-size:1px;display:block;">&nbsp;</div>

<!-- Message -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-size:14px;letter-spacing:-0.4px;color:#666666;text-align:center;">
Your data is yours. We're committed to transparency and giving you full control over your information. If you have any questions, just reply to this email.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:30px;line-height:30px;font-size:1px;display:block;">&nbsp;</div>

<!-- CTA Button -->
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td style="overflow:hidden;background-color:#00A5E4;text-align:center;line-height:44px;border-radius:8px;">
<a href="${appUrl}" style="display:inline-block;padding:0 24px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:44px;font-weight:600;font-size:15px;color:#FFFFFF;text-align:center;" target="_blank">Back to Rōmy</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:40px;line-height:40px;font-size:1px;display:block;">&nbsp;</div>

<!-- Footer -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="overflow:hidden;background-color:#F2EFF3;padding:20px 30px;border-radius:8px;">
<p style="margin:0;font-family:Albert Sans,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:18px;font-weight:500;font-size:12px;color:#84828E;text-align:center;">
Rōmy helps small nonprofits find new major donors at a fraction of the cost of existing solutions. It is effective, fun & affordable.
</p>
</td></tr>
</table>

</td></tr>
</table>
</td></tr>
</table>
</td></tr>
<tr><td><div style="mso-line-height-rule:exactly;mso-line-height-alt:70px;line-height:70px;font-size:1px;display:block;">&nbsp;</div></td></tr>
</table>
</td></tr>
</table>
</div>
</body>
</html>`
}

export function getDataExportEmailSubject(): string {
  return "Your Rōmy Data Export is Ready"
}

/**
 * Account Deletion Farewell Email
 * Sent when a user deletes their account
 */
export function getAccountDeletionEmailHtml(data: AccountDeletionEmailData): string {
  const {
    userName = "there",
    deletionDate,
    appUrl = "https://intel.getromy.app",
  } = data

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
<title>Goodbye from Rōmy</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" content="" />
<meta content="target-densitydpi=device-dpi" name="viewport" />
<meta content="true" name="HandheldFriendly" />
<meta content="width=device-width" name="viewport" />
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
<style type="text/css">
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
</style>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&amp;family=Albert+Sans:wght@500&amp;display=swap" rel="stylesheet" type="text/css" />
</head>
<body id="body" style="min-width:100%;Margin:0px;padding:0px;background-color:#F9F9F9;">
<div style="background-color:#F9F9F9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center">
<tr><td style="font-size:0;line-height:0;background-color:#F9F9F9;" valign="top" align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" id="innerTable">
<tr><td><div style="mso-line-height-rule:exactly;mso-line-height-alt:70px;line-height:70px;font-size:1px;display:block;">&nbsp;</div></td></tr>
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td width="400" style="width:400px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
<tr><td style="border:1px solid #CECECE;overflow:hidden;background-color:#FFFFFF;padding:50px 40px 40px 40px;border-radius:20px;">

<!-- Logo -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<a href="${appUrl}" style="font-size:0px;" target="_blank">
<img style="display:block;border:0;height:auto;width:200px;max-width:100%;" width="200" alt="Rōmy" src="https://the-romy.vercel.app/BrandmarkRōmy.png"/>
</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:40px;line-height:40px;font-size:1px;display:block;">&nbsp;</div>

<!-- Heading -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<h1 style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:28px;font-weight:600;font-size:24px;letter-spacing:-1.2px;color:#111111;text-align:center;">We'll Miss You, ${userName} 💙</h1>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:20px;line-height:20px;font-size:1px;display:block;">&nbsp;</div>

<!-- Body -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:500;font-size:15px;letter-spacing:-0.4px;color:#424040;text-align:center;">
Your Rōmy account has been deleted. All your data has been completely removed from our systems, just as you requested.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:25px;line-height:25px;font-size:1px;display:block;">&nbsp;</div>

<!-- Farewell Message -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:25px;background-color:#FEF3E5;border-radius:12px;border-left:4px solid #FF9500;">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:26px;font-weight:500;font-size:15px;color:#424040;text-align:left;">
It was a genuine pleasure having you with us. Every moment you spent using Rōmy meant the world to our small team. Thank you for trusting us on your journey to find major donors and make a bigger impact.
</p>
<div style="height:18px;"></div>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:26px;font-weight:500;font-size:15px;color:#424040;text-align:left;">
Whatever path brought you to this decision, we respect it completely. Just know that if you ever decide to come back, we'll be here with open arms, ready to help you change the world again.
</p>
<div style="height:18px;"></div>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:26px;font-weight:500;font-size:15px;color:#424040;text-align:left;">
Until then, keep doing amazing things. The nonprofit world is better because of people like you.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:25px;line-height:25px;font-size:1px;display:block;">&nbsp;</div>

<!-- Deletion Info -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:20px;font-weight:500;font-size:13px;letter-spacing:-0.3px;color:#84828E;text-align:center;">
Account deleted on ${deletionDate}
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:30px;line-height:30px;font-size:1px;display:block;">&nbsp;</div>

<!-- Note -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-size:14px;letter-spacing:-0.4px;color:#666666;text-align:center;">
This is the last email you'll receive from us. Changed your mind? You can always create a new account at <a href="${appUrl}" style="color:#00A5E4;font-weight:600;" target="_blank">getromy.app</a>.
</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:40px;line-height:40px;font-size:1px;display:block;">&nbsp;</div>

<!-- Footer -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="overflow:hidden;background-color:#F2EFF3;padding:20px 30px;border-radius:8px;">
<p style="margin:0;font-family:Albert Sans,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:18px;font-weight:500;font-size:12px;color:#84828E;text-align:center;">
With gratitude,<br/>The Rōmy Team
</p>
</td></tr>
</table>

</td></tr>
</table>
</td></tr>
</table>
</td></tr>
<tr><td><div style="mso-line-height-rule:exactly;mso-line-height-alt:70px;line-height:70px;font-size:1px;display:block;">&nbsp;</div></td></tr>
</table>
</td></tr>
</table>
</div>
</body>
</html>`
}

export function getAccountDeletionEmailSubject(): string {
  return "Goodbye from Rōmy - Account Deleted"
}
