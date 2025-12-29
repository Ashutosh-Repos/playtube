import { NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth/token";
import { z } from "zod";
import { AUTH_TOKEN, REFRESH_TOKEN } from "@/lib/auth/cookie";



export async function GET(request: Request) {
  try {
    const { validateSession } = await import("@/lib/auth/session");
    const payload = await validateSession();
    
    if (!payload) {
        // If session is invalid/revoked, kill cookies and return 401
        const cookieStore = await cookies();
        cookieStore.delete(AUTH_TOKEN);
        cookieStore.delete(REFRESH_TOKEN);
        return NextResponse.json({ error: "Session revoked" }, { status: 401 });
    }

    let currentFamilyId = payload.familyId;

    // List ACTIVE sessions (not revoked, not expired)
    const sessions = await prisma.refreshToken.findMany({
      where: {
        userId: payload.sub as string,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true, // [NEW] Show last active
        familyId: true,   // [NEW] For matching
        expiresAt: true,
      },
      orderBy: { lastUsedAt: "desc" }, // Sort by most recently used
    });

    // Transform for frontend
    const safeSessions = sessions.map(s => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      isCurrent: s.familyId === currentFamilyId, // [NEW]
    }));

    return NextResponse.json({ sessions: safeSessions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const deleteSessionSchema = z.object({
  id: z.string(),
});

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = deleteSessionSchema.parse(body);

    // Simplified Revocation: Just call the library function.
    // Logic: findByTokenHash -> get familyId -> updateMany(revokedAt)
    // We do NOT need to verify "ownership" here exhaustively because we only get the ID.
    // Wait, the `id` from the body is the `RefreshToken.id` (PK).
    // We should look up via ID, find FamilyID, then revoke.

    const targetSession = await prisma.refreshToken.findFirst({
        where: { id, userId: payload.sub as string }
    });

    if (!targetSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Revoke Family
    await prisma.refreshToken.updateMany({
        where: { familyId: targetSession.familyId },
        data: { revokedAt: new Date() }
    });



    // CHECK: Is this the CURRENT session?
    // We check if the current cookie belongs to the SAME family.
    const currentRefreshToken = cookieStore.get(REFRESH_TOKEN)?.value;

    if (currentRefreshToken) {
        const crypto = await import("crypto");
        const currentTokenHash = crypto.createHash("sha256").update(currentRefreshToken).digest("hex");
        
        const currentDbToken = await prisma.refreshToken.findUnique({
            where: { tokenHash: currentTokenHash }
        });

        if (currentDbToken && currentDbToken.familyId === targetSession.familyId) {
            // console.log("[REVOKE] MATCH FOUND (Family)! Deleting cookies.");
            cookieStore.delete(AUTH_TOKEN);
            cookieStore.delete(REFRESH_TOKEN);
            return NextResponse.json({ message: "Session revoked and logged out" });
        }
    }

    return NextResponse.json({ message: "Session revoked" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
