/**
 * Database Cleanup Utilities
 *
 * Run these periodically via cron jobs to maintain database performance.
 * Recommended: Run daily during low-traffic hours.
 */
type PrismaClient = any;
/**
 * Cleanup expired/old notifications
 * Keeps notifications for 90 days for read, 1 year for unread
 */
export declare function cleanupNotifications(prisma: PrismaClient, options?: {
    readRetentionDays?: number;
    unreadRetentionDays?: number;
}): Promise<{
    deleted: number;
}>;
/**
 * Cleanup expired sessions
 */
export declare function cleanupExpiredSessions(prisma: PrismaClient): Promise<{
    deleted: number;
}>;
/**
 * Cleanup expired refresh tokens
 */
export declare function cleanupExpiredRefreshTokens(prisma: PrismaClient): Promise<{
    deleted: number;
}>;
/**
 * Cleanup expired email verification tokens
 */
export declare function cleanupExpiredEmailTokens(prisma: PrismaClient): Promise<{
    deleted: number;
}>;
/**
 * Cleanup expired password reset tokens
 */
export declare function cleanupExpiredPasswordTokens(prisma: PrismaClient): Promise<{
    deleted: number;
}>;
/**
 * Cleanup processed outbox events (older than 7 days)
 */
export declare function cleanupProcessedOutboxEvents(prisma: PrismaClient, retentionDays?: number): Promise<{
    deleted: number;
}>;
/**
 * Cleanup old audit logs (older than 1 year)
 */
export declare function cleanupOldAuditLogs(prisma: PrismaClient, retentionDays?: number): Promise<{
    deleted: number;
}>;
/**
 * Run all cleanup tasks
 */
export declare function runAllCleanupTasks(prisma: PrismaClient): Promise<{
    notifications: number;
    sessions: number;
    refreshTokens: number;
    emailTokens: number;
    passwordTokens: number;
    outboxEvents: number;
    auditLogs: number;
    total: number;
}>;
export {};
//# sourceMappingURL=cleanup.d.ts.map