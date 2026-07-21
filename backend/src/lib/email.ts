import { env } from '../config/env';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendAlertEmail(input: {
  to: string;
  title: string;
  message: string;
  link?: string | null;
  idempotencyKey: string;
}) {
  if (!env.resendApiKey) throw new Error('RESEND_API_KEY não configurada.');

  const appUrl = env.frontendUrl.split(',')[0].replace(/\/$/, '');
  const destination = input.link ? `${appUrl}${input.link}` : `${appUrl}/notificacoes`;
  return sendEmail({
    to: input.to,
    subject: `[SafeKitchen] ${input.title}`,
    idempotencyKey: input.idempotencyKey,
    html: `
      <div style="background:#f4f8f7;padding:32px;font-family:Arial,sans-serif;color:#102f35">
        <div style="max-width:600px;margin:auto;background:#fff;border-radius:20px;padding:28px;border:1px solid #dbe7e5">
          <div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#079982">SAFEKITCHEN SMART</div>
          <h1 style="font-size:24px;margin:12px 0">${escapeHtml(input.title)}</h1>
          <p style="font-size:16px;line-height:1.6;color:#425b60">${escapeHtml(input.message)}</p>
          <a href="${escapeHtml(destination)}" style="display:inline-block;margin-top:18px;background:#0bb89f;color:#fff;text-decoration:none;padding:13px 20px;border-radius:12px;font-weight:700">Abrir no SafeKitchen</a>
          <p style="margin-top:24px;font-size:12px;color:#718487">Você pode alterar os alertas em Notificações → Preferências.</p>
        </div>
      </div>
    `,
  });
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  attachments?: Array<{ filename: string; content: string }>;
}) {
  if (!env.resendApiKey) throw new Error('RESEND_API_KEY não configurada.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey.slice(0, 250),
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(String(body?.message || body?.name || `Resend HTTP ${response.status}`));
  }
  return body as { id?: string };
}
