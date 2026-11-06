/**
 * Native Mobile Push Integration Contracts - Phase 8
 * Defines types, channel definitions, deep-link standards, and delivery statuses.
 */

export type PushChannel = 'WEB_PUSH' | 'APNS' | 'FCM' | 'IN_APP';

export type MobilePlatform = 'IOS' | 'ANDROID' | 'WEB';

export type PushNotificationUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type UserPushRole = 'ADMIN' | 'SUPER_ADMIN' | 'HOST' | 'COHOST' | 'GUEST';

export interface DevicePreferences {
  quietHoursEnabled: boolean;
  quietHoursStartUTC?: string; // HH:mm format, e.g., "22:00"
  quietHoursEndUTC?: string;   // HH:mm format, e.g., "07:00"
  criticalOnly: boolean;
  categoriesEnabled: string[]; // e.g. ["PRICING_ALERT", "BOOKING_REQUEST", "PAYOUT_UPDATE", "SYSTEM_ALERT"]
}

export interface MobileDeviceRecord {
  deviceId: string;
  userId: string;
  role: UserPushRole;
  platform: MobilePlatform;
  token: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  pushEnabled: boolean;
  preferences: DevicePreferences;
  createdAt: string;
  lastActiveAt: string;
}

export interface DeepLinkDestination {
  scheme: 'homyz://';
  targetRole: 'admin' | 'host';
  path: string; // e.g. "admin/analytics", "host/pricing/lst_123"
  fullUrl: string; // e.g. "homyz://admin/analytics?tab=pricing"
}

export interface MobilePushPayload {
  title: string;
  body: string;
  category: 'PRICING_ALERT' | 'BOOKING_REQUEST' | 'PAYOUT_UPDATE' | 'SYSTEM_ALERT';
  urgency: PushNotificationUrgency;
  deepLink?: string;
  badge?: number;
  metadata?: Record<string, unknown>;
}

export type PushDeliveryStatus = 
  | 'DELIVERED'
  | 'FAILED'
  | 'PENDING_CREDENTIALS'
  | 'SKIPPED_QUIET_HOURS'
  | 'SKIPPED_PREFERENCE_FILTER'
  | 'TOKEN_INVALID';

export interface PushDispatchResult {
  deviceId: string;
  userId: string;
  channel: PushChannel;
  status: PushDeliveryStatus;
  messageId?: string;
  error?: string;
  timestamp: string;
}

export interface PushProviderStatus {
  apns: {
    configured: boolean;
    bundleId?: string;
    keyIdConfigured: boolean;
    teamIdConfigured: boolean;
    status: 'ACTIVE' | 'PENDING_CREDENTIALS';
  };
  fcm: {
    configured: boolean;
    projectId?: string;
    clientEmailConfigured: boolean;
    status: 'ACTIVE' | 'PENDING_CREDENTIALS';
  };
  webPush: {
    configured: boolean;
    status: 'ACTIVE' | 'PENDING_CREDENTIALS';
  };
}

