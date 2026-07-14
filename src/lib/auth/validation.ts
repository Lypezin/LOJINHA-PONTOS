import { z } from "zod";
import { isStrongPassword, isValidCpf, normalizeCpf, normalizeEmail } from "@/lib/auth/identity";

const emailSchema = z
  .string({ error: "Informe seu e-mail." })
  .trim()
  .min(1, "Informe seu e-mail.")
  .max(254, "O e-mail é muito longo.")
  .transform(normalizeEmail)
  .pipe(z.string().email("Informe um e-mail válido."));

const passwordSchema = z
  .string({ error: "Informe sua senha." })
  .refine(isStrongPassword, "Use 8 a 72 caracteres, com pelo menos uma letra e um número.");

export const registerSchema = z
  .object({
    cpf: z
      .string({ error: "Informe seu CPF." })
      .transform(normalizeCpf)
      .refine(isValidCpf, "Informe um CPF válido."),
    activationCode: z
      .string({ error: "Informe seu código de ativação." })
      .trim()
      .min(6, "Informe o código fornecido pela empresa.")
      .max(20, "Código de ativação inválido.")
      .transform((value) => value.toUpperCase()),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    identifier: z
      .string({ error: "Informe seu e-mail ou CPF." })
      .trim()
      .min(1, "Informe seu e-mail ou CPF.")
      .max(254, "O identificador é muito longo.")
      .transform((value) => (value.includes("@") ? normalizeEmail(value) : normalizeCpf(value)))
      .refine(
        (value) => isValidCpf(value) || z.string().email().safeParse(value).success,
        "Informe um e-mail ou CPF válido.",
      ),
    password: z.string({ error: "Informe sua senha." }).min(1, "Informe sua senha.").max(200),
  })
  .strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z
  .object({
    token: z.string({ error: "Link inválido." }).min(32, "Link inválido.").max(512, "Link inválido."),
    password: passwordSchema,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: "Informe sua senha atual." }).min(1).max(200),
    password: passwordSchema,
  })
  .strict();
