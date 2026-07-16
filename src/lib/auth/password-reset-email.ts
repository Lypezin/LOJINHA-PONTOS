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
  const text = `Olá, ${firstName}!\n\nRecebemos uma solicitação para redefinir a senha da sua conta na Lojinha EntreGÔ.\n\nCrie uma nova senha acessando:\n${input.resetUrl}\n\nEste link expira em 1 hora e só pode ser usado uma vez.\n\nSe você não solicitou a alteração, ignore este e-mail. Sua senha continuará a mesma.\n\nEquipe Lojinha EntreGÔ`;
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#334155;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Seu link seguro para criar uma nova senha expira em 1 hora.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f1f5f9;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td style="padding:0 8px 16px;text-align:center;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#64748b;">
                Segurança da sua conta
              </td>
            </tr>
            <tr>
              <td style="overflow:hidden;border:1px solid #dbe3ef;border-radius:20px;background-color:#ffffff;box-shadow:0 12px 32px rgba(12,25,56,0.08);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:28px 32px;background-color:#0c1938;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;border-radius:14px;background-color:#1a56db;color:#ffffff;font-size:23px;font-weight:800;line-height:48px;">E</td>
                          <td style="padding-left:14px;">
                            <div style="font-size:20px;font-weight:800;line-height:1.2;color:#ffffff;">Lojinha EntreGÔ</div>
                            <div style="padding-top:4px;font-size:12px;font-weight:600;line-height:1.4;color:#bfdbfe;">Pontos que valorizam sua jornada</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="height:5px;background-color:#1a56db;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:40px 40px 24px;">
                      <div style="display:inline-block;padding:7px 11px;border-radius:999px;background-color:#eff6ff;font-size:11px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#1a56db;">Redefinição de senha</div>
                      <h1 style="margin:20px 0 12px;font-size:28px;line-height:1.25;letter-spacing:-0.5px;color:#0c1938;">Olá, ${safeName}!</h1>
                      <p style="margin:0;font-size:16px;line-height:1.7;color:#475569;">Recebemos uma solicitação para criar uma nova senha para sua conta. Clique no botão abaixo para continuar com segurança.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 40px 28px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" style="border-radius:12px;background-color:#1a56db;box-shadow:0 8px 18px rgba(26,86,219,0.25);">
                            <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:15px 24px;border-radius:12px;font-size:15px;font-weight:800;line-height:1;color:#ffffff;text-decoration:none;">Criar nova senha&nbsp;&nbsp;→</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 40px 32px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #fde68a;border-radius:14px;background-color:#fffbeb;">
                        <tr>
                          <td width="42" valign="top" style="padding:16px 0 16px 16px;font-size:20px;">⏱</td>
                          <td style="padding:16px;font-size:13px;line-height:1.6;color:#78350f;"><strong style="color:#92400e;">Este link expira em 1 hora</strong><br>Por segurança, ele só pode ser utilizado uma vez.</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 40px;border-top:1px solid #e2e8f0;background-color:#f8fafc;">
                      <p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#64748b;">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
                      <p style="margin:0;word-break:break-all;font-size:11px;line-height:1.6;color:#1a56db;"><a href="${safeUrl}" style="color:#1a56db;text-decoration:underline;">${safeUrl}</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 0;text-align:center;font-size:12px;line-height:1.6;color:#64748b;">
                Se você não solicitou esta alteração, ignore este e-mail.<br>Sua senha continuará a mesma e nenhuma ação será necessária.
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px 0;text-align:center;font-size:11px;color:#94a3b8;">© ${new Date().getUTCFullYear()} Lojinha EntreGÔ</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

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
