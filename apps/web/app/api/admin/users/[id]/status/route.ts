import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/database";


export const runtime = "nodejs";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth/token";
import { createAuditLog, AuditAction } from "@/lib/audit";

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "BANNED", "SUSPENDED", "PROVISIONED"]),
  reason: z.string().min(1, "Reason is required for status changes"),
  suspendedUntil: z.string().datetime().optional(), // ISO String
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const { validateSession } = await import("@/lib/auth/session");
    const payload = await validateSession();
    
    // Check Config: Admin Role check
    if (!payload || payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { status, reason, suspendedUntil } = updateStatusSchema.parse(body);

    // Validate suspendedUntil is only for SUSPENDED status
    if (suspendedUntil && status !== "SUSPENDED") {
      return NextResponse.json(
        { error: "suspendedUntil is only valid for SUSPENDED status" },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Determine Action Type for Log
    let action = AuditAction.USER_UPDATE;
    if (status === "BANNED") action = AuditAction.USER_BAN;
    if (status === "SUSPENDED") action = AuditAction.USER_SUSPEND;
    if (status === "ACTIVE" && targetUser.status === "BANNED") action = AuditAction.USER_UNBAN;
    if (status === "ACTIVE" && targetUser.status === "SUSPENDED") action = AuditAction.USER_UNSUSPEND;

    // Transaction: Update User + Revoke Sessions (if needed)
    // If Banning or Suspending, strictly revoke sessions to kill access immediately.
    const shouldRevoke = status === "BANNED" || status === "SUSPENDED";

    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: { 
                status,
                // Update suspendedReason if Suspending, clear it if activating
                suspendedReason: status === "SUSPENDED" ? reason : null, 
                suspendedAt: status === "SUSPENDED" ? new Date() : null,
                suspendedUntil: status === "SUSPENDED" && suspendedUntil ? new Date(suspendedUntil) : null,
            }
        });

        if (shouldRevoke) {
            await tx.refreshToken.updateMany({
                where: { userId: userId },
                data: { revokedAt: new Date() }
            });
        }
    });

    // Create Audit Log (async, outside transaction to not block or fail logic if log fails? 
    // Ideally inside, but our utility is separate. We'll await it here.)
    // We need request info for IP
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    await createAuditLog({
        actorId: payload.sub as string,
        action,
        resource: "User",
        resourceId: userId,
        targetUserId: userId,
        reason,
        ipAddress: ip,
        userAgent,
        metadata: { oldStatus: targetUser.status, newStatus: status }
    });

    return NextResponse.json({ message: `User status updated to ${status}` });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
