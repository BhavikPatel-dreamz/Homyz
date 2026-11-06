/**
 * Mobile Device Registry Service - Phase 8
 * Manages device tokens, client metadata, user push preferences, and lifecycle.
 */

import { MobileDeviceRecord, DevicePreferences, MobilePlatform, UserPushRole } from './mobile-push-contracts';

export class MobileDeviceService {
  private static instance: MobileDeviceService;
  // Primary device registry store (in-memory with lifecycle awareness)
  private devices: Map<string, MobileDeviceRecord> = new Map();

  private constructor() {
    this.seedDefaultMockDevices();
  }

  public static getInstance(): MobileDeviceService {
    if (!MobileDeviceService.instance) {
      MobileDeviceService.instance = new MobileDeviceService();
    }
    return MobileDeviceService.instance;
  }

  private seedDefaultMockDevices(): void {
    const defaultPref: DevicePreferences = {
      quietHoursEnabled: false,
      criticalOnly: false,
      categoriesEnabled: ['PRICING_ALERT', 'BOOKING_REQUEST', 'PAYOUT_UPDATE', 'SYSTEM_ALERT'],
    };

    // Pre-populate an admin device and a host device for readiness testing
    this.devices.set('dev_admin_ios_01', {
      deviceId: 'dev_admin_ios_01',
      userId: 'usr_admin_1',
      role: 'ADMIN',
      platform: 'IOS',
      token: 'apns_token_mock_admin_1234567890abcdef',
      appVersion: '2.4.0',
      deviceModel: 'iPhone 15 Pro',
      osVersion: 'iOS 17.4',
      pushEnabled: true,
      preferences: defaultPref,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    });

    this.devices.set('dev_host_android_01', {
      deviceId: 'dev_host_android_01',
      userId: 'usr_host_1',
      role: 'HOST',
      platform: 'ANDROID',
      token: 'fcm_token_mock_host_9876543210fedcba',
      appVersion: '2.4.0',
      deviceModel: 'Google Pixel 8',
      osVersion: 'Android 14',
      pushEnabled: true,
      preferences: {
        ...defaultPref,
        quietHoursEnabled: true,
        quietHoursStartUTC: '22:00',
        quietHoursEndUTC: '07:00',
      },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    });
  }

  /**
   * Register or update a mobile device token
   */
  public registerDevice(params: {
    deviceId: string;
    userId: string;
    role: UserPushRole;
    platform: MobilePlatform;
    token: string;
    appVersion?: string;
    deviceModel?: string;
    osVersion?: string;
    preferences?: Partial<DevicePreferences>;
  }): MobileDeviceRecord {
    const existing = this.devices.get(params.deviceId);
    const defaultPreferences: DevicePreferences = {
      quietHoursEnabled: false,
      criticalOnly: false,
      categoriesEnabled: ['PRICING_ALERT', 'BOOKING_REQUEST', 'PAYOUT_UPDATE', 'SYSTEM_ALERT'],
    };

    const record: MobileDeviceRecord = {
      deviceId: params.deviceId,
      userId: params.userId,
      role: params.role,
      platform: params.platform,
      token: params.token,
      appVersion: params.appVersion || existing?.appVersion,
      deviceModel: params.deviceModel || existing?.deviceModel,
      osVersion: params.osVersion || existing?.osVersion,
      pushEnabled: true,
      preferences: {
        ...defaultPreferences,
        ...(existing?.preferences || {}),
        ...(params.preferences || {}),
      },
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    this.devices.set(params.deviceId, record);
    return record;
  }

  /**
   * Revoke/Disable a device token
   */
  public revokeDevice(deviceId: string, userId?: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;
    if (userId && device.userId !== userId) {
      throw new Error('Forbidden: Cannot revoke device belonging to another user');
    }
    this.devices.delete(deviceId);
    return true;
  }

  /**
   * Get all registered devices for a specific user
   */
  public getUserDevices(userId: string): MobileDeviceRecord[] {
    return Array.from(this.devices.values()).filter((d) => d.userId === userId && d.pushEnabled);
  }

  /**
   * Get all registered devices for a specific role (e.g., all admins or all hosts)
   */
  public getDevicesByRole(role: UserPushRole): MobileDeviceRecord[] {
    return Array.from(this.devices.values()).filter((d) => d.role === role && d.pushEnabled);
  }

  /**
   * Get device by ID
   */
  public getDeviceById(deviceId: string): MobileDeviceRecord | null {
    return this.devices.get(deviceId) || null;
  }

  /**
   * List all registered devices (for admin telemetry)
   */
  public getAllDevices(): MobileDeviceRecord[] {
    return Array.from(this.devices.values());
  }

  /**
   * Update device preferences (quiet hours, category filters)
   */
  public updatePreferences(deviceId: string, userId: string, preferences: Partial<DevicePreferences>): MobileDeviceRecord {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error(`Device not found: ${deviceId}`);
    if (device.userId !== userId) throw new Error('Forbidden: Cannot update device belonging to another user');

    device.preferences = {
      ...device.preferences,
      ...preferences,
    };
    device.lastActiveAt = new Date().toISOString();
    this.devices.set(deviceId, device);
    return device;
  }

  /**
   * Remove inactive/expired devices
   */
  public pruneInactiveDevices(olderThanDays: number = 90): number {
    const cutoff = Date.now() - olderThanDays * 86400 * 1000;
    let pruned = 0;
    for (const [id, dev] of this.devices.entries()) {
      if (new Date(dev.lastActiveAt).getTime() < cutoff) {
        this.devices.delete(id);
        pruned++;
      }
    }
    return pruned;
  }
}

export const mobileDeviceService = MobileDeviceService.getInstance();

