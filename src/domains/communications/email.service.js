const env = require('../../config/env');
const logger = require('../../utils/logger');
const { ValidationError } = require('../../utils/errors');

let transporter;
let nodemailerClient;

function getBrandName() {
  return String(env.MAIL_FROM_NAME || 'Ajicore').trim() || 'Ajicore';
}

function ensureMailConfigured() {
  if ((env.MAIL_PROVIDER || '').toLowerCase() !== 'smtp') {
    throw new ValidationError('Email delivery is not configured on this server.');
  }

  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS || !env.MAIL_FROM_EMAIL) {
    throw new ValidationError('SMTP settings are incomplete on this server.');
  }
}

function getTransporter() {
  ensureMailConfigured();

  if (!transporter) {
    if (!nodemailerClient) {
      // Lazy-load so modules that merely import auth do not require the mail driver immediately.
      // This keeps non-email code paths and tests lightweight while preserving runtime behavior.
      // eslint-disable-next-line global-require
      nodemailerClient = require('nodemailer');
    }

    transporter = nodemailerClient.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  if (!to) {
    throw new ValidationError('Recipient email address is required.');
  }

  const client = getTransporter();

  try {
    return await client.sendMail({
      from: `"${getBrandName()}" <${env.MAIL_FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    logger.error(`Email send failed: ${err.message}`);
    throw new ValidationError('Unable to send email right now.');
  }
}

async function sendPasswordResetOtpEmail({ to, code, expiresInMinutes, userName }) {
  const greetingName = String(userName || '').trim();
  const greeting = greetingName ? `Hello ${greetingName},` : 'Hello,';
  const brandName = getBrandName();
  const subject = 'Your password reset code';

  const text = [
    greeting,
    '',
    'We received a request to reset your password.',
    '',
    'Your password reset code is:',
    '',
    code,
    '',
    `This code expires in ${expiresInMinutes} minutes.`,
    '',
    'If you did not request this, you can safely ignore this email.',
    '',
    `${brandName} Support`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <p>${greeting}</p>
      <p>We received a request to reset your password.</p>
      <p>Your password reset code is:</p>
      <div style="margin: 24px 0; padding: 16px; background: #f3f4f6; border-radius: 8px; text-align: center; font-size: 28px; font-weight: 700; letter-spacing: 6px;">
        ${code}
      </div>
      <p>This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <p>${brandName} Support</p>
    </div>
  `;

  return sendEmail({ to, subject, html, text });
}

module.exports = {
  sendEmail,
  sendPasswordResetOtpEmail,
};
