import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/database";

import { hashPassword } from "@/lib/auth/password";
import crypto from "crypto";
import { EVENTS, EXCHANGES, publishMessage } from "@repo/events";



const requestResetSchema = z.object({
  email: z.string().email(),
});

const confirmResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// POST: Request Password Reset
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = requestResetSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Generate Token
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

      // Save Token
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // Send Email
      await publishMessage(EXCHANGES.USER,EVENTS.USER_PASSWORD_RESET_TOKEN_CREATED, {
        userId: user.id,
        email,
        token,
        expiresAt: expiresAt.toISOString(),
      });
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ message: "If an account exists, a reset link has been sent." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Confirm Password Reset
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { token, newPassword } = confirmResetSchema.parse(body);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: resetToken.userId } });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      // Update Password
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      }),
      // Delete Token (prevent reuse)
      prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      }),
      // Revoke ALL Sessions (security)
      prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { revokedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
