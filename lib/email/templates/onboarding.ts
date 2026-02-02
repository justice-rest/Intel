/**
 * Onboarding Email Templates
 * Clean, minimal Maily-style design
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

// ============================================================================
// EMAIL 1: WELCOME (Immediate)
// ============================================================================

export function getWelcomeEmailHtml(data: OnboardingEmailData): string {
  const { firstName, appUrl = APP_URL } = data

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
                      <strong>Welcome to Rōmy, ${firstName}!</strong>
                    </h2>

                    <!-- Body -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      Thank you for joining us. You've just taken the first step toward transforming how your nonprofit finds and cultivates major donors.
                    </p>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      Rōmy is designed specifically for small nonprofits like yours who deserve access to the same powerful prospect research tools that large organizations use — without the enterprise price tag.
                    </p>

                    <!-- What You Can Do -->
                    <h3 style="margin:32px 0 16px 0;color:#111827;font-size:18px;line-height:24px;font-weight:600">
                      What You Can Do Right Now
                    </h3>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 12px 0">
                      <strong style="color:#111827">Quick Research</strong> — Ask Rōmy about any potential donor and get instant insights on their giving capacity, philanthropic interests, and connection points.
                    </p>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 12px 0">
                      <strong style="color:#111827">Batch Research</strong> — Upload a list of prospects and let Rōmy research them all at once — perfect for event follow-up or database screening.
                    </p>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 24px 0">
                      <strong style="color:#111827">Export Reports</strong> — Generate professional PDF reports to share with your board or development committee.
                    </p>

                    <!-- CTA Button -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px">
                      <tbody>
                        <tr>
                          <td>
                            <a href="${appUrl}" style="line-height:100%;text-decoration:none;display:inline-block;color:#ffffff;background-color:#00A5E4;font-size:14px;font-weight:500;border-radius:9999px;padding:12px 32px" target="_blank">
                              <span style="display:inline-block;line-height:120%">Start Researching →</span>
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- Tip -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f9fafb;border-radius:12px;margin-bottom:32px">
                      <tbody>
                        <tr>
                          <td style="padding:20px 24px">
                            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px">Quick Tip</p>
                            <p style="font-size:14px;line-height:22px;color:#374151;margin:0">
                              Try your first search by typing something like: "Research John Smith, 123 Main Street, Seattle, WA — what's his giving capacity?"
                            </p>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- Signature -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0">
                      With Warm Regards,<br /><strong style="color:#111827">Howard Freeman</strong><br /><span style="color:#6b7280">Founder & CEO, Rōmy</span>
                    </p>

                    <!-- Footer -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="height:48px">
                      <tbody><tr><td></td></tr></tbody>
                    </table>

                    <p style="font-size:13px;line-height:20px;color:#9ca3af;margin:0">
                      Questions? Reply to this email — we read every message.
                    </p>`

  return getEmailWrapper(content)
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
                      <strong>How Rōmy Works</strong>
                    </h2>

                    <!-- Body -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      Now that you've had a chance to explore, ${firstName}, let me share how other nonprofits are getting the most out of Rōmy.
                    </p>

                    <!-- Section: 3 Research Modes -->
                    <h3 style="margin:24px 0 16px 0;color:#111827;font-size:18px;line-height:24px;font-weight:600">
                      The 3 Research Modes
                    </h3>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 12px 0">
                      <strong style="color:#111827">1. Quick Research (Chat)</strong> — Just ask a question in natural language. Rōmy searches public records, FEC filings, SEC data, property records, and more.
                    </p>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 12px 0">
                      <strong style="color:#111827">2. Deep Research</strong> — Toggle on "Deep Research" for comprehensive reports with spouse info, business valuations, and detailed capacity analysis.
                    </p>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 24px 0">
                      <strong style="color:#111827">3. Batch Research</strong> — Upload a CSV with your prospect list. Rōmy will research each person and deliver exportable reports.
                    </p>

                    <!-- Section: What Rōmy Searches -->
                    <h3 style="margin:24px 0 16px 0;color:#111827;font-size:18px;line-height:24px;font-weight:600">
                      What Rōmy Searches
                    </h3>

                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 8px 0">
                      <strong style="color:#111827">Property Records</strong> — Home values, additional properties, ownership
                    </p>
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 8px 0">
                      <strong style="color:#111827">Business Affiliations</strong> — LLC ownership, executive roles, board positions
                    </p>
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 8px 0">
                      <strong style="color:#111827">SEC Filings</strong> — Stock holdings, insider transactions
                    </p>
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 8px 0">
                      <strong style="color:#111827">FEC Data</strong> — Political contributions and patterns
                    </p>
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 24px 0">
                      <strong style="color:#111827">Nonprofit 990s</strong> — Foundation connections, giving history
                    </p>

                    <!-- Tip Box -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f9fafb;border-radius:12px;margin-bottom:24px">
                      <tbody>
                        <tr>
                          <td style="padding:20px 24px">
                            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px">Pro Tip</p>
                            <p style="font-size:14px;line-height:22px;color:#374151;margin:0">
                              The more specific your query, the better. Include full name, city/state, and any known affiliations for the most accurate results.
                            </p>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- CTA Button -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px">
                      <tbody>
                        <tr>
                          <td>
                            <a href="${appUrl}" style="line-height:100%;text-decoration:none;display:inline-block;color:#ffffff;background-color:#00A5E4;font-size:14px;font-weight:500;border-radius:9999px;padding:12px 32px" target="_blank">
                              <span style="display:inline-block;line-height:120%">Try Deep Research →</span>
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- Signature -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0">
                      With Warm Regards,<br /><strong style="color:#111827">Howard Freeman</strong><br /><span style="color:#6b7280">Founder & CEO, Rōmy</span>
                    </p>

                    <!-- Footer -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="height:48px">
                      <tbody><tr><td></td></tr></tbody>
                    </table>

                    <p style="font-size:13px;line-height:20px;color:#9ca3af;margin:0">
                      Rōmy · Donor Intelligence for Nonprofits
                    </p>`

  return getEmailWrapper(content)
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
                      <strong>We've All Been There</strong>
                    </h2>

                    <!-- Body -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      Before Rōmy, our team worked with dozens of small nonprofits, ${firstName}. We heard the same challenges over and over:
                    </p>

                    <!-- Challenge 1 -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 8px 0">
                      <strong style="color:#111827">"I don't have time for research"</strong>
                    </p>
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      Rōmy does it in seconds. What used to take 2-3 hours per prospect now takes 30 seconds.
                    </p>

                    <!-- Challenge 2 -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 8px 0">
                      <strong style="color:#111827">"Professional tools are too expensive"</strong>
                    </p>
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      Enterprise platforms cost $10,000-$50,000/year. Rōmy delivers the same quality at a fraction of the cost.
                    </p>

                    <!-- Challenge 3 -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 8px 0">
                      <strong style="color:#111827">"I don't know where to start"</strong>
                    </p>
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      Every report includes a "Cultivation Strategy" with specific next steps tailored to that prospect.
                    </p>

                    <!-- Challenge 4 -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 8px 0">
                      <strong style="color:#111827">"My board wants major donors, but I don't have leads"</strong>
                    </p>
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 24px 0">
                      Run Batch Research on your event attendees or donor list. You'll find hidden capacity you didn't know existed.
                    </p>

                    <!-- Quick Win Box -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f9fafb;border-radius:12px;margin-bottom:24px">
                      <tbody>
                        <tr>
                          <td style="padding:20px 24px">
                            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px">Quick Win</p>
                            <p style="font-size:14px;line-height:22px;color:#374151;margin:0">
                              Take your last event's attendee list and run it through Batch Research. You'll likely find 2-3 major gift prospects you didn't know about.
                            </p>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- CTA Button -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px">
                      <tbody>
                        <tr>
                          <td>
                            <a href="${appUrl}/labs" style="line-height:100%;text-decoration:none;display:inline-block;color:#ffffff;background-color:#00A5E4;font-size:14px;font-weight:500;border-radius:9999px;padding:12px 32px" target="_blank">
                              <span style="display:inline-block;line-height:120%">Try Batch Research →</span>
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- Signature -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0">
                      With Warm Regards,<br /><strong style="color:#111827">Howard Freeman</strong><br /><span style="color:#6b7280">Founder & CEO, Rōmy</span>
                    </p>

                    <!-- Footer -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="height:48px">
                      <tbody><tr><td></td></tr></tbody>
                    </table>

                    <p style="font-size:13px;line-height:20px;color:#9ca3af;margin:0">
                      Rōmy · Donor Intelligence for Nonprofits
                    </p>`

  return getEmailWrapper(content)
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
                      <strong>What's Next, ${firstName}?</strong>
                    </h2>

                    <!-- Body -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      You've been with us for almost a week now. Here's how to take your prospect research to the next level:
                    </p>

                    <!-- Tips -->
                    <h3 style="margin:24px 0 8px 0;color:#111827;font-size:16px;line-height:24px;font-weight:600">
                      Build a Research Routine
                    </h3>
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      The most successful development teams research prospects before every meeting, call, or event. With Rōmy, this takes seconds — not hours.
                    </p>

                    <h3 style="margin:0 0 8px 0;color:#111827;font-size:16px;line-height:24px;font-weight:600">
                      Create a Prospect Portfolio
                    </h3>
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 20px 0">
                      Use Rōmy's project folders to organize your research by campaign, event, or portfolio. Keep your top 25 prospects organized and easily accessible.
                    </p>

                    <h3 style="margin:0 0 8px 0;color:#111827;font-size:16px;line-height:24px;font-weight:600">
                      Share with Your Team
                    </h3>
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0 0 24px 0">
                      Export PDF reports to share with your executive director, board members, or development committee. Professional reports build confidence in your major gift strategy.
                    </p>

                    <!-- Help Box -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f9fafb;border-radius:12px;margin-bottom:24px">
                      <tbody>
                        <tr>
                          <td style="padding:20px 24px">
                            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.5px">We're Here to Help</p>
                            <p style="font-size:14px;line-height:22px;color:#374151;margin:0">
                              Have questions? Want to learn how other nonprofits are using Rōmy? Just reply to this email. Our team reads and responds to every message.
                            </p>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- CTA Button -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:32px">
                      <tbody>
                        <tr>
                          <td>
                            <a href="${appUrl}" style="line-height:100%;text-decoration:none;display:inline-block;color:#ffffff;background-color:#00A5E4;font-size:14px;font-weight:500;border-radius:9999px;padding:12px 32px" target="_blank">
                              <span style="display:inline-block;line-height:120%">Continue Researching →</span>
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <!-- Signature -->
                    <p style="font-size:15px;line-height:26.25px;-webkit-font-smoothing:antialiased;color:#374151;margin:0">
                      With Warm Regards,<br /><strong style="color:#111827">Howard Freeman</strong><br /><span style="color:#6b7280">Founder & CEO, Rōmy</span>
                    </p>

                    <!-- Footer -->
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="height:48px">
                      <tbody><tr><td></td></tr></tbody>
                    </table>

                    <p style="font-size:13px;line-height:20px;color:#9ca3af;margin:0 0 8px 0">
                      Rōmy · Donor Intelligence for Nonprofits
                    </p>
                    <p style="font-size:13px;line-height:20px;color:#9ca3af;margin:0">
                      This is the last email in our welcome series. You'll only hear from us about important updates.
                    </p>`

  return getEmailWrapper(content)
}

export function getMovingForwardEmailSubject(): string {
  return "What's next for your prospect research?"
}
