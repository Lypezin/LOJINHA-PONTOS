import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeName } from "@/features/imports/normalization";

export const CITY_SETTING_KEY = "store.activeCities";
export const CITY_UNAVAILABLE_MESSAGE = "A Lojinha ainda não está disponível na sua cidade. Fale com a equipe responsável para mais informações.";

export function activeCityKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["SAO PAULO"];
  const cities = (value as { cities?: unknown }).cities;
  if (!Array.isArray(cities) || !cities.every((city) => typeof city === "string")) return ["SAO PAULO"];
  return cities.map(normalizeName).filter(Boolean);
}

export async function cityIsActive(city: string | null | undefined, client: Prisma.TransactionClient = db) {
  const key = normalizeName(city);
  if (!key) return false;
  const setting = await client.systemSetting.findUnique({ where: { key: CITY_SETTING_KEY }, select: { value: true } });
  return activeCityKeys(setting?.value).includes(key);
}
