/**
 * Batch Research Complete Email Template
 */

export interface BatchCompleteEmailData {
  jobName: string
  totalProspects: number
  completedCount: number
  failedCount: number
  jobId: string
  appUrl?: string
}

export function getBatchCompleteEmailHtml(data: BatchCompleteEmailData): string {
  const {
    jobName,
    totalProspects,
    completedCount,
    failedCount,
    jobId,
    appUrl = "https://intel.getromy.app",
  } = data

  const successRate = totalProspects > 0
    ? Math.round((completedCount / totalProspects) * 100)
    : 0

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Research Complete</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Research Complete
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                Your batch research <strong>"${jobName}"</strong> has finished processing.
              </p>

              <!-- Stats -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="text-align: center; padding: 12px;">
                          <div style="font-size: 32px; font-weight: 700; color: #6366f1;">${completedCount}</div>
                          <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Completed</div>
                        </td>
                        <td style="text-align: center; padding: 12px;">
                          <div style="font-size: 32px; font-weight: 700; color: #374151;">${totalProspects}</div>
                          <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Total</div>
                        </td>
                        <td style="text-align: center; padding: 12px;">
                          <div style="font-size: 32px; font-weight: 700; color: ${failedCount > 0 ? '#ef4444' : '#10b981'};">${failedCount}</div>
                          <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Failed</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Success Rate -->
              <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; text-align: center;">
                Success Rate: <strong style="color: #374151;">${successRate}%</strong>
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/batch?job=${jobId}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      View Results
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                This email was sent by Rōmy. You received this because you ran a batch research job.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export function getBatchCompleteEmailSubject(jobName: string): string {
  return `Research Complete: ${jobName}`
}
