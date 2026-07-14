import { describe, expect, it, vi } from "vitest";
import { normalizeRuntimeDatabaseUrl, retryDatabaseRead } from "@/lib/db";

describe("normalizeRuntimeDatabaseUrl", () => {
  it("converte a conexao direta do projeto para o pooler transacional correto", () => {
    const result = normalizeRuntimeDatabaseUrl(
      "postgresql://postgres:secret@db.cpidpqnstchvcozijczf.supabase.co:5432/postgres",
    );
    const url = new URL(result!);

    expect(url.hostname).toBe("aws-1-sa-east-1.pooler.supabase.com");
    expect(url.port).toBe("6543");
    expect(decodeURIComponent(url.username)).toBe("postgres.cpidpqnstchvcozijczf");
    expect(url.password).toBe("secret");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("pgbouncer")).toBe("true");
    expect(url.searchParams.get("connection_limit")).toBe("1");
    expect(url.searchParams.get("pool_timeout")).toBe("20");
  });

  it("corrige o host pooler antigo sem alterar as credenciais", () => {
    const result = normalizeRuntimeDatabaseUrl(
      "postgresql://postgres.cpidpqnstchvcozijczf:secret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?connection_limit=8",
    );
    const url = new URL(result!);

    expect(url.hostname).toBe("aws-1-sa-east-1.pooler.supabase.com");
    expect(url.password).toBe("secret");
    expect(url.searchParams.get("connection_limit")).toBe("1");
  });

  it("preserva URLs de outros bancos e valores invalidos", () => {
    const other = "postgresql://postgres:secret@example.com:5432/postgres";

    expect(normalizeRuntimeDatabaseUrl(other)).toBe(other);
    expect(normalizeRuntimeDatabaseUrl("not-a-url")).toBe("not-a-url");
    expect(normalizeRuntimeDatabaseUrl(undefined)).toBeUndefined();
  });
});

describe("retryDatabaseRead", () => {
  it("repete uma leitura uma vez quando a conexão TLS falha transitoriamente", async () => {
    const query = vi.fn()
      .mockRejectedValueOnce(new Error("Error opening a TLS connection"))
      .mockResolvedValueOnce("ok");

    await expect(retryDatabaseRead(query)).resolves.toBe("ok");
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("não repete erros que não são de conexão", async () => {
    const query = vi.fn().mockRejectedValue(new Error("validation failed"));

    await expect(retryDatabaseRead(query)).rejects.toThrow("validation failed");
    expect(query).toHaveBeenCalledTimes(1);
  });
});
