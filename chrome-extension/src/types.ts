export type NativeUrlKey = 'scheme' | 'host' | 'hostname' | 'port' | 'path' | 'pathname' | 'query' | 'origin' | 'fullUrl';

export type CustomRuleMode = 'fixed' | 'query' | 'template' | 'regex' | 'hostVariant' | 'pathSegment';

export interface CustomUrlRule {
  name: string;
  mode: CustomRuleMode;
  value?: string;
  source?: NativeUrlKey;
  pattern?: string;
  flags?: string;
  group?: number;
}

export interface ExtensionSettings {
  endpoint: string;
  token: string;
  maxResults: number;
  autoSearchOnLoad: boolean;
  autoFillSingleResult: boolean;
  allowOverwrite: boolean;
  fetchSensitiveOnDemand: boolean;
  nativeUrlKeys: NativeUrlKey[];
  customUrlRules: CustomUrlRule[];
  stopOnFirstHit: boolean;
}

export interface NativeUrlParams {
  scheme: string;
  host: string;
  hostname: string;
  port: string;
  path: string;
  pathname: string;
  query: string;
  origin: string;
  fullUrl: string;
}

export interface SearchItem {
  Uuid: string;
  Database?: string;
  GroupPath?: string;
  Title?: string;
  UserName?: string;
  URL?: string;
  Notes?: string;
  Password?: string;
  OtpCurrent?: string;
  CustomFields?: Record<string, string>;
  [key: string]: unknown;
}

export interface SearchResponse {
  term: string;
  count: number;
  returned: number;
  items: SearchItem[];
}

export interface TabState {
  tabId: number;
  url: string;
  terms: string[];
  lastMatchTerm?: string;
  results: SearchItem[];
  lastError?: string;
  updatedAt: number;
}
