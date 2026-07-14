export type ImportIssueSeverity = "error" | "warning";

export type ImportIssueCode =
  | "MISSING_SHEET"
  | "HEADER_NOT_FOUND"
  | "COLUMN_NOT_FOUND"
  | "INVALID_UUID"
  | "MISSING_NAME"
  | "INVALID_POINTS"
  | "UNSAFE_POINTS_TOTAL"
  | "CONFLICTING_COURIER_DATA"
  | "COURIER_OMITTED_FROM_REIMPORT"
  | "INVALID_DATE"
  | "PERIOD_MISMATCH"
  | "PERIOD_CLOSED"
  | "MULTIPLE_PERIODS"
  | "INVALID_CNPJ"
  | "MISSING_CNPJ_NAME"
  | "CNPJ_AMBIGUOUS"
  | "CNPJ_NOT_FOUND";

export interface ImportIssue {
  code: ImportIssueCode;
  severity: ImportIssueSeverity;
  message: string;
  row?: number;
  count?: number;
}

export interface ImportColumn {
  /** Zero-based array index used by the parser. */
  index: number;
  /** One-based Excel position (A=1, R=18). */
  position: number;
  letter: string;
  header: string;
  normalizedHeader: string;
  nonEmptyCount: number;
  integerCount: number;
  invalidIntegerCount: number;
  canBePoints: boolean;
}

export interface CourierAggregate {
  externalCourierId: string;
  name: string;
  normalizedName: string;
  points: number;
  sourceRowCount: number;
  firstSourceRow: number;
  plaza: string | null;
  subPlaza: string | null;
  tag: string | null;
  source: string | null;
  warnings: ImportIssue[];
}

export interface CnpjSourceEntry {
  sourceName: string;
  normalizedName: string;
  cnpj: string;
  sourceRow: number;
  sourceKey: string;
}

export type CnpjMatchKind =
  | "EXACT"
  | "FUZZY"
  | "AMBIGUOUS"
  | "NOT_FOUND";

export interface CnpjMatch {
  externalCourierId: string;
  kind: CnpjMatchKind;
  score: number | null;
  cnpj: string | null;
  sourceName: string | null;
  sourceKeys: string[];
}

export interface ParsedImportWorkbook {
  filename: string;
  fileHash: string;
  dataSheet: string;
  cnpjSheet: string;
  dataHeaderRow: number;
  cnpjHeaderRow: number;
  columns: ImportColumn[];
  pointsColumn: ImportColumn;
  rowCount: number;
  aggregates: CourierAggregate[];
  cnpjEntries: CnpjSourceEntry[];
  cnpjMatches: Map<string, CnpjMatch>;
  detectedPeriodKeys: string[];
  selectedPeriodKey: string | null;
  totalPoints: number;
  issues: ImportIssue[];
  canCommit: boolean;
}

export interface ParseImportOptions {
  filename: string;
  pointsColumn?: string | number | null;
  periodKey?: string | null;
}

export interface ImportPreviewResponse {
  filename: string;
  fileHash: string;
  sheets: {
    data: string;
    cnpj: string;
    dataHeaderRow: number;
    cnpjHeaderRow: number;
  };
  columns: ImportColumn[];
  selection: {
    pointsColumn: string;
    pointsColumnIndex: number;
    pointsColumnPosition: number;
    pointsColumnLetter: string;
    periodKey: string | null;
    detectedPeriodKeys: string[];
  };
  summary: {
    rows: number;
    couriers: number;
    totalPoints: number;
    cnpjRegistryEntries: number;
    cnpjMatches: {
      exact: number;
      fuzzy: number;
      ambiguous: number;
      notFound: number;
    };
    errors: number;
    warnings: number;
  };
  issues: ImportIssue[];
  canCommit: boolean;
  duplicate: boolean;
  duplicateBatchId: string | null;
}
