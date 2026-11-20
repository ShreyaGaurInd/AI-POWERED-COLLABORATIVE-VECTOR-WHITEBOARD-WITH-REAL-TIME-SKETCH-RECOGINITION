import nodemailer from 'nodemailer';
import { ENV } from '../config/env.js';

interface SendVerificationEmailOptions {
  to: string;
  fullName: string;
  code: string;
}

/**
 * Creates the mail transporter
 * Uses SMTP settings from environment variables if present.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });
  }

  return null;
}

/**
 * Dispatches an email verification code
 * If SMTP is configured in .env, sends a real email.
 * If SMTP is not yet configured, logs the dispatch clearly in the terminal.
 */
export async function sendVerificationEmail({ to, fullName, code }: SendVerificationEmailOptions): Promise<boolean> {
  const transporter = createTransporter();

  // Clean, Canva-inspired HTML email template
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 32px 28px; text-align: center; }
          .greeting { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
          .text { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
          .code-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 18px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; font-family: monospace; margin: 0 auto 24px auto; display: inline-block; }
          .footer { padding: 20px 24px; background: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>CollabBoard</h1>
          </div>
          <div class="content">
            <div class="greeting">Confirm your email, ${fullName}!</div>
            <p class="text">
              Thank you for joining CollabBoard. Enter the 6-digit confirmation code below to activate your account and access your collaborative whiteboards:
            </p>
            <div class="code-box">${code}</div>
            <p class="text" style="font-size: 12px; margin-bottom: 0;">
              This code will expire in <strong>15 minutes</strong>. If you did not request this, you can safely ignore this email.
            </p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} CollabBoard Smart Canvas. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"CollabBoard" <${process.env.SMTP_USER}>`,
        to,
        subject: `${code} is your CollabBoard verification code`,
        html: htmlContent,
      });

      console.log(`[SMTP] Successfully delivered real email to ${to}`);
      return true;
    } catch (error) {
      console.error(`[SMTP ERROR] Failed to send email to ${to}:`, error);
      // Fallback to console log so development never stops
    }
  }

  // Fallback terminal output for local development
  console.log(`
  ======================================================
  📧 [EMAIL DISPATCH NOTICE]
  To:      ${to}
  Subject: Your CollabBoard 6-Digit Verification Code
  Code:    ${code}
  Expires: 15 minutes
  ------------------------------------------------------
  * Real Inbox Delivery: To have emails sent to actual
    inboxes, set SMTP_USER and SMTP_PASS in server/.env!
  ======================================================
  `);

  return false;
}
