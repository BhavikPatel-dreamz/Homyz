import type { AccountingProvider } from "./accounting-contracts";

export interface OAuthProviderConfig {
  provider: AccountingProvider;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  revocationUrl?: string;
  scopes: string[];
  redirectUri: string;
}

export interface OAuthTokenBundle {
  provider: AccountingProvider;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix epoch ms
  scope: string;
  tenantId?: string; // realmId (QuickBooks) or tenantId (Xero)
  tenantName?: string;
  connectedByActorId: string;
  connectedAt: string; // ISO 8601
}

export interface EncryptedOAuthRecord {
  provider: AccountingProvider;
  encryptedData: string; // Base64 ciphertext
  iv: string; // Base64 IV
  authTag: string; // Base64 Auth Tag
  tenantId?: string;
  tenantName?: string;
  expiresAt: number;
  updatedAt: string;
}

export interface OAuthAuthorizationIntent {
  provider: AccountingProvider;
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}

