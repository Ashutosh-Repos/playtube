import { prisma } from "@repo/database";

export enum AuditAction {
  USER_BAN = "USER_BAN",
  USER_UNBAN = "USER_UNBAN",
  USER_SUSPEND = "USER_SUSPEND",
  USER_UNSUSPEND = "USER_UNSUSPEND",
  USER_UPDATE = "USER_UPDATE",
  REPORT_RESOLVE = "REPORT_RESOLVE",
}

interface CreateAuditLogParams {
  actorId: string;
  action: AuditAction | string;
  resource: string;
  resourceId: string;
  targetUserId?: string;
  reason?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: CreateAuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        targetUserId: params.targetUserId,
        reason: params.reason,
        metadata: params.metadata,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // We don't throw here to avoid failing the main action if logging fails,
    // but in a high-security context, we might want to ensure logging succeeds.
  }
}
