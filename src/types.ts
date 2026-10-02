/** Primitive passthrough objects keep full fidelity without over-constraining */
export type Passthrough = Record<string, unknown>;

export interface DashboardTitleDto {
  Text?: string;
  [key: string]: unknown;
}

export interface ComponentDto {
  Id: number | string;
  Type: string;
  DataSourceId?: number | string | null;
  QueryId?: number | string | null;
  DataFields?: unknown[];
  Filter?: unknown;
  /** JSON-in-JSON string */
  Options?: string | null;
  /** JSON-in-JSON string */
  Interactivity?: string | null;
  [key: string]: unknown;
}

export interface DataSourceDto {
  Id: number | string;
  Name?: string;
  SourceType: number;
  DataBase?: Passthrough | null;
  WebApi?: Passthrough | null;
  Federation?: Passthrough | null;
  [key: string]: unknown;
}

export interface DashboardParameterDto {
  [key: string]: unknown;
}

export interface DashboardDto {
  Id?: string;
  IsDefault?: boolean;
  Title: DashboardTitleDto;
  DataSources: DataSourceDto[];
  Components?: ComponentDto[] | null;
  /** JSON-in-JSON string (react-grid-layout) */
  Layout?: string | null;
  Parameters?: DashboardParameterDto[];
  /** JSON-in-JSON string */
  Options?: string | null;
}

export interface DashboardMeta {
  id: string;
  name: string;
  isDefault: boolean;
  path: string;
}

export interface CommonResponseError {
  Code?: string | null;
  code?: string | null;
  Messages?: unknown;
}

/** Envelope arrives camelCase ({data, error}) from ASP.NET; dashboard/file payloads stay PascalCase. */
export interface CommonResponse<T> {
  Data?: T | null;
  data?: T | null;
  Error?: CommonResponseError;
  error?: CommonResponseError;
}
