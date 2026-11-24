import "server-only";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { MatchStatus, Prisma } from "@prisma/client";
import { normalizeName } from "@/features/imports/normalization";
import { cnpjStorageCandidates } from "@/lib/auth/identity";
import {
  AppSsoError,
  type AppSsoInput,
  buildAppSsoQueryString,
  cleanAppParam,
  hasAppSsoParams,
  parseAppSsoRequest,
  verifyAppSsoToken,
} from "@/lib/auth/app-sso-parser";
import { cityIsActive, CITY_UNAVAILABLE_MESSAGE } from "@/lib/city-access";
import { db } from "@/lib/db";

export {
  AppSsoError,
  type AppSsoInput,
  buildAppSsoQueryString,
  cleanAppParam,
  hasAppSsoParams,
  parseAppSsoRequest,
  verifyAppSsoToken,
};

const COURIER_SELECT = {
  id: true,
  externalCourierId: true,
  name: true,
  cnpj: true,
  cpf: true,
  cnpjMatchStatus: true,
  status: true,
  plaza: true,
  user: {
    select: {
      id: true,
      email: true,
      displayName: true,
      active: true,
    },
  },
} satisfies Prisma.CourierSelect;

type MatchedCourier = Prisma.CourierGetPayload<{ select: typeof COURIER_SELECT }>;

async function findCourierForApp(
  tx: Prisma.TransactionClient,
  input: AppSsoInput,
): Promise<MatchedCourier | null> {
  if (input.externalCourierId) {
    const byExternal = await tx.courier.findUnique({
      where: { externalCourierId: input.externalCourierId },
      select: COURIER_SELECT,
    });
    if (byExternal) return byExternal;
  }

  if (input.cnpj) {
    const byCnpj = await tx.courier.findFirst({
      where: { cnpj: { in: cnpjStorageCandidates(input.cnpj) } },
      select: COURIER_SELECT,
    });
    if (byCnpj) return byCnpj;
  }

  if (input.cpf) {
    const byCpf = await tx.courier.findUnique({
      where: { cpf: input.cpf },
      select: COURIER_SELECT,
    });
    if (byCpf) return byCpf;
  }

  return null;
}

export async function resolveAndProvisionAppCourier(input: AppSsoInput): Promise<{
  userId: string;
  courierId: string;
  provisioned: boolean;
}> {
  const randomPasswordSeed = randomBytes(32).toString("hex");
  const placeholderPasswordHash = await bcrypt.hash(randomPasswordSeed, 10);

  return db.$transaction(async (tx) => {
    let courier = await findCourierForApp(tx, input);
    let provisioned = false;

    if (courier) {
      if (courier.status === "INACTIVE") {
        throw new AppSsoError("COURIER_INACTIVE", "Cadastro de entregador inativo.", 403);
      }

      const resolvedPlaza = courier.plaza ?? input.city;
      if (!(await cityIsActive(resolvedPlaza, tx))) {
        throw new AppSsoError("CITY_UNAVAILABLE", CITY_UNAVAILABLE_MESSAGE, 403);
      }

      const updateData: Prisma.CourierUpdateInput = {};

      if (!courier.cpf && input.cpf) {
        const cpfTaken = await tx.courier.findUnique({
          where: { cpf: input.cpf },
          select: { id: true },
        });
        if (!cpfTaken) updateData.cpf = input.cpf;
      }

      if (!courier.externalCourierId && input.externalCourierId) {
        const externalTaken = await tx.courier.findUnique({
          where: { externalCourierId: input.externalCourierId },
          select: { id: true },
        });
        if (!externalTaken) updateData.externalCourierId = input.externalCourierId;
      }

      if (!courier.cnpj && input.cnpj) {
        const cnpjTaken = await tx.courier.findFirst({
          where: { cnpj: { in: cnpjStorageCandidates(input.cnpj) } },
          select: { id: true },
        });
        if (!cnpjTaken) {
          updateData.cnpj = input.cnpj;
          updateData.cnpjMatchStatus = MatchStatus.MANUAL_MATCHED;
        }
      }

      if (!courier.plaza && input.city) {
        updateData.plaza = input.city;
      }

      if (courier.status === "PENDING") {
        updateData.status = "ACTIVE";
      }

      if (Object.keys(updateData).length > 0) {
        courier = await tx.courier.update({
          where: { id: courier.id },
          data: updateData,
          select: COURIER_SELECT,
        });
      }
    } else {
      if (!(await cityIsActive(input.city, tx))) {
        throw new AppSsoError("CITY_UNAVAILABLE", CITY_UNAVAILABLE_MESSAGE, 403);
      }

      const resolvedName = input.name || "Entregador EntreGô";
      courier = await tx.courier.create({
        data: {
          externalCourierId: input.externalCourierId,
          cnpj: input.cnpj,
          cpf: input.cpf,
          name: resolvedName,
          normalizedName: normalizeName(resolvedName) || "ENTREGADOR ENTREGO",
          plaza: input.city,
          cnpjMatchStatus: input.cnpj ? MatchStatus.MANUAL_MATCHED : MatchStatus.PENDING,
          status: "ACTIVE",
          source: "APP_SSO",
        },
        select: COURIER_SELECT,
      });
      provisioned = true;
    }

    if (courier.user) {
      if (!courier.user.active) {
        throw new AppSsoError("USER_INACTIVE", "Conta de usuário inativa.", 403);
      }

      if (!courier.user.displayName && input.name) {
        await tx.user.update({
          where: { id: courier.user.id },
          data: { displayName: input.name },
        });
      }

      return { userId: courier.user.id, courierId: courier.id, provisioned };
    }

    let emailToUse = `app.${courier.id}@interno.entrego.local`;
    if (input.email) {
      const existingEmail = await tx.user.findUnique({
        where: { emailNormalized: input.email },
        select: { id: true },
      });
      if (!existingEmail) {
        emailToUse = input.email;
      }
    }

    const user = await tx.user.create({
      data: {
        email: emailToUse,
        emailNormalized: emailToUse,
        displayName: input.name ?? courier.name,
        passwordHash: placeholderPasswordHash,
        role: "COURIER",
        active: true,
        mustChangePassword: false,
        courierId: courier.id,
      },
      select: { id: true },
    });

    return { userId: user.id, courierId: courier.id, provisioned: true };
  });
}
