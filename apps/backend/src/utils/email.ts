import { env } from '../config/env.js';

interface EmailRecipient {
  email: string;
  name?: string;
}

interface SendEmailOptions {
  to: EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

/**
 * Sends a transactional email using Brevo (Sendinblue) REST API v3.
 * Non-blocking with resilient error logging.
 */
export async function sendBrevoEmail(options: SendEmailOptions): Promise<boolean> {
  const apiKey = env.BREVO_API_KEY;
  const senderEmail = env.BREVO_SENDER_EMAIL;
  const senderName = env.BREVO_SENDER_NAME || 'Fynly';

  if (!apiKey || !senderEmail) {
    console.warn('[Brevo] BREVO_API_KEY or BREVO_SENDER_EMAIL not configured. Email skipped.');
    return false;
  }

  try {
    const payload = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: options.to.map((r) => ({
        email: r.email,
        name: r.name || r.email,
      })),
      subject: options.subject,
      htmlContent: options.htmlContent,
      textContent: options.textContent,
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Brevo] Failed to send email: HTTP ${response.status} - ${errorText}`);
      return false;
    }

    const data = await response.json();
    console.log(`[Brevo] Transactional email sent successfully:`, data);
    return true;
  } catch (error) {
    console.error('[Brevo] Error dispatching email via Brevo:', error);
    return false;
  }
}

/**
 * Sends a welcome email to newly registered users.
 */
export async function sendWelcomeEmail(user: { email: string; name: string }): Promise<void> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Fynly</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0B0E14; color: #E2E8F0; margin: 0; padding: 32px 16px; }
        .card { max-width: 540px; margin: 0 auto; background: #151921; border: 1px solid #232936; border-radius: 16px; padding: 36px 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .logo-badge { display: inline-block; padding: 6px 14px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 9999px; color: #10B981; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 20px; }
        h1 { color: #FFFFFF; font-size: 24px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.5px; }
        p { color: #94A3B8; font-size: 15px; line-height: 1.6; margin: 0 0 18px 0; }
        .highlight-box { background: #0E121B; border: 1px solid #1E2533; border-radius: 12px; padding: 20px; margin: 24px 0; }
        .feature-item { display: flex; align-items: center; margin-bottom: 12px; font-size: 14px; color: #CBD5E1; }
        .feature-item:last-child { margin-bottom: 0; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #10B981; display: inline-block; margin-right: 12px; }
        .footer { text-align: center; margin-top: 28px; font-size: 12px; color: #64748B; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo-badge">Fynly Finance</div>
        <h1>Welcome aboard, ${user.name}! 🚀</h1>
        <p>Your financial hub is all set up. Fynly gives you total clarity over your expenses, budgets, bank imports, and cash flow with zero guesswork.</p>
        
        <div class="highlight-box">
          <div class="feature-item"><span class="dot"></span> <strong>Automated Budget Tracking</strong> &amp; threshold alerts</div>
          <div class="feature-item"><span class="dot"></span> <strong>Bank Statement Reconciliation</strong> (HDFC, ICICI, SBI)</div>
          <div class="feature-item"><span class="dot"></span> <strong>Paise-precise Ledger</strong> with zero floating-point errors</div>
        </div>

        <p>Open the app anytime to view your safe-to-spend allowance and monitor your financial health.</p>

        <div class="footer">
          &copy; ${new Date().getFullYear()} Fynly. All rights reserved. Sent via Brevo Transactional Service.
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `Welcome to Fynly, ${user.name}!\n\nYour account has been created successfully. Track budgets, view real-time safe-to-spend allowances, and reconcile your statements seamlessly.\n\nBest regards,\nThe Fynly Team`;

  // Asynchronous dispatch (fire and log)
  sendBrevoEmail({
    to: [{ email: user.email, name: user.name }],
    subject: `Welcome to Fynly, ${user.name}! 🚀`,
    htmlContent,
    textContent,
  }).catch((err) => {
    console.error('[Brevo] Unexpected error during welcome email delivery:', err);
  });
}

/**
 * Sends a budget threshold warning email (e.g. at 70%, 90%, or 100%).
 */
export async function sendBudgetAlertEmail(
  user: { email: string; name: string },
  alert: {
    categoryName: string;
    thresholdPercent: number;
    spentFormatted: string;
    budgetFormatted: string;
  }
): Promise<void> {
  const isExceeded = alert.thresholdPercent >= 100;
  const accentColor = isExceeded ? '#EF4444' : alert.thresholdPercent >= 90 ? '#F97316' : '#F59E0B';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0B0E14; color: #E2E8F0; margin: 0; padding: 32px 16px; }
        .card { max-width: 540px; margin: 0 auto; background: #151921; border: 1px solid #232936; border-radius: 16px; padding: 36px 28px; }
        .alert-badge { display: inline-block; padding: 6px 14px; background: rgba(239, 68, 68, 0.15); border: 1px solid ${accentColor}; border-radius: 9999px; color: ${accentColor}; font-weight: 700; font-size: 13px; margin-bottom: 20px; }
        h1 { color: #FFFFFF; font-size: 22px; font-weight: 700; margin: 0 0 12px 0; }
        p { color: #94A3B8; font-size: 15px; line-height: 1.6; margin: 0 0 18px 0; }
        .stat-box { background: #0E121B; border: 1px solid #1E2533; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 28px; font-size: 12px; color: #64748B; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="alert-badge">${alert.thresholdPercent}% Threshold Reached</div>
        <h1>Budget Alert for ${alert.categoryName}</h1>
        <p>Hi ${user.name}, you have spent <strong>${alert.thresholdPercent}%</strong> of your allocated budget for <strong>${alert.categoryName}</strong>.</p>
        
        <div class="stat-box">
          <p style="margin: 0 0 8px 0;"><strong>Spent:</strong> ${alert.spentFormatted}</p>
          <p style="margin: 0;"><strong>Total Budget:</strong> ${alert.budgetFormatted}</p>
        </div>

        <p>Check your Fynly app to adjust your allowance or review recent transactions.</p>
        <div class="footer">&copy; ${new Date().getFullYear()} Fynly</div>
      </div>
    </body>
    </html>
  `;

  sendBrevoEmail({
    to: [{ email: user.email, name: user.name }],
    subject: `⚠️ Budget Alert: ${alert.categoryName} reached ${alert.thresholdPercent}%`,
    htmlContent,
  }).catch((err) => {
    console.error('[Brevo] Unexpected error during budget alert email delivery:', err);
  });
}

/**
 * Sends a 6-digit verification OTP email for registration or login.
 */
export async function sendOtpEmail(
  email: string,
  otp: string,
  purpose: 'REGISTER' | 'LOGIN'
): Promise<boolean> {
  const isRegister = purpose === 'REGISTER';
  const actionText = isRegister ? 'complete your registration' : 'sign in to your account';
  const subject = isRegister
    ? `🔐 Your Fynly Verification Code: ${otp}`
    : `🔑 Your Fynly Login Code: ${otp}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0B0E14; color: #E2E8F0; margin: 0; padding: 32px 16px; }
        .card { max-width: 500px; margin: 0 auto; background: #151921; border: 1px solid #232936; border-radius: 16px; padding: 36px 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; }
        .logo-badge { display: inline-block; padding: 6px 14px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 9999px; color: #10B981; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 20px; }
        h1 { color: #FFFFFF; font-size: 22px; font-weight: 700; margin: 0 0 10px 0; }
        p { color: #94A3B8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
        .otp-box { background: #0A0D13; border: 2px dashed #10B981; border-radius: 12px; padding: 20px; margin: 24px 0; display: inline-block; width: 80%; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; color: #10B981; letter-spacing: 10px; margin: 0; }
        .expiry-note { font-size: 12px; color: #F59E0B; margin-top: 8px; font-weight: 500; }
        .security-notice { border-top: 1px solid #1E2533; padding-top: 20px; margin-top: 24px; font-size: 12px; color: #64748B; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo-badge">Fynly Security</div>
        <h1>${isRegister ? 'Confirm Your Email' : 'One-Time Login Code'}</h1>
        <p>Use the 6-digit verification code below to ${actionText}.</p>
        
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
          <div class="expiry-note">⏱ Code expires in 10 minutes</div>
        </div>

        <p style="font-size: 13px;">Never share this verification code with anyone. Fynly staff will never ask for your code.</p>

        <div class="security-notice">
          If you did not request this verification code, you can safely ignore this email.<br>&copy; ${new Date().getFullYear()} Fynly
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `Your Fynly verification code is: ${otp}\n\nUse this code to ${actionText}. This code expires in 10 minutes.\n\nIf you did not request this code, please ignore this email.`;

  return sendBrevoEmail({
    to: [{ email }],
    subject,
    htmlContent,
    textContent,
  });
}
