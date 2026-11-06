import { NextRequest, NextResponse } from 'next/server';
import { mobileDeviceService } from '@/services/admin-analytics/mobile-push/mobile-device.service';
import { mobilePushDispatcherService } from '@/services/admin-analytics/mobile-push/mobile-push-dispatcher.service';
import { MobilePlatform, UserPushRole } from '@/services/admin-analytics/mobile-push/mobile-push-contracts';

/**
 * Mobile Push API Route - Phase 8
 * GET /api/v1/admin/analytics/mobile-push
 * POST /api/v1/admin/analytics/mobile-push
 * DELETE /api/v1/admin/analytics/mobile-push
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    if (action === 'status') {
      const providers = mobilePushDispatcherService.getProviderStatus();
      const allDevices = mobileDeviceService.getAllDevices();
      return NextResponse.json({
        success: true,
        providers,
        deviceCount: allDevices.length,
        devices: allDevices.map((d) => ({
          deviceId: d.deviceId,
          userId: d.userId,
          role: d.role,
          platform: d.platform,
          appVersion: d.appVersion,
          lastActiveAt: d.lastActiveAt,
        })),
      });
    }

    if (action === 'history') {
      const history = mobilePushDispatcherService.getDispatchHistory(50);
      return NextResponse.json({
        success: true,
        history,
      });
    }

    const userId = searchParams.get('userId');
    if (userId) {
      const devices = mobileDeviceService.getUserDevices(userId);
      return NextResponse.json({
        success: true,
        devices,
      });
    }

    return NextResponse.json({
      success: true,
      providers: mobilePushDispatcherService.getProviderStatus(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'register';

    if (action === 'register') {
      const { deviceId, userId, role, platform, token, appVersion, deviceModel, osVersion, preferences } = body;
      if (!deviceId || !userId || !platform || !token) {
        return NextResponse.json(
          { success: false, error: 'Missing required device registration fields' },
          { status: 400 }
        );
      }

      const registered = mobileDeviceService.registerDevice({
        deviceId,
        userId,
        role: (role as UserPushRole) || 'ADMIN',
        platform: platform as MobilePlatform,
        token,
        appVersion,
        deviceModel,
        osVersion,
        preferences,
      });

      return NextResponse.json({
        success: true,
        message: 'Device registered successfully',
        device: registered,
      });
    }

    if (action === 'dispatch') {
      const { targetRole, targetUserId, payload } = body;
      if (!payload || !payload.title || !payload.body || !payload.category || !payload.urgency) {
        return NextResponse.json(
          { success: false, error: 'Missing required push payload attributes' },
          { status: 400 }
        );
      }

      let results;
      if (targetUserId) {
        results = mobilePushDispatcherService.dispatchToUser(targetUserId, payload);
      } else if (targetRole) {
        results = mobilePushDispatcherService.dispatchToRole(targetRole, payload);
      } else {
        return NextResponse.json(
          { success: false, error: 'Must specify targetUserId or targetRole' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        dispatchedCount: results.length,
        results,
      });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const userId = searchParams.get('userId') || undefined;

    if (!deviceId) {
      return NextResponse.json({ success: false, error: 'Missing deviceId parameter' }, { status: 400 });
    }

    const revoked = mobileDeviceService.revokeDevice(deviceId, userId);
    return NextResponse.json({
      success: true,
      revoked,
      message: revoked ? 'Device revoked successfully' : 'Device not found',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

