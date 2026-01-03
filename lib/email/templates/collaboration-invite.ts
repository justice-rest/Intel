/**
 * Collaboration Invite Email Template
 * Sent when a chat owner invites someone to collaborate on a conversation
 */

export interface CollaborationInviteEmailData {
  senderName: string
  recipientName?: string
  chatTitle: string
  role: "editor" | "viewer"
  inviteLink: string
  hasPassword: boolean
  personalNote?: string
  appUrl?: string
}

export function getCollaborationInviteEmailHtml(
  data: CollaborationInviteEmailData
): string {
  const {
    senderName,
    recipientName,
    chatTitle,
    role,
    inviteLink,
    hasPassword,
    personalNote,
    appUrl = "https://intel.getromy.app",
  } = data

  const greeting = recipientName ? `Hi ${recipientName},` : "Hi there,"
  const roleDescription = role === "editor"
    ? "collaborate and contribute to"
    : "view"

  const passwordNotice = hasPassword
    ? `<tr><td><div style="mso-line-height-rule:exactly;mso-line-height-alt:12px;line-height:12px;font-size:1px;display:block;">&nbsp;&nbsp;</div></td></tr><tr><td align="center">
<table class="t16" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;"><tr><td width="320" class="t15" style="width:320px;">
<table class="t14" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;"><tr><td class="t13" style="padding:12px 16px;background-color:#FFF3CD;border-radius:6px;border-left:3px solid #FFC107;"><p style="margin:0;Margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:20px;font-weight:500;font-size:13px;color:#856404;text-align:left;"><strong>Note:</strong> This link is password protected. The sender will provide you with the password separately.</p></td></tr></table>
</td></tr></table>
</td></tr>`
    : ""

  const noteSection = personalNote
    ? `
</td></tr><tr><td><div style="mso-line-height-rule:exactly;mso-line-height-alt:20px;line-height:20px;font-size:1px;display:block;">&nbsp;&nbsp;</div></td></tr><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;width:100%;">
<tr>
<td style="padding:16px 20px;background-color:#F2EFF3;border-radius:8px;border-left:3px solid #00A5E4;">
<p style="margin:0;Margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-style:italic;font-size:14px;text-decoration:none;text-transform:none;letter-spacing:-0.3px;direction:ltr;color:#424040;text-align:left;mso-line-height-rule:exactly;">"${personalNote}"</p>
</td>
</tr>
</table>`
    : ""

  // Truncate chat title if too long
  const displayTitle = chatTitle.length > 50
    ? chatTitle.substring(0, 47) + "..."
    : chatTitle

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
<title>Collaboration Invite</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<!--[if !mso]>-->
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<!--<![endif]-->
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
mso-table-rspace: 0pt
}
table td {
border-collapse: collapse
}
.ExternalClass {
width: 100%
}
.ExternalClass,
.ExternalClass p,
.ExternalClass span,
.ExternalClass font,
.ExternalClass td,
.ExternalClass div {
line-height: 100%
}
body, a, li, p, h1, h2, h3 {
-ms-text-size-adjust: 100%;
-webkit-text-size-adjust: 100%;
}
html {
-webkit-text-size-adjust: none !important
}
body {
min-width: 100%;
Margin: 0px;
padding: 0px;
}
body, #innerTable {
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale
}
#innerTable img+div {
display: none;
display: none !important
}
img {
Margin: 0;
padding: 0;
-ms-interpolation-mode: bicubic
}
h1, h2, h3, p, a {
line-height: inherit;
overflow-wrap: normal;
white-space: normal;
word-break: break-word
}
a {
text-decoration: none
}
h1, h2, h3, p {
min-width: 100%!important;
width: 100%!important;
max-width: 100%!important;
display: inline-block!important;
border: 0;
padding: 0;
margin: 0
}
a[x-apple-data-detectors] {
color: inherit !important;
text-decoration: none !important;
font-size: inherit !important;
font-family: inherit !important;
font-weight: inherit !important;
line-height: inherit !important
}
u + #body a {
color: inherit;
text-decoration: none;
font-size: inherit;
font-family: inherit;
font-weight: inherit;
line-height: inherit;
}
a[href^="mailto"],
a[href^="tel"],
a[href^="sms"] {
color: inherit;
text-decoration: none
}
</style>
<style type="text/css">
@media (min-width: 481px) {
.hd { display: none!important }
}
</style>
<style type="text/css">
@media (max-width: 480px) {
.hm { display: none!important }
}
</style>
<style type="text/css">
@media (max-width: 480px) {
.t36,.t41{mso-line-height-alt:0px!important;line-height:0!important;display:none!important}.t37{padding-top:43px!important;border:0!important;border-radius:0!important}.t31{mso-line-height-alt:26px!important;line-height:26px!important}
}
</style>
<!--[if !mso]>-->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&amp;family=Albert+Sans:wght@500&amp;display=swap" rel="stylesheet" type="text/css" />
<!--<![endif]-->
<!--[if mso]>
<xml>
<o:OfficeDocumentSettings>
<o:AllowPNG/>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
<![endif]-->
</head>
<body id="body" class="t44" style="min-width:100%;Margin:0px;padding:0px;background-color:#F9F9F9;"><div class="t43" style="background-color:#F9F9F9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td class="t42" style="font-size:0;line-height:0;mso-line-height-rule:exactly;background-color:#F9F9F9;background-image:none;background-repeat:repeat;background-size:auto;background-position:center top;" valign="top" align="center">
<!--[if mso]>
<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false">
<v:fill color="#F9F9F9"/>
</v:background>
<![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" id="innerTable"><tr><td><div class="t36" style="mso-line-height-rule:exactly;mso-line-height-alt:70px;line-height:70px;font-size:1px;display:block;">&nbsp;&nbsp;</div></td></tr><tr><td align="center">
<table class="t40" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;"><tr><td width="400" class="t39" style="width:400px;">
<table class="t38" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;"><tr><td class="t37" style="border:1px solid #CECECE;overflow:hidden;background-color:#FFFFFF;padding:50px 40px 40px 40px;border-radius:20px 20px 20px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100% !important;"><tr><td align="center">
<table class="t4" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;"><tr><td width="316" class="t3" style="width:316px;">
<table class="t2" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;"><tr><td class="t1"><a href="${appUrl}" style="font-size:0px;" target="_blank"><img class="t0" style="display:block;border:0;height:auto;width:100%;Margin:0;max-width:100%;" width="316" height="95.2051282051282" alt="" src="https://the-romy.vercel.app/BrandmarkRōmy.png"/></a></td></tr></table>
</td></tr></table>
</td></tr><tr><td><div class="t5" style="mso-line-height-rule:exactly;mso-line-height-alt:40px;line-height:40px;font-size:1px;display:block;">&nbsp;&nbsp;</div></td></tr><tr><td align="center">
<table class="t10" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;"><tr><td width="320" class="t9" style="width:320px;">
<table class="t8" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;"><tr><td class="t7"><p class="t6" style="margin:0;Margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:500;font-style:normal;font-size:15px;text-decoration:none;text-transform:none;letter-spacing:-0.3px;direction:ltr;color:#424040;text-align:left;mso-line-height-rule:exactly;">${greeting}</p></td></tr></table>
</td></tr></table>
</td></tr><tr><td><div class="t12" style="mso-line-height-rule:exactly;mso-line-height-alt:12px;line-height:12px;font-size:1px;display:block;">&nbsp;&nbsp;</div></td></tr><tr><td align="center">
<table class="t16" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;"><tr><td width="320" class="t15" style="width:320px;">
<table class="t14" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;"><tr><td class="t13"><p class="t11" style="margin:0;Margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:24px;font-weight:500;font-style:normal;font-size:15px;text-decoration:none;text-transform:none;letter-spacing:-0.3px;direction:ltr;color:#424040;text-align:left;mso-line-height-rule:exactly;"><strong style="font-weight:600;">${senderName}</strong> has invited you to ${roleDescription} a conversation:</p></td></tr></table>
</td></tr></table>
</td></tr><tr><td><div style="mso-line-height-rule:exactly;mso-line-height-alt:12px;line-height:12px;font-size:1px;display:block;">&nbsp;&nbsp;</div></td></tr><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;width:100%;">
<tr>
<td style="padding:12px 16px;background-color:#F0F7FF;border-radius:8px;border-left:3px solid #00A5E4;">
<p style="margin:0;Margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:600;font-size:15px;color:#1a1a1a;text-align:left;">"${displayTitle}"</p>
<p style="margin:4px 0 0 0;Margin:4px 0 0 0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:18px;font-weight:500;font-size:12px;color:#666;text-align:left;">Access level: <span style="text-transform:capitalize;color:#00A5E4;">${role}</span></p>
</td>
</tr>
</table>
${noteSection}
${passwordNotice}
</td></tr><tr><td><div class="t18" style="mso-line-height-rule:exactly;mso-line-height-alt:30px;line-height:30px;font-size:1px;display:block;">&nbsp;&nbsp;</div></td></tr><tr><td align="center">
<table class="t22" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;"><tr><td width="200" class="t21" style="width:200px;">
<table class="t20" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;"><tr><td class="t19" style="overflow:hidden;background-color:#00A5E4;text-align:center;line-height:44px;mso-line-height-rule:exactly;mso-text-raise:9px;border-radius:8px 8px 8px 8px;"><a class="t17" href="${inviteLink}" style="display:block;margin:0;Margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:44px;font-weight:700;font-style:normal;font-size:15px;text-decoration:none;letter-spacing:-0.5px;direction:ltr;color:#FFFFFF;text-align:center;mso-line-height-rule:exactly;mso-text-raise:9px;" target="_blank">Accept Invitation</a></td></tr></table>
</td></tr></table>
</td></tr><tr><td><div class="t25" style="mso-line-height-rule:exactly;mso-line-height-alt:40px;line-height:40px;font-size:1px;display:block;">&nbsp;&nbsp;</div></td></tr><tr><td align="center">
<table class="t29" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;"><tr><td width="318" class="t28" style="width:318px;">
<table class="t27" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;"><tr><td class="t26"><p class="t24" style="margin:0;Margin:0;font-family:Inter,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-style:normal;font-size:14px;text-decoration:none;text-transform:none;letter-spacing:-0.6px;direction:ltr;color:#424040;text-align:center;mso-line-height-rule:exactly;mso-text-raise:2px;">You&#39;re receiving this email because ${senderName} invited you to collaborate. If you don&#39;t recognize this sender, please ignore this email.</p></td></tr></table>
</td></tr></table>
</td></tr><tr><td><div class="t31" style="mso-line-height-rule:exactly;mso-line-height-alt:30px;line-height:30px;font-size:1px;display:block;">&nbsp;&nbsp;</div></td></tr><tr><td align="center">
<table class="t35" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;"><tr><td width="318" class="t34" style="width:420px;">
<table class="t33" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;"><tr><td class="t32" style="overflow:hidden;background-color:#F2EFF3;padding:20px 30px 20px 30px;border-radius:8px 8px 8px 8px;"><p class="t30" style="margin:0;Margin:0;font-family:Albert Sans,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:18px;font-weight:500;font-style:normal;font-size:12px;text-decoration:none;text-transform:none;direction:ltr;color:#84828E;text-align:center;mso-line-height-rule:exactly;mso-text-raise:2px;">Romy helps small nonprofits find new major donors at a fraction of the cost of existing solutions. It is effective, fun &amp; affordable</p></td></tr></table>
</td></tr></table>
</td></tr></table></td></tr></table>
</td></tr></table>
</td></tr><tr><td><div class="t41" style="mso-line-height-rule:exactly;mso-line-height-alt:70px;line-height:70px;font-size:1px;display:block;">&nbsp;&nbsp;</div></td></tr></table></td></tr></table></div><div class="gmail-fix" style="display: none; white-space: nowrap; font: 15px courier; line-height: 0;">&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;</div></body>
</html>`
}

export function getCollaborationInviteEmailSubject(
  senderName: string,
  role: "editor" | "viewer"
): string {
  const action = role === "editor" ? "collaborate on" : "view"
  return `${senderName} invited you to ${action} a conversation`
}
