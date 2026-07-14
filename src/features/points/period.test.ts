import { describe, expect, it } from "vitest";
import { periodDefinition, periodKeyForDate } from "@/features/points/period";

describe("competência mensal", () => {
  it("usa o fuso de São Paulo na virada do mês", () => {
    expect(periodKeyForDate(new Date("2026-08-01T01:30:00.000Z"))).toBe("2026-07");
    expect(periodKeyForDate(new Date("2026-08-01T03:30:00.000Z"))).toBe("2026-08");
  });

  it("calcula limites inclusive/exclusivo da competência", () => {
    const july = periodDefinition("2026-07");
    expect(july.year).toBe(2026);
    expect(july.month).toBe(7);
    expect(july.startsAt.toISOString()).toBe("2026-07-01T03:00:00.000Z");
    expect(july.endsAt.toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });

  it("rejeita competência inválida", () => {
    expect(() => periodDefinition("2026-13")).toThrow("Competência inválida");
  });
});
