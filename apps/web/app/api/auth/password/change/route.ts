import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/database";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth/token";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { AUTH_TOKEN, REFRESH_TOKEN } from "@/lib/auth/cookie";



const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  try {
    const { validateSession } = await import("@/lib/auth/session");
    const payload = await validateSession();
    
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized or Session Revoked" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);

    if (!isValid) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
    }

    const newPasswordHash = await hashPassword(newPassword);

    // Transaction: Update Password AND Revoke ALL Sessions
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { revokedAt: new Date() },
      }),
    ]);

    // Clear cookies to force re-login
    cookieStore.delete(REFRESH_TOKEN);
    cookieStore.delete(AUTH_TOKEN);

    return NextResponse.json({ message: "Password changed successfully. Please log in again." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
