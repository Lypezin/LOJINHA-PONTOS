import "server-only";
import type { Prisma } from "@prisma/client";
import { cache } from "react";
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

const activeCityKeysForRequest = cache(async () => {
  const setting = await db.systemSetting.findUnique({ where: { key: CITY_SETTING_KEY }, select: { value: true } });
  return activeCityKeys(setting?.value);
});

export async function cityIsActive(city: string | null | undefined, client?: Prisma.TransactionClient) {
  const key = normalizeName(city);
  if (!key) return false;
  if (!client) return (await activeCityKeysForRequest()).includes(key);
  const setting = await client.systemSetting.findUnique({ where: { key: CITY_SETTING_KEY }, select: { value: true } });
  return activeCityKeys(setting?.value).includes(key);
}
