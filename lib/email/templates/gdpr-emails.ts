/**
 * GDPR Email Templates
 * Clean, minimal Maily-style design
 * Data Export and Account Deletion Emails
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

const APP_URL = "https://intel.getromy.app"
const LOGO_URL = "https://the-romy.vercel.app/BrandmarkRōmy.png"

// Maily-style email wrapper
function getEmailWrapper(content: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <meta name="viewport" content="width=device-width" />
    <link rel="preload" as="image" href="${LOGO_URL}" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <style>
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 400;
        mso-font-alt: 'sans-serif';
        src: url(https://rsms.me/inter/font-files/Inter-Regular.woff2?v=3.19) format('woff2');
      }
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 600;
        mso-font-alt: 'sans-serif';
        src: url(https://rsms.me/inter/font-files/Inter-SemiBold.woff2?v=3.19) format('woff2');
      }
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 700;
        mso-font-alt: 'sans-serif';
        src: url(https://rsms.me/inter/font-files/Inter-Bold.woff2?v=3.19) format('woff2');
      }
      * {
        font-family: 'Inter', sans-serif;
      }
    </style>
    <style>
      blockquote,h1,h2,h3,img,li,ol,p,ul{margin-top:0;margin-bottom:0}@media only screen and (max-width:425px){.tab-row-full{width:100%!important}.tab-col-full{display:block!important;width:100%!important}.tab-pad{padding:0!important}}
    </style>
  </head>
  <body style="background-color:#ffffff;margin:0;padding:0">
    <table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center">
      <tbody>
        <tr>
          <td style="margin:0px;background-color:#ffffff;padding:0">
            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;margin-left:auto;margin-right:auto;background-color:#ffffff;min-width:300px;padding:32px 24px">
              <tbody>
                <tr style="width:100%">
                  <td>
${content}
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`
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
    appUrl = APP_URL,
  } = data

  const sectionsText = sectionsExported.length > 0
    ? sectionsExported.join(", ")
    : "all data"

  const content = `
                    <!-- Logo -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tbody>
                        <tr>
                          <td align="left">
                            <img title="Rōmy" alt="Rōmy" src="${LOGO_URL}" style="display:block;outline:none;border:none;text-decoration:none;width:120px;height:auto" />
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- Spacer -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="height:48px">
                      <tbody><tr><td></td></tr></tbody>
                    </table>

                    <!-- Heading -->
                    <h2 style="margin:0 0 12px 0;color:#111827;font-size:30px;line-height:36px;font-weight:700">
                      <strong>Your Data Export is Ready</strong>
                    </h2>

                    <!-- Body -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      Hey ${userName}! Your data export has been completed and the download should have started automatically.
                    </p>

                    <!-- Export Details Box -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f9fafb;border-radius:12px;margin-bottom:24px">
                      <tbody>
                        <tr>
                          <td style="padding:20px 24px">
                            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px">Export Details</p>
                            <p style="font-size:14px;line-height:22px;color:#374151;margin:0 0 8px 0">
                              <strong style="color:#111827">Date:</strong> ${exportDate}
                            </p>
                            <p style="font-size:14px;line-height:22px;color:#374151;margin:0">
                              <strong style="color:#111827">Included:</strong> ${sectionsText}
                            </p>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 24px 0">
                      We're committed to transparency and giving you full control over your information. You can request another export anytime from your account settings.
                    </p>

                    <!-- CTA Button -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px">
                      <tbody>
                        <tr>
                          <td>
                            <a href="${appUrl}" style="line-height:100%;text-decoration:none;display:inline-block;color:#ffffff;background-color:#00A5E4;font-size:14px;font-weight:500;border-radius:9999px;padding:12px 32px" target="_blank">
                              <span style="display:inline-block;line-height:120%">Back to Rōmy →</span>
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- Signature -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0">
                      Best regards,<br /><strong style="color:#111827">The Rōmy Team</strong>
                    </p>

                    <!-- Footer -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="height:48px">
                      <tbody><tr><td></td></tr></tbody>
                    </table>

                    <p style="font-size:13px;line-height:20px;color:#9ca3af;margin:0">
                      Questions about your data? Reply to email (howard@getromy.app).
                    </p>`

  return getEmailWrapper(content)
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
    appUrl = APP_URL,
  } = data

  const content = `
                    <!-- Logo -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tbody>
                        <tr>
                          <td align="left">
                            <img title="Rōmy" alt="Rōmy" src="${LOGO_URL}" style="display:block;outline:none;border:none;text-decoration:none;width:120px;height:auto" />
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- Spacer -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="height:48px">
                      <tbody><tr><td></td></tr></tbody>
                    </table>

                    <!-- Heading -->
                    <h2 style="margin:0 0 12px 0;color:#111827;font-size:30px;line-height:36px;font-weight:700">
                      <strong>Goodbye, ${userName}</strong>
                    </h2>

                    <!-- Body -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      Your Rōmy account has been deleted and all your data has been completely removed from our systems.
                    </p>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      It was a genuine pleasure having you with us. Every moment you spent using Rōmy meant the world to our small team.
                    </p>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      If you ever decide to come back, we'll be here with open arms, ready to help you find major donors and make a bigger impact.
                    </p>

                    <p style="font-size:13px;line-height:20px;color:#9ca3af;margin:0 0 24px 0">
                      Account deleted on ${deletionDate}
                    </p>

                    <!-- CTA Button -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px">
                      <tbody>
                        <tr>
                          <td>
                            <a href="${appUrl}" style="line-height:100%;text-decoration:none;display:inline-block;color:#ffffff;background-color:#00A5E4;font-size:14px;font-weight:500;border-radius:9999px;padding:12px 32px" target="_blank">
                              <span style="display:inline-block;line-height:120%">Create New Account →</span>
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- Signature -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0">
                      With gratitude,<br /><strong style="color:#111827">Howard Freeman</strong><br /><span style="color:#6b7280">Founder & CEO, Rōmy</span>
                    </p>

                    <!-- Footer -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="height:48px">
                      <tbody><tr><td></td></tr></tbody>
                    </table>

                    <p style="font-size:13px;line-height:20px;color:#9ca3af;margin:0">
                      Thank you for being part of our journey.
                    </p>`

  return getEmailWrapper(content)
}

export function getAccountDeletionEmailSubject(): string {
  return "Goodbye from Rōmy"
}
