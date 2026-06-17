export interface ExtensionSettings {
  endpoint: string;
  token: string;
  maxResults: number;
  autoSearchOnLoad: boolean;
  autoFillSingleResult: boolean;
  allowOverwrite: boolean;
  fetchSensitiveOnDemand: boolean;
  termSource: 'hostname' | 'hostnameWithPort';
  matchDefaultUrl: boolean;
  customFieldKeywords: string[];
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
  MatchedFields?: MatchedField[];
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

export interface MatchedField {
  source: 'URL' | 'CustomFields';
  key: string;
  value: string;
}
