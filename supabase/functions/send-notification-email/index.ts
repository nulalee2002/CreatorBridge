import { checkRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getEmailTemplate(template: string, data: Record<string, any>): { subject: string; html: string } {
  let subject = '';
  let bodyContent = '';

  switch (template) {
    case 'welcome_creator':
      subject = `Welcome to CreatorBridge, ${data.creator_name || 'Creator'}`;
      bodyContent = `
        <h2 style="color: #d4a941; margin-top: 0; font-size: 20px;">Your application has been received!</h2>
        <p>Hi ${data.creator_name || 'Creator'},</p>
        <p>Thank you for submitting your professional creator listing to CreatorBridge. We are thrilled to have you apply.</p>
        <p><strong>What happens next:</strong></p>
        <ul>
          <li><strong>Manual Review:</strong> Our team is manually reviewing your application, portfolio samples, and intro video. This typically takes 3 to 5 business days.</li>
          <li><strong>90-Day profile Lock:</strong> To protect marketplace integrity, once your profile is approved, critical identity details (including business name, full name, and location) are locked for 90 days. Minor modifications like bio, packages, and calendar remain editable at any time.</li>
          <li><strong>Stripe Connect:</strong> Once approved, you will need to complete your Stripe Connect Express setup to connect a bank account or debit card. Listings go live only after payout details are linked.</li>
        </ul>
        <p>If you have any questions during this time, please reach out to <a href="mailto:drl33@creatorbridge.studio" style="color: #d4a941; text-decoration: underline;">drl33@creatorbridge.studio</a>.</p>
      `;
      break;

    case 'welcome_client':
      subject = `You're on CreatorBridge`;
      bodyContent = `
        <h2 style="color: #d4a941; margin-top: 0; font-size: 20px;">Welcome to CreatorBridge!</h2>
        <p>Hi ${data.client_name || 'Client'},</p>
        <p>Your client account is now active and ready. CreatorBridge is a professional creative marketplace designed to make finding and hiring US-based creative talent simple and secure.</p>
        <p><strong>Next steps:</strong></p>
        <ul>
          <li><strong>Post a Brief:</strong> Create a project brief specifying deliverables, budget, and location.</li>
          <li><strong>Get Matches:</strong> Review verified creator portfolios and custom proposals.</li>
          <li><strong>Secure Payment:</strong> Pay a 50% retainer to initiate the booking. Funds are held securely until content is delivered.</li>
        </ul>
        <p>Ready to start? Log in and post your first project brief today!</p>
      `;
      break;

    case 'application_received':
      subject = `Your application was submitted`;
      bodyContent = `
        <h2 style="color: #d4a941; margin-top: 0; font-size: 20px;">Proposal Sent!</h2>
        <p>Hi ${data.creator_name || 'Creator'},</p>
        <p>Your application and proposal for the project <strong>"${data.project_title || 'Project'}"</strong> has been successfully submitted to the client.</p>
        <p>The client has been notified and is reviewing active proposals. They will reach out to you via the CreatorBridge messaging thread if they would like to move forward with booking your services.</p>
        <p>You can track the status of your applications anytime in your Creator Dashboard.</p>
      `;
      break;

    case 'application_accepted':
      subject = `You've been hired for ${data.project_title || 'Project'}`;
      bodyContent = `
        <h2 style="color: #d4a941; margin-top: 0; font-size: 20px;">Proposal Accepted!</h2>
        <p>Hi ${data.creator_name || 'Creator'},</p>
        <p>Congratulations! The client has accepted your proposal for the project <strong>"${data.project_title || 'Project'}"</strong>.</p>
        <p><strong>Next Steps:</strong></p>
        <p>The client is now prompted to pay the 50% retainer of <strong>$${Number(data.retainer_amount || 0).toFixed(2)}</strong>. You will receive a notification as soon as the funds clear, signaling you to safely begin creative production.</p>
        <p>Please do not initiate production or deliver files until you receive the confirmation that the retainer has cleared.</p>
      `;
      break;

    case 'retainer_paid':
      subject = `Retainer received — start your project`;
      bodyContent = `
        <h2 style="color: #d4a941; margin-top: 0; font-size: 20px;">Retainer Cleared!</h2>
        <p>Hi ${data.creator_name || 'Creator'},</p>
        <p>Great news! The retainer payment of <strong>$${Number(data.retainer_amount || 0).toFixed(2)}</strong> for the project <strong>"${data.project_title || 'Project'}"</strong> has cleared and is secured.</p>
        <p><strong>You are authorized to start work on the project immediately.</strong></p>
        <p>Once you are ready to deliver the final work, please upload/link the files and submit them using the "Submit Delivery" modal inside your project board to start the approval clock.</p>
      `;
      break;

    case 'delivery_submitted':
      subject = `${data.creator_name || 'Creator'} submitted delivery for ${data.project_title || 'Project'}`;
      bodyContent = `
        <h2 style="color: #d4a941; margin-top: 0; font-size: 20px;">Delivery Received!</h2>
        <p>Hi ${data.client_name || 'Client'},</p>
        <p>Creator <strong>${data.creator_name || 'Creator'}</strong> has submitted the content delivery link and files for your project <strong>"${data.project_title || 'Project'}"</strong>.</p>
        <p><strong>Review Requirement:</strong></p>
        <p>Please log in to your CreatorBridge dashboard, review the deliverables, and either approve the delivery to release the final payout, or request a revision if changes are needed.</p>
        <p><em>Note: As per platform guidelines, you have 72 hours to review and request revisions. If no action is taken within 72 hours, the final payment releases to the creator automatically.</em></p>
      `;
      break;

    case 'final_paid':
      subject = `Payment released: $${Number(data.payout_amount || 0).toFixed(2)}`;
      bodyContent = `
        <h2 style="color: #d4a941; margin-top: 0; font-size: 20px;">Payout Released!</h2>
        <p>Hi ${data.creator_name || 'Creator'},</p>
        <p>The client has approved your content delivery (or the 72-hour review period has elapsed) for the project <strong>"${data.project_title || 'Project'}"</strong>.</p>
        <p>The final payout of <strong>$${Number(data.payout_amount || 0).toFixed(2)}</strong> has been successfully initiated and is on its way to your connected Stripe account.</p>
        <p>Thank you for your excellent work on CreatorBridge!</p>
      `;
      break;

    case 'support_ticket_opened':
      subject = `Support ticket #${data.ticket_reference || 'Ticket'} received`;
      bodyContent = `
        <h2 style="color: #d4a941; margin-top: 0; font-size: 20px;">Support Ticket Received</h2>
        <p>Hi ${data.user_name || 'User'},</p>
        <p>We have successfully received your support request. Your reference ticket ID is <strong>#${data.ticket_reference || 'unknown'}</strong>.</p>
        <p>A member of our admin support team will review the details of your ticket and respond directly to your account email address within 24 hours.</p>
        <p>Thank you for your patience.</p>
      `;
      break;

    default:
      subject = `Notification from CreatorBridge`;
      bodyContent = `
        <p>Hi,</p>
        <p>You have a new notification on the CreatorBridge platform.</p>
        <p>Log in to your dashboard to view the details.</p>
      `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0e0f11; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e5e7eb; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0e0f11; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #16171b; border: 1px solid #232429; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);">
              
              <!-- Header -->
              <tr>
                <td align="center" style="padding: 30px 40px 20px 40px; border-bottom: 1px solid #232429;">
                  <span style="font-size: 16px; font-weight: 800; letter-spacing: 4px; color: #d4a941; text-transform: uppercase; font-family: 'Outfit', sans-serif;">CREATORBRIDGE</span>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px; font-size: 14px; line-height: 1.6; color: #c8cbd0;">
                  ${bodyContent}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td align="center" style="padding: 30px 40px; border-top: 1px solid #232429; font-size: 11px; color: #6b6e76;">
                  <p style="margin: 0 0 8px 0;">This is a transactional email from the CreatorBridge Marketplace platform.</p>
                  <p style="margin: 0;">CreatorBridge Inc. &middot; <a href="mailto:drl33@creatorbridge.studio" style="color: #d4a941; text-decoration: none;">drl33@creatorbridge.studio</a></p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return { subject, html };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Support rate limits for public calls, bypass if authenticated service role
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.includes('Bearer ')) {
    const rateLimited = checkRateLimit(req, { maxRequests: 10, windowMs: 60_000 });
    if (rateLimited) return rateLimited;
  }

  try {
    const { to, template, data } = await req.json();
    if (!to || !template) {
      return jsonResponse({ error: 'recipient email (to) and template name are required' }, 400);
    }

    const { subject, html } = getEmailTemplate(template, data || {});

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.warn(`[Local Mode] RESEND_API_KEY is not configured. Would send email to ${to}:`);
      console.warn(`Subject: ${subject}`);
      console.warn(`HTML preview length: ${html.length} chars`);
      return jsonResponse({ success: true, message: 'Local mock success', logged: true });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'CreatorBridge <drl33@creatorbridge.studio>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Resend API response error:', response.status, errBody);
      return jsonResponse({ error: 'Failed to deliver email through Resend API' }, 502);
    }

    const resData = await response.json();
    return jsonResponse({ success: true, message: 'Email sent successfully', id: resData.id });
  } catch (err) {
    console.error('send-notification-email function error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'unknown error' }, 500);
  }
});
