import { basename } from "node:path";

import { DomainError } from "@/lib/domain-error";

export const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_IMPORT_REQUEST_SIZE = 21 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 2_000;
const MAX_UNCOMPRESSED_SIZE = 200 * 1024 * 1024;
const ZIP_CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;
const MAX_ZIP_COMMENT_SIZE = 65_535;

export interface ImportUpload {
  buffer: Buffer;
  filename: string;
  periodKey: string | null;
  pointsColumn: string | number | null;
}

function invalidArchive(): never {
  throw new DomainError(
    "O conteúdo enviado não é uma planilha .xlsx válida ou excede os limites permitidos.",
    "INVALID_XLSX_ARCHIVE",
    415,
  );
}

export function validateXlsxArchive(buffer: Buffer) {
  const minimumEndRecordSize = 22;
  const searchStart = Math.max(
    0,
    buffer.length - minimumEndRecordSize - MAX_ZIP_COMMENT_SIZE,
  );
  let endOffset = -1;
  for (let offset = buffer.length - minimumEndRecordSize; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) !== ZIP_END_SIGNATURE) continue;
    const commentLength = buffer.readUInt16LE(offset + 20);
    if (offset + minimumEndRecordSize + commentLength === buffer.length) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) invalidArchive();

  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(endOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0 ||
    entryCount === 0xffff ||
    entryCount > MAX_ARCHIVE_ENTRIES ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff ||
    centralOffset + centralSize > endOffset
  ) {
    invalidArchive();
  }

  let cursor = centralOffset;
  let uncompressedTotal = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > buffer.length) invalidArchive();
    if (buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_HEADER_SIGNATURE) invalidArchive();
    const flags = buffer.readUInt16LE(cursor + 8);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const filenameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    if (
      (flags & 0x1) !== 0 ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff
    ) {
      invalidArchive();
    }
    uncompressedTotal += uncompressedSize;
    if (uncompressedTotal > MAX_UNCOMPRESSED_SIZE) invalidArchive();
    cursor += 46 + filenameLength + extraLength + commentLength;
    if (cursor > centralOffset + centralSize) invalidArchive();
  }
  if (cursor !== centralOffset + centralSize) invalidArchive();
}

export async function readImportUpload(request: Request): Promise<ImportUpload> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMPORT_REQUEST_SIZE) {
    throw new DomainError(
      "O upload completo deve ter no máximo 21 MB.",
      "INVALID_REQUEST_SIZE",
      413,
    );
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new DomainError(
      "Envie a planilha como multipart/form-data.",
      "INVALID_UPLOAD_CONTENT_TYPE",
      415,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new DomainError("Não foi possível ler o upload.", "INVALID_UPLOAD", 400);
  }

  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) {
    throw new DomainError("Selecione um arquivo .xlsx.", "FILE_REQUIRED", 422);
  }
  const filename = basename(fileValue.name.replace(/\\/g, "/")).slice(0, 255);
  if (!filename.toLowerCase().endsWith(".xlsx")) {
    throw new DomainError(
      "Formato não permitido. Envie somente um arquivo .xlsx.",
      "INVALID_FILE_TYPE",
      415,
    );
  }
  if (fileValue.size <= 0 || fileValue.size > MAX_IMPORT_FILE_SIZE) {
    throw new DomainError(
      "A planilha deve ter até 20 MB e não pode estar vazia.",
      "INVALID_FILE_SIZE",
      413,
    );
  }

  const buffer = Buffer.from(await fileValue.arrayBuffer());
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new DomainError(
      "O conteúdo enviado não é uma planilha .xlsx válida.",
      "INVALID_FILE_TYPE",
      415,
    );
  }
  validateXlsxArchive(buffer);

  const periodValue = formData.get("periodKey");
  const pointsValue = formData.get("pointsColumn");
  return {
    buffer,
    filename,
    periodKey: typeof periodValue === "string" && periodValue.trim() ? periodValue.trim() : null,
    pointsColumn:
      typeof pointsValue === "string" && pointsValue.trim() ? pointsValue.trim() : null,
  };
}
