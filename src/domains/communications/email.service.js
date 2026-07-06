const crypto = require('crypto');
const net = require('net');
const tls = require('tls');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { ValidationError } = require('../../utils/errors');

function getBrandName() {
  return String(env.MAIL_FROM_NAME || 'Ajicore').trim() || 'Ajicore';
}

function getFrontendUrl() {
  return String(env.APP_FRONTEND_URL || env.BACKEND_URL || 'http://localhost:3000').trim();
}

function providerName() {
  return String(env.MAIL_PROVIDER || '').trim().toLowerCase();
}

function formatCurrency(amount) {
  const numeric = Number(amount || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(env.STRIPE_CURRENCY || 'usd').toUpperCase(),
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function ensureMailConfigured() {
  if (!['smtp', 'gmail', 'google'].includes(providerName())) {
    throw new ValidationError('Email delivery is not configured on this server.');
  }

  if (!env.SMTP_USER || !env.SMTP_PASS || !env.MAIL_FROM_EMAIL) {
    throw new ValidationError('SMTP settings are incomplete on this server.');
  }

  if (!env.SMTP_HOST || !env.SMTP_PORT) {
    throw new ValidationError('SMTP host and port are required on this server.');
  }
}

function normalizeAddress(value) {
  return String(value || '').trim();
}

function encodeHeader(value) {
  return String(value || '').replace(/\r?\n/g, ' ').trim();
}

function chunkBase64(value) {
  return String(value || '').match(/.{1,76}/g)?.join('\r\n') || '';
}

function buildMimeMessage({ to, subject, html, text, attachments }) {
  const messageId = `<${crypto.randomUUID()}@${normalizeAddress(env.MAIL_FROM_EMAIL).split('@')[1] || 'myajicore.com'}>`;
  const date = new Date().toUTCString();
  const safeText = String(text || '').replace(/\r?\n/g, '\r\n');
  const safeHtml = String(html || '').replace(/\r?\n/g, '\r\n');
  const safeAttachments = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  const boundaryAlternative = `alt_${crypto.randomBytes(12).toString('hex')}`;
  const boundaryMixed = `mix_${crypto.randomBytes(12).toString('hex')}`;

  const headers = [
    `From: "${encodeHeader(getBrandName())}" <${normalizeAddress(env.MAIL_FROM_EMAIL)}>`,
    `To: ${normalizeAddress(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
  ];

  const alternativeParts = [
    `--${boundaryAlternative}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    safeText,
    `--${boundaryAlternative}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    safeHtml,
    `--${boundaryAlternative}--`,
  ].join('\r\n');

  if (safeAttachments.length === 0) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundaryAlternative}"`);
    return `${headers.join('\r\n')}\r\n\r\n${alternativeParts}\r\n`;
  }

  const attachmentParts = safeAttachments.map((attachment) => {
    const contentBuffer = Buffer.isBuffer(attachment.content)
      ? attachment.content
      : Buffer.from(String(attachment.content || ''), 'utf8');

    return [
      `--${boundaryMixed}`,
      `Content-Type: ${attachment.contentType || 'application/octet-stream'}; name="${encodeHeader(attachment.filename || 'attachment.bin')}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${encodeHeader(attachment.filename || 'attachment.bin')}"`,
      '',
      chunkBase64(contentBuffer.toString('base64')),
    ].join('\r\n');
  }).join('\r\n');

  headers.push(`Content-Type: multipart/mixed; boundary="${boundaryMixed}"`);

  const mixedBody = [
    `--${boundaryMixed}`,
    `Content-Type: multipart/alternative; boundary="${boundaryAlternative}"`,
    '',
    alternativeParts,
    attachmentParts,
    `--${boundaryMixed}--`,
    '',
  ].join('\r\n');

  return `${headers.join('\r\n')}\r\n\r\n${mixedBody}`;
}

function dotStuff(message) {
  return String(message || '').replace(/^\./gm, '..');
}

function createResponseReader(socket) {
  let buffer = '';
  let pending = [];
  let queued = [];
  let currentLines = [];

  function deliver(response) {
    if (pending.length > 0) {
      const resolver = pending.shift();
      resolver(response);
      return;
    }
    queued.push(response);
  }

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let newlineIndex = buffer.indexOf('\r\n');

    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 2);
      currentLines.push(line);

      if (/^\d{3} /.test(line)) {
        const response = {
          code: Number(line.slice(0, 3)),
          lines: [...currentLines],
          text: currentLines.join('\n'),
        };
        currentLines = [];
        deliver(response);
      }

      newlineIndex = buffer.indexOf('\r\n');
    }
  });

  return {
    next() {
      if (queued.length > 0) {
        return Promise.resolve(queued.shift());
      }

      return new Promise((resolve) => {
        pending.push(resolve);
      });
    },
  };
}

function openSocket() {
  ensureMailConfigured();

  const options = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
  };

  if (env.SMTP_SECURE) {
    return tls.connect({
      ...options,
      servername: env.SMTP_HOST,
    });
  }

  return net.connect(options);
}

async function sendSmtpCommand(socket, reader, command, expectedCodes) {
  if (command) {
    socket.write(command);
  }

  const response = await reader.next();
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command failed (${response.code}): ${response.text}`);
  }
  return response;
}

async function withSmtpSession(callback) {
  const socket = openSocket();
  const reader = createResponseReader(socket);

  await new Promise((resolve, reject) => {
    socket.once('secureConnect', resolve);
    socket.once('connect', resolve);
    socket.once('error', reject);
  });

  try {
    await sendSmtpCommand(socket, reader, null, [220]);
    await sendSmtpCommand(socket, reader, `EHLO ${env.SMTP_HOST}\r\n`, [250]);
    await sendSmtpCommand(socket, reader, 'AUTH LOGIN\r\n', [334]);
    await sendSmtpCommand(socket, reader, `${Buffer.from(env.SMTP_USER, 'utf8').toString('base64')}\r\n`, [334]);
    await sendSmtpCommand(socket, reader, `${Buffer.from(env.SMTP_PASS, 'utf8').toString('base64')}\r\n`, [235]);

    const result = await callback({ socket, reader });
    await sendSmtpCommand(socket, reader, 'QUIT\r\n', [221]);
    socket.end();
    return result;
  } catch (err) {
    socket.destroy();
    throw err;
  }
}

async function verifyTransport() {
  try {
    await withSmtpSession(async () => true);
    return true;
  } catch (err) {
    logger.error(`SMTP verification failed: ${err.message}`);
    throw new ValidationError('Unable to connect to the configured mail server.');
  }
}

async function sendEmail({ to, subject, html, text, attachments }) {
  if (!to) {
    throw new ValidationError('Recipient email address is required.');
  }

  const rawMessage = dotStuff(buildMimeMessage({ to, subject, html, text, attachments }));

  try {
    await withSmtpSession(async ({ socket, reader }) => {
      await sendSmtpCommand(socket, reader, `MAIL FROM:<${normalizeAddress(env.MAIL_FROM_EMAIL)}>\r\n`, [250]);
      await sendSmtpCommand(socket, reader, `RCPT TO:<${normalizeAddress(to)}>\r\n`, [250, 251]);
      await sendSmtpCommand(socket, reader, 'DATA\r\n', [354]);
      socket.write(`${rawMessage}\r\n.\r\n`);
      await sendSmtpCommand(socket, reader, null, [250]);
      return true;
    });

    return { accepted: [to] };
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

async function sendStaffInviteEmail({ to, name, temporaryPassword }) {
  const greetingName = String(name || '').trim();
  const greeting = greetingName ? `Hello ${greetingName},` : 'Hello,';
  const brandName = getBrandName();
  const appUrl = getFrontendUrl();
  const subject = `You have been invited to join ${brandName}`;

  const text = [
    greeting,
    '',
    `You have been added to ${brandName} as a staff member.`,
    '',
    'Use the credentials below to sign in:',
    `Email: ${to}`,
    `Temporary password: ${temporaryPassword}`,
    '',
    `Sign in here: ${appUrl}`,
    '',
    'Please change your password after signing in.',
    '',
    `${brandName} Support`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <p>${greeting}</p>
      <p>You have been added to <strong>${brandName}</strong> as a staff member.</p>
      <p>Use the credentials below to sign in:</p>
      <div style="margin: 24px 0; padding: 16px; background: #f3f4f6; border-radius: 8px;">
        <p style="margin: 0 0 8px;"><strong>Email:</strong> ${to}</p>
        <p style="margin: 0;"><strong>Temporary password:</strong> ${temporaryPassword}</p>
      </div>
      <p><a href="${appUrl}" style="display: inline-block; padding: 12px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;">Open Ajicore</a></p>
      <p>Please change your password after signing in.</p>
      <p>${brandName} Support</p>
    </div>
  `;

  return sendEmail({ to, subject, html, text });
}

async function sendQuoteNotificationEmail({
  to,
  customerName,
  businessName,
  serviceName,
  totalAmount,
  notes,
  isEstimateAppointment,
  assignedStaffName,
  scheduledStartTime,
  scheduledEstimateDate,
  scheduledEstimateTime,
}) {
  const recipient = String(customerName || '').trim() || 'there';
  const brandName = String(businessName || getBrandName()).trim() || getBrandName();
  const subject = isEstimateAppointment
    ? `${brandName}: Your estimate appointment details`
    : `${brandName}: Your quote is ready`;

  const scheduleLine = scheduledStartTime
    ? new Date(scheduledStartTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : [scheduledEstimateDate, scheduledEstimateTime].filter(Boolean).join(' at ');

  const textLines = [
    `Hello ${recipient},`,
    '',
    isEstimateAppointment
      ? `Your estimate appointment for ${serviceName || 'your service request'} has been scheduled.`
      : `Your quote for ${serviceName || 'your service request'} is ready.`,
  ];

  if (isEstimateAppointment && scheduleLine) {
    textLines.push(`Scheduled time: ${scheduleLine}`);
  }
  if (isEstimateAppointment && assignedStaffName) {
    textLines.push(`Assigned technician: ${assignedStaffName}`);
  }
  if (!isEstimateAppointment) {
    textLines.push(`Quoted total: ${formatCurrency(totalAmount)}`);
  }
  if (notes) {
    textLines.push('', `Notes: ${notes}`);
  }
  textLines.push('', `${brandName} Support`);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <p>Hello ${recipient},</p>
      <p>${isEstimateAppointment
        ? `Your estimate appointment for <strong>${serviceName || 'your service request'}</strong> has been scheduled.`
        : `Your quote for <strong>${serviceName || 'your service request'}</strong> is ready.`}</p>
      <div style="margin: 24px 0; padding: 16px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px;">
        ${isEstimateAppointment && scheduleLine ? `<p style="margin: 0 0 8px;"><strong>Scheduled time:</strong> ${scheduleLine}</p>` : ''}
        ${isEstimateAppointment && assignedStaffName ? `<p style="margin: 0 0 8px;"><strong>Assigned technician:</strong> ${assignedStaffName}</p>` : ''}
        ${!isEstimateAppointment ? `<p style="margin: 0;"><strong>Quoted total:</strong> ${formatCurrency(totalAmount)}</p>` : ''}
      </div>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      <p>${brandName} Support</p>
    </div>
  `;

  return sendEmail({ to, subject, html, text: textLines.join('\n') });
}

async function sendInvoiceNotificationEmail({
  to,
  customerName,
  businessName,
  invoiceNumber,
  totalAmount,
  dueDate,
  status,
  notes,
}) {
  const recipient = String(customerName || '').trim() || 'there';
  const brandName = String(businessName || getBrandName()).trim() || getBrandName();
  const subject = `${brandName}: Invoice ${invoiceNumber || ''}`.trim();
  const dueDateText = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { dateStyle: 'medium' }) : 'N/A';

  const text = [
    `Hello ${recipient},`,
    '',
    `Your invoice${invoiceNumber ? ` ${invoiceNumber}` : ''} is ready.`,
    `Status: ${status || 'Sent'}`,
    `Total: ${formatCurrency(totalAmount)}`,
    `Due date: ${dueDateText}`,
    notes ? '' : null,
    notes ? `Notes: ${notes}` : null,
    '',
    `${brandName} Support`,
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <p>Hello ${recipient},</p>
      <p>Your invoice${invoiceNumber ? ` <strong>${invoiceNumber}</strong>` : ''} is ready.</p>
      <div style="margin: 24px 0; padding: 16px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px;">
        <p style="margin: 0 0 8px;"><strong>Status:</strong> ${status || 'Sent'}</p>
        <p style="margin: 0 0 8px;"><strong>Total:</strong> ${formatCurrency(totalAmount)}</p>
        <p style="margin: 0;"><strong>Due date:</strong> ${dueDateText}</p>
      </div>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      <p>${brandName} Support</p>
    </div>
  `;

  return sendEmail({ to, subject, html, text });
}

module.exports = {
  sendEmail,
  verifyTransport,
  sendPasswordResetOtpEmail,
  sendStaffInviteEmail,
  sendQuoteNotificationEmail,
  sendInvoiceNotificationEmail,
};
