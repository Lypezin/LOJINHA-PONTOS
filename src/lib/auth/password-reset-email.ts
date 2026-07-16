import "server-only";
import nodemailer from "nodemailer";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendPasswordResetEmail(input: {
  to: string;
  courierName: string | null;
  resetUrl: string;
}) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPassword && from);
  const resendConfigured = Boolean(apiKey && from);
  if (!smtpConfigured && !resendConfigured) return { configured: false, sent: false };

  const firstName = input.courierName?.trim().split(/\s+/)[0] || "entregador";
  const safeName = escapeHtml(firstName);
  const safeUrl = escapeHtml(input.resetUrl);
  const subject = "Redefina sua senha da Lojinha EntreGÔ";
  const text = `Olá, ${firstName}. Use este link para criar uma nova senha: ${input.resetUrl}\n\nO link expira em 1 hora. Se você não fez este pedido, ignore este e-mail.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#0f1849;line-height:1.6"><h1 style="font-size:24px">Crie uma nova senha</h1><p>Olá, ${safeName}.</p><p>Recebemos um pedido para redefinir sua senha da Lojinha EntreGÔ.</p><p><a href="${safeUrl}" style="display:inline-block;background:#2c67ea;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700">Redefinir senha</a></p><p>O link expira em 1 hora e só pode ser usado uma vez.</p><p>Se você não fez este pedido, ignore este e-mail.</p></div>`;

  try {
    if (smtpConfigured) {
      const port = Number(process.env.SMTP_PORT ?? "465");
      const secure = process.env.SMTP_SECURE !== "false";
      const transporter = nodemailer.createTransport({
        host: smtpHost!,
        port,
        secure,
        auth: { user: smtpUser!, pass: smtpPassword! },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
      await transporter.sendMail({ from, to: input.to, subject, text, html });
      transporter.close();
      return { configured: true, sent: true };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`[auth:email] Resend respondeu com status ${response.status}.`);
      return { configured: true, sent: false };
    }

    return { configured: true, sent: true };
  } catch {
    const provider = smtpConfigured ? "SMTP" : "Resend";
    console.error(`[auth:email] ${provider} não conseguiu enviar a recuperação de senha.`);
    return { configured: true, sent: false };
  }
}
