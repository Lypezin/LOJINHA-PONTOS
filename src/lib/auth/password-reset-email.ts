import "server-only";

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
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { configured: false, sent: false };

  const firstName = input.courierName?.trim().split(/\s+/)[0] || "entregador";
  const safeName = escapeHtml(firstName);
  const safeUrl = escapeHtml(input.resetUrl);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: "Redefina sua senha da Lojinha EntreGÔ",
        text: `Olá, ${firstName}. Use este link para criar uma nova senha: ${input.resetUrl}\n\nO link expira em 1 hora. Se você não fez este pedido, ignore este e-mail.`,
        html: `<div style="font-family:Arial,sans-serif;color:#0f1849;line-height:1.6"><h1 style="font-size:24px">Crie uma nova senha</h1><p>Olá, ${safeName}.</p><p>Recebemos um pedido para redefinir sua senha da Lojinha EntreGÔ.</p><p><a href="${safeUrl}" style="display:inline-block;background:#2c67ea;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700">Redefinir senha</a></p><p>O link expira em 1 hora e só pode ser usado uma vez.</p><p>Se você não fez este pedido, ignore este e-mail.</p></div>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`[auth:email] Resend respondeu com status ${response.status}.`);
      return { configured: true, sent: false };
    }

    return { configured: true, sent: true };
  } catch {
    console.error("[auth:email] Não foi possível enviar a recuperação de senha.");
    return { configured: true, sent: false };
  }
}
