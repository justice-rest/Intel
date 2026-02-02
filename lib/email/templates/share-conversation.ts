/**
 * Share Conversation Email Template
 * Sent when a user shares a public conversation link via email
 * Brand-consistent email design with refined aesthetic
 */

export interface ShareConversationEmailData {
  senderName: string
  recipientName?: string
  personalNote?: string
  conversationLink: string
  appUrl?: string
}

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

export function getShareConversationEmailHtml(
  data: ShareConversationEmailData
): string {
  const {
    senderName,
    recipientName,
    personalNote,
    conversationLink,
    appUrl = "https://intel.getromy.app",
  } = data

  const greeting = recipientName ? `Hi ${recipientName},` : "Hi there,"

  const noteSection = personalNote
    ? `
<div style="mso-line-height-rule:exactly;mso-line-height-alt:24px;line-height:24px;font-size:1px;display:block;">&nbsp;</div>

<!-- Personal Note -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 24px;background-color:#F4F4F5;border-radius:12px;border-left:3px solid #00A5E4;">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:400;font-style:italic;font-size:15px;color:#3F3F46;text-align:left;">"${personalNote}"</p>
</td></tr>
</table>`
    : ""

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
<title>Shared Conversation</title>
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
<div style="background-color:#F4F4F5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center">
<tr><td style="font-size:0;line-height:0;background-color:#F4F4F5;" valign="top" align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" id="innerTable">
<tr><td><div style="mso-line-height-rule:exactly;mso-line-height-alt:50px;line-height:50px;font-size:1px;display:block;">&nbsp;</div></td></tr>
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td width="440" style="width:440px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
<tr><td style="overflow:hidden;background-color:#FFFFFF;padding:48px 40px 40px 40px;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

<!-- Logo -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<a href="${appUrl}" style="font-size:0px;" target="_blank">
<img style="display:block;border:0;height:auto;width:160px;max-width:100%;" width="160" alt="Rōmy" src="https://the-romy.vercel.app/BrandmarkRōmy.png"/>
</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:36px;line-height:36px;font-size:1px;display:block;">&nbsp;</div>

<!-- Greeting -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:400;font-size:15px;color:#52525B;text-align:left;">${greeting}</p>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:12px;line-height:12px;font-size:1px;display:block;">&nbsp;</div>

<!-- Body -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:400;font-size:15px;color:#52525B;text-align:left;">
<strong style="color:#18181B;font-weight:600;">${senderName}</strong> shared a conversation with you on Rōmy.
</p>
</td></tr>
</table>
${noteSection}

<div style="mso-line-height-rule:exactly;mso-line-height-alt:28px;line-height:28px;font-size:1px;display:block;">&nbsp;</div>

<!-- CTA Button -->
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
<tr><td style="overflow:hidden;background-color:#00A5E4;text-align:center;line-height:48px;border-radius:10px;">
<a href="${conversationLink}" style="display:inline-block;padding:0 32px;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:48px;font-weight:600;font-size:15px;color:#FFFFFF;text-align:center;" target="_blank">View Conversation</a>
</td></tr>
</table>

<div style="mso-line-height-rule:exactly;mso-line-height-alt:32px;line-height:32px;font-size:1px;display:block;">&nbsp;</div>

<!-- Footer note -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:20px;font-weight:400;font-size:13px;color:#A1A1AA;text-align:center;">
You're receiving this because ${senderName} wanted to share<br/>this conversation with you. If you don't recognize this sender,<br/>please ignore this email.
</p>
</td></tr>
</table>

</td></tr>
</table>
</td></tr>
</table>
</td></tr>

<!-- Brand Footer -->
<tr><td><div style="mso-line-height-rule:exactly;mso-line-height-alt:32px;line-height:32px;font-size:1px;display:block;">&nbsp;</div></td></tr>
<tr><td align="center">
<p style="margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:18px;font-weight:400;font-size:12px;color:#A1A1AA;text-align:center;">
Rōmy · Donor Intelligence for Nonprofits
</p>
</td></tr>
<tr><td><div style="mso-line-height-rule:exactly;mso-line-height-alt:40px;line-height:40px;font-size:1px;display:block;">&nbsp;</div></td></tr>

</table>
</td></tr>
</table>
</div>
</body>
</html>`
}

export function getShareConversationEmailSubject(senderName: string): string {
  return `${senderName} shared a conversation with you`
}
