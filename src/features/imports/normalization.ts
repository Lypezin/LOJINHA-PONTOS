const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^A-Z0-9]+/g;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_DATABASE_INT = 2_147_483_647;

const WINDOWS_1252_SPECIAL_BYTES = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);
const MOJIBAKE_SEQUENCE = /[\u00c2\u00c3\u00e2][\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/u;

function decodeWindows1252BytesAsUtf8(value: string) {
  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0xff) bytes.push(codePoint);
    else {
      const byte = WINDOWS_1252_SPECIAL_BYTES.get(codePoint);
      if (byte === undefined) return null;
      bytes.push(byte);
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

export function repairTextEncoding(value: unknown): string {
  let repaired = String(value ?? "");
  for (let pass = 0; pass < 2 && MOJIBAKE_SEQUENCE.test(repaired); pass += 1) {
    const decoded = decodeWindows1252BytesAsUtf8(repaired);
    if (!decoded || decoded === repaired) break;
    repaired = decoded;
  }
  return repaired.normalize("NFC");
}

export function normalizeName(value: unknown): string {
  return repairTextEncoding(value)
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(/&/g, " E ")
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeHeader(value: unknown): string {
  return normalizeName(value).toLowerCase().replace(/\s+/g, "_");
}

export function normalizeUuid(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidCnpj(value: unknown): boolean {
  const cnpj = onlyDigits(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(
    `${cnpj.slice(0, 12)}${first}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return cnpj.endsWith(`${first}${second}`);
}

export function indexToColumnLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error("Invalid column index");
  let current = index + 1;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

export function columnLetterToIndex(letter: string): number | null {
  const normalized = letter.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return null;
  let result = 0;
  for (const character of normalized) {
    result = result * 26 + character.charCodeAt(0) - 64;
  }
  return result - 1;
}

export function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 && value <= MAX_DATABASE_INT
      ? value
      : null;
  }

  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\+?\d+(?:[.,]0+)?$/.test(normalized)) return null;
  const integerPart = normalized.replace(/^\+/, "").split(/[.,]/, 1)[0];
  const parsed = Number(integerPart);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MAX_DATABASE_INT
    ? parsed
    : null;
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
  }

  return previous[right.length];
}

function similarity(left: string, right: string): number {
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 1 : 1 - levenshteinDistance(left, right) / longest;
}

export function nameSimilarity(leftValue: string, rightValue: string): number {
  const left = normalizeName(leftValue);
  const right = normalizeName(rightValue);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const sortedLeft = left.split(" ").sort().join(" ");
  const sortedRight = right.split(" ").sort().join(" ");
  const significantLeft = significantNameTokens(left).sort().join(" ");
  const significantRight = significantNameTokens(right).sort().join(" ");
  return Math.max(
    similarity(left, right),
    similarity(sortedLeft, sortedRight),
    similarity(significantLeft, significantRight),
  );
}

const IGNORED_NAME_TOKENS = new Set(["DA", "DAS", "DE", "DO", "DOS", "E"]);

export function significantNameTokens(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((token) => token.length > 1 && !IGNORED_NAME_TOKENS.has(token));
}

export function tokenOverlap(leftValue: string, rightValue: string): number {
  const left = new Set(significantNameTokens(leftValue));
  const right = new Set(significantNameTokens(rightValue));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.max(left.size, right.size);
}
