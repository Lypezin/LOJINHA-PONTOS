import { PrismaClient, ProductStatus, UserRole, CourierStatus } from "@prisma/client";
import { compare, hash } from "bcryptjs";

const db = new PrismaClient();

function currentPeriod() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    key,
    year,
    month,
    startsAt: new Date(`${key}-01T00:00:00-03:00`),
    endsAt: new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-03:00`),
  };
}

async function main() {
  const production = process.env.NODE_ENV === "production";
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@lojinha.local").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "TroqueAgora#2026";
  if (production && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || adminPassword === "TroqueAgora#2026")) {
    throw new Error("Defina ADMIN_EMAIL e uma ADMIN_PASSWORD exclusiva antes de executar o seed em produção.");
  }
  const adminHash = await hash(adminPassword, 12);
  const existingAdmin = await db.user.findUnique({
    where: { emailNormalized: adminEmail },
    select: { id: true, passwordHash: true },
  });
  const stillUsesBootstrapPassword = existingAdmin
    ? await compare("TroqueAgora#2026", existingAdmin.passwordHash)
    : false;
  const rotateAdminPassword = process.env.ROTATE_ADMIN_PASSWORD === "true" || (production && stillUsesBootstrapPassword);

  const admin = await db.user.upsert({
    where: { emailNormalized: adminEmail },
    update: {
      active: true,
      role: UserRole.ADMIN,
      ...(rotateAdminPassword ? { passwordHash: adminHash, mustChangePassword: true } : {}),
    },
    create: {
      email: adminEmail,
      emailNormalized: adminEmail,
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      active: true,
      mustChangePassword: true,
    },
  });
  if (rotateAdminPassword) await db.session.deleteMany({ where: { userId: admin.id } });
  if (production && adminEmail !== "admin@lojinha.local") {
    const legacyAdmin = await db.user.findUnique({
      where: { emailNormalized: "admin@lojinha.local" },
      select: { id: true },
    });
    if (legacyAdmin) {
      await db.session.deleteMany({ where: { userId: legacyAdmin.id } });
      await db.user.update({ where: { id: legacyAdmin.id }, data: { active: false } });
    }
  }

  const settings = [
    {
      key: "points.defaultColumn",
      value: { letter: "R", index: 18, header: "numero_de_pedidos_aceitos_e_concluidos" },
      description: "Coluna usada como pontos ao abrir uma nova importação.",
    },
    {
      key: "points.expirationPolicy",
      value: { type: "MONTHLY", timezone: "America/Sao_Paulo" },
      description: "Saldo válido somente durante a competência mensal.",
    },
    {
      key: "store.profile",
      value: { name: "Lojinha EntreGô", supportEmail: adminEmail },
      description: "Identidade e contato principal da loja.",
    },
  ];

  for (const setting of settings) {
    await db.systemSetting.upsert({
      where: { key: setting.key },
      update: { description: setting.description },
      create: { ...setting, updatedById: admin.id },
    });
  }

  const products = [
    {
      slug: "mochila-termica-azul",
      name: "Mochila térmica",
      description: "Espaçosa, resistente à água e preparada para a rotina de entregas.",
      category: "Equipamentos",
      pointsCost: 180,
      referenceValueCents: 18990,
      stockQuantity: 25,
      featured: true,
      sortOrder: 1,
    },
    {
      slug: "capacete-urbano",
      name: "Capacete urbano",
      description: "Proteção confortável com ajuste preciso e ventilação para o dia todo.",
      category: "Segurança",
      pointsCost: 320,
      referenceValueCents: 27990,
      stockQuantity: 14,
      featured: true,
      sortOrder: 2,
    },
    {
      slug: "capa-de-chuva",
      name: "Capa de chuva",
      description: "Conjunto leve e impermeável para continuar rodando com conforto.",
      category: "Equipamentos",
      pointsCost: 120,
      referenceValueCents: 9990,
      stockQuantity: 38,
      featured: true,
      sortOrder: 3,
    },
    {
      slug: "garrafa-termica",
      name: "Garrafa térmica",
      description: "Mantém a bebida na temperatura certa durante todo o turno.",
      category: "Dia a dia",
      pointsCost: 75,
      referenceValueCents: 6490,
      stockQuantity: 42,
      featured: false,
      sortOrder: 4,
    },
    {
      slug: "suporte-para-celular",
      name: "Suporte para celular",
      description: "Fixação firme e ajuste rápido para acompanhar suas rotas.",
      category: "Acessórios",
      pointsCost: 95,
      referenceValueCents: 7990,
      stockQuantity: 31,
      featured: false,
      sortOrder: 5,
    },
    {
      slug: "vale-combustivel",
      name: "Vale combustível",
      description: "Crédito para ajudar a manter a rotina de entregas em movimento.",
      category: "Benefícios",
      pointsCost: 250,
      referenceValueCents: 20000,
      stockQuantity: 50,
      maxPerCourierPerPeriod: 1,
      featured: false,
      sortOrder: 6,
    },
  ];

  for (const product of products) {
    await db.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: { ...product, status: ProductStatus.ACTIVE, createdById: admin.id },
    });
  }

  if (production && process.env.SEED_DEMO_DATA === "true") {
    throw new Error("SEED_DEMO_DATA não pode ser true em produção.");
  }
  const seedDemoData = !production && process.env.SEED_DEMO_DATA !== "false";
  if (seedDemoData) {
    const courier = await db.courier.upsert({
      where: { externalCourierId: "demo-courier-001" },
      update: {
        cnpj: "11222333000181",
        cnpjMatchStatus: "MANUAL_MATCHED",
        cnpjMatchScore: 1,
        status: CourierStatus.ACTIVE,
      },
      create: {
        externalCourierId: "demo-courier-001",
        name: "Entregador Demonstração",
        normalizedName: "ENTREGADOR DEMONSTRACAO",
        cnpj: "11222333000181",
        cnpjMatchStatus: "MANUAL_MATCHED",
        cnpjMatchScore: 1,
        status: CourierStatus.ACTIVE,
        plaza: "São Paulo",
      },
    });

    const demoEmail = "entregador@demo.local";
    await db.user.upsert({
      where: { emailNormalized: demoEmail },
      update: { active: true },
      create: {
        email: demoEmail,
        emailNormalized: demoEmail,
        passwordHash: await hash("Demo@12345", 12),
        role: UserRole.COURIER,
        courierId: courier.id,
      },
    });

    const definition = currentPeriod();
    const period = await db.monthlyPeriod.upsert({
      where: { key: definition.key },
      update: {},
      create: definition,
    });

    await db.pointAccount.upsert({
      where: { courierId_periodId: { courierId: courier.id, periodId: period.id } },
      update: {},
      create: {
        courierId: courier.id,
        periodId: period.id,
        importedPoints: 500,
        balancePoints: 500,
        entries: {
          create: {
            type: "IMPORT_CREDIT",
            amount: 500,
            balanceAfter: 500,
            description: "Crédito de demonstração da competência",
          },
        },
      },
    });
  } else {
    const demoUser = await db.user.findUnique({
      where: { emailNormalized: "entregador@demo.local" },
      select: { id: true, courierId: true },
    });
    if (demoUser) {
      await db.session.deleteMany({ where: { userId: demoUser.id } });
      await db.user.update({ where: { id: demoUser.id }, data: { active: false } });
      if (demoUser.courierId) {
        await db.courier.update({ where: { id: demoUser.courierId }, data: { status: CourierStatus.INACTIVE } });
      }
    }
  }

  console.log(`Admin: ${adminEmail}`);
  console.log("Dados iniciais prontos. Troque a senha administrativa no primeiro uso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
