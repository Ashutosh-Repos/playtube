/**
 * Database Cleanup Utilities
 *
 * Run these periodically via cron jobs to maintain database performance.
 * Recommended: Run daily during low-traffic hours.
 */
/**
 * Cleanup expired/old notifications
 * Keeps notifications for 90 days for read, 1 year for unread
 */
export async function cleanupNotifications(prisma, options) {
    const { readRetentionDays = 90, unreadRetentionDays = 365, } = options ?? {};
    const readCutoff = new Date();
    readCutoff.setDate(readCutoff.getDate() - readRetentionDays);
    const unreadCutoff = new Date();
    unreadCutoff.setDate(unreadCutoff.getDate() - unreadRetentionDays);
    // Delete old read notifications
    const readResult = await prisma.notification.deleteMany({
        where: {
            isRead: true,
            createdAt: { lt: readCutoff },
        },
    });
    // Delete very old unread notifications
    const unreadResult = await prisma.notification.deleteMany({
        where: {
            isRead: false,
            createdAt: { lt: unreadCutoff },
        },
    });
    return { deleted: readResult.count + unreadResult.count };
}
/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions(prisma) {
    const result = await prisma.session.deleteMany({
        where: {
            expires: { lt: new Date() },
        },
    });
    return { deleted: result.count };
}
/**
 * Cleanup expired refresh tokens
 */
export async function cleanupExpiredRefreshTokens(prisma) {
    const result = await prisma.refreshToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: new Date() } },
                { revokedAt: { not: null } },
            ],
        },
    });
    return { deleted: result.count };
}
/**
 * Cleanup expired email verification tokens
 */
export async function cleanupExpiredEmailTokens(prisma) {
    const result = await prisma.emailVerificationToken.deleteMany({
        where: {
            expiresAt: { lt: new Date() },
        },
    });
    return { deleted: result.count };
}
/**
 * Cleanup expired password reset tokens
 */
export async function cleanupExpiredPasswordTokens(prisma) {
    const result = await prisma.passwordResetToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: new Date() } },
                { usedAt: { not: null } },
            ],
        },
    });
    return { deleted: result.count };
}
/**
 * Cleanup processed outbox events (older than 7 days)
 */
export async function cleanupProcessedOutboxEvents(prisma, retentionDays = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const result = await prisma.outboxEvent.deleteMany({
        where: {
            processedAt: { lt: cutoff },
        },
    });
    return { deleted: result.count };
}
/**
 * Cleanup old audit logs (older than 1 year)
 */
export async function cleanupOldAuditLogs(prisma, retentionDays = 365) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const result = await prisma.auditLog.deleteMany({
        where: {
            createdAt: { lt: cutoff },
        },
    });
    return { deleted: result.count };
}
/**
 * Run all cleanup tasks
 */
export async function runAllCleanupTasks(prisma) {
    const [notifications, sessions, refreshTokens, emailTokens, passwordTokens, outboxEvents, auditLogs,] = await Promise.all([
        cleanupNotifications(prisma),
        cleanupExpiredSessions(prisma),
        cleanupExpiredRefreshTokens(prisma),
        cleanupExpiredEmailTokens(prisma),
        cleanupExpiredPasswordTokens(prisma),
        cleanupProcessedOutboxEvents(prisma),
        cleanupOldAuditLogs(prisma),
    ]);
    const total = notifications.deleted +
        sessions.deleted +
        refreshTokens.deleted +
        emailTokens.deleted +
        passwordTokens.deleted +
        outboxEvents.deleted +
        auditLogs.deleted;
    console.log(`[Cleanup] Deleted ${total} rows total`);
    console.log(`  - Notifications: ${notifications.deleted}`);
    console.log(`  - Sessions: ${sessions.deleted}`);
    console.log(`  - Refresh tokens: ${refreshTokens.deleted}`);
    console.log(`  - Email tokens: ${emailTokens.deleted}`);
    console.log(`  - Password tokens: ${passwordTokens.deleted}`);
    console.log(`  - Outbox events: ${outboxEvents.deleted}`);
    console.log(`  - Audit logs: ${auditLogs.deleted}`);
    return {
        notifications: notifications.deleted,
        sessions: sessions.deleted,
        refreshTokens: refreshTokens.deleted,
        emailTokens: emailTokens.deleted,
        passwordTokens: passwordTokens.deleted,
        outboxEvents: outboxEvents.deleted,
        auditLogs: auditLogs.deleted,
        total,
    };
}
//# sourceMappingURL=cleanup.js.map