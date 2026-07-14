import { describe, expect, it, vi } from "vitest";
import { retryDatabaseRead } from "@/lib/db";

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