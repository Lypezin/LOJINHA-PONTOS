import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/lib/domain-error";

export function apiError(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Revise os campos informados.", code: "VALIDATION_ERROR", fields: error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: "Não foi possível concluir a operação. Tente novamente.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
