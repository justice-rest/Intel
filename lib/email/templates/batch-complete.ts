/**
 * Batch Research Complete Email Template
 * Clean, minimal Maily-style design
 */

export interface BatchCompleteEmailData {
  jobName: string
  totalProspects: number
  completedCount: number
  failedCount: number
  jobId: string
  appUrl?: string
  userName?: string
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

export function getBatchCompleteEmailHtml(data: BatchCompleteEmailData): string {
  const {
    jobName,
    totalProspects,
    completedCount,
    failedCount,
    jobId,
    appUrl = APP_URL,
    userName = "there",
  } = data

  const successRate = totalProspects > 0 ? Math.round((completedCount / totalProspects) * 100) : 0
  const progressBarWidth = `${successRate}%`
  const progressBarColor = failedCount > 0 ? "#f59e0b" : "#10b981"

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
                      <strong>Your Research is Ready</strong>
                    </h2>

                    <!-- Body -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      Hey ${userName}! Your batch research job <strong style="color:#111827">"${jobName}"</strong> has finished processing.
                    </p>

                    <!-- Stats Box -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f9fafb;border-radius:16px;margin-bottom:24px">
                      <tbody>
                        <tr>
                          <td style="padding:28px 32px">
                            <!-- Progress Bar -->
                            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
                              <tr>
                                <td style="background-color:#e5e7eb;border-radius:999px;height:8px">
                                  <table width="${progressBarWidth}" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                      <td style="background-color:${progressBarColor};border-radius:999px;height:8px;width:100%"></td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!-- Stats Row -->
                            <table width="100%" border="0" cellpadding="0" cellspacing="0">
                              <tr>
                                <td align="left" style="padding:4px 0">
                                  <span style="display:inline-block;width:10px;height:10px;background-color:${progressBarColor};border-radius:50%;margin-right:8px;vertical-align:middle"></span>
                                  <span style="font-size:14px;color:#374151;vertical-align:middle"><strong style="color:#111827">${completedCount}</strong> prospects researched</span>
                                </td>
                                <td align="right" style="padding:4px 0">
                                  <span style="display:inline-block;width:10px;height:10px;background-color:${failedCount > 0 ? '#ef4444' : '#d1d5db'};border-radius:50%;margin-right:8px;vertical-align:middle"></span>
                                  <span style="font-size:14px;color:#6b7280;vertical-align:middle"><strong style="color:${failedCount > 0 ? '#ef4444' : '#9ca3af'}">${failedCount}</strong> failed</span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 24px 0">
                      Each prospect profile includes giving capacity analysis, wealth indicators, philanthropic connections, and cultivation strategies.
                    </p>

                    <!-- CTA Button -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px">
                      <tbody>
                        <tr>
                          <td>
                            <a href="${appUrl}/labs/${jobId}" style="line-height:100%;text-decoration:none;display:inline-block;color:#ffffff;background-color:#00A5E4;font-size:14px;font-weight:500;border-radius:9999px;padding:12px 32px" target="_blank">
                              <span style="display:inline-block;line-height:120%">View Your Results →</span>
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- Spacer -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="height:32px">
                      <tbody><tr><td></td></tr></tbody>
                    </table>

                    <!-- Signature -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0">
                      Happy prospecting,<br /><strong style="color:#111827">The Rōmy Team</strong>
                    </p>

                    <!-- Footer -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="height:48px">
                      <tbody><tr><td></td></tr></tbody>
                    </table>

                    <p style="font-size:13px;line-height:20px;color:#9ca3af;margin:0">
                      Questions? Reply to email (howard@getromy.app) — we read every message.
                    </p>`

  return getEmailWrapper(content)
}

export function getBatchCompleteEmailSubject(jobName: string): string {
  return `Your research is ready: ${jobName}`
}
