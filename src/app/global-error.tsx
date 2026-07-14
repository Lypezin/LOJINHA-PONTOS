"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#f4f7fb", color: "#0f1849", fontFamily: 'Inter, "Segoe UI", Arial, sans-serif' }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ width: "100%", maxWidth: 520, border: "1px solid #fecaca", borderRadius: 20, background: "white", padding: 32, textAlign: "center", boxShadow: "0 8px 30px rgba(15, 24, 73, 0.08)" }}>
            <p style={{ margin: 0, color: "#b91c1c", fontWeight: 800 }}>Falha temporária</p>
            <h1 style={{ margin: "12px 0 0", fontSize: 26 }}>Não foi possível abrir a aplicação</h1>
            <p style={{ margin: "12px 0 0", color: "#475569", lineHeight: 1.6 }}>Tente novamente. Se o problema continuar, informe a referência abaixo à equipe responsável.</p>
            {error.digest ? <p style={{ margin: "16px 0 0", color: "#64748b", fontSize: 12 }}>Referência: <strong>{error.digest}</strong></p> : null}
            <button type="button" onClick={reset} style={{ marginTop: 24, minHeight: 44, border: 0, borderRadius: 999, background: "#2c67ea", color: "white", padding: "0 22px", fontWeight: 800, cursor: "pointer" }}>Tentar novamente</button>
          </section>
        </main>
      </body>
    </html>
  );
}