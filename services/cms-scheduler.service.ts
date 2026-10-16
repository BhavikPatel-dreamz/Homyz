import { prisma } from "@/lib/db/prisma";
import { CmsScheduledActionType, CmsScheduledStatus } from "@/generated/prisma/enums";
import { cmsService } from "@/services/cms.service";
import { auditService } from "@/services/audit.service";
import type { AuthUser } from "@/lib/auth/types";
import { Role } from "@/generated/prisma/enums";

const SYSTEM_SCHEDULER_ACTOR: AuthUser = {
  id: "system-cms-scheduler",
  role: Role.ADMIN,
  email: "scheduler@system.homyz.co",
  name: "System CMS Scheduler",
  adminRoleSlug: "super_admin",
  permissions: ["*"],
};

export interface SchedulerExecutionResult {
  totalProcessed: number;
  succeeded: number;
  failed: number;
  actions: Array<{
    id: string;
    contentId: string;
    actionType: CmsScheduledActionType;
    status: CmsScheduledStatus;
    error?: string;
  }>;
}

class CmsSchedulerService {
  /**
   * Process all due scheduled publish and unpublish actions idempotently with worker locks
   */
  async executeDueScheduledActions(workerId = `worker_${Date.now()}`): Promise<SchedulerExecutionResult> {
    const now = new Date();

    // 1. Find due actions
    const dueActions = await prisma.cmsScheduledAction.findMany({
      where: {
        status: CmsScheduledStatus.PENDING,
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: "asc" },
      take: 20,
    });

    const result: SchedulerExecutionResult = {
      totalProcessed: dueActions.length,
      succeeded: 0,
      failed: 0,
      actions: [],
    };

    for (const action of dueActions) {
      // 2. Claim worker lock using optimistic lock
      const claimed = await prisma.cmsScheduledAction.updateMany({
        where: {
          id: action.id,
          status: CmsScheduledStatus.PENDING,
        },
        data: {
          status: CmsScheduledStatus.RUNNING,
          lockedAt: new Date(),
          lockedBy: workerId,
        },
      });

      if (claimed.count === 0) {
        // Already claimed by another worker instance
        continue;
      }

      try {
        if (action.actionType === CmsScheduledActionType.PUBLISH) {
          await cmsService.publishRevision(
            SYSTEM_SCHEDULER_ACTOR,
            action.contentId,
            action.versionId || undefined
          );
        } else if (action.actionType === CmsScheduledActionType.UNPUBLISH) {
          await cmsService.unpublishContent(
            SYSTEM_SCHEDULER_ACTOR,
            action.contentId
          );
        }

        // 3. Mark executed
        await prisma.cmsScheduledAction.update({
          where: { id: action.id },
          data: {
            status: CmsScheduledStatus.EXECUTED,
            executedAt: new Date(),
            lastError: null,
          },
        });

        await auditService.record({
          actorId: SYSTEM_SCHEDULER_ACTOR.id,
          actorEmail: SYSTEM_SCHEDULER_ACTOR.email,
          action: "CMS_SCHEDULE_EXECUTED",
          resourceType: "CMS_SCHEDULE",
          resourceId: action.id,
          description: `Executed scheduled ${action.actionType} for content ${action.contentId}`,
        });

        result.succeeded++;
        result.actions.push({
          id: action.id,
          contentId: action.contentId,
          actionType: action.actionType,
          status: CmsScheduledStatus.EXECUTED,
        });
      } catch (err: any) {
        const errorMessage = err?.message || String(err);

        await prisma.cmsScheduledAction.update({
          where: { id: action.id },
          data: {
            status: CmsScheduledStatus.FAILED,
            executedAt: new Date(),
            lastError: errorMessage,
          },
        });

        await auditService.record({
          actorId: SYSTEM_SCHEDULER_ACTOR.id,
          actorEmail: SYSTEM_SCHEDULER_ACTOR.email,
          action: "CMS_SCHEDULE_FAILED",
          resourceType: "CMS_SCHEDULE",
          resourceId: action.id,
          description: `Scheduled ${action.actionType} failed for content ${action.contentId}: ${errorMessage}`,
          status: "FAILURE",
          metadata: { error: errorMessage },
        });

        result.failed++;
        result.actions.push({
          id: action.id,
          contentId: action.contentId,
          actionType: action.actionType,
          status: CmsScheduledStatus.FAILED,
          error: errorMessage,
        });
      }
    }

    return result;
  }
}

export const cmsSchedulerService = new CmsSchedulerService();

