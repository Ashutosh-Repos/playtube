"use server";

import { z } from "zod";
import { prisma } from "@repo/database";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { createSession, revokeSession } from "@/lib/auth/session";
import { validateSession } from "@/lib/auth/session-server";
import { cookies, headers } from "next/headers";
import { AUTH_TOKEN, REFRESH_TOKEN, getCookieOptions } from "@/lib/auth/cookie";
import { rateLimit } from "@/lib/security/rate-limit";
import { redirect } from "next/navigation";
import { publishMessage, EVENTS, EXCHANGES } from "@repo/events";
import { randomBytes, createHash, randomUUID } from "crypto";

import { 
  loginSchema, 
  registerSchema, 
  requestResetSchema, 
  resetPasswordSchema, 
  changePasswordSchema 
} from "@/lib/auth/schemas";

export type AuthState = {
  error?: string;
  success?: boolean;
  message?: string;
};

export async function loginAction(data: z.infer<typeof loginSchema> & { redirectTo?: string }): Promise<AuthState> {
  const { email, password, redirectTo = "/" } = data;
  
  // Prevent Open Redirects
  let safeRedirectTo = redirectTo;
  if (!safeRedirectTo.startsWith("/") || safeRedirectTo.startsWith("//")) {
      safeRedirectTo = "/";
  }

  // 1. Validation
  const validated = loginSchema.safeParse({ email, password });
  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const { email: safeEmail, password: safePassword } = validated.data;

  // 2. Rate Limiting
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for") || "unknown";
  const { success } = await rateLimit(ip, "login");
  
  if (!success) {
    return { error: "Too many login attempts. Try again later." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: safeEmail },
    });

    if (!user || !user.passwordHash) {
      return { error: "Invalid credentials" };
    }

    if (user.status === "BANNED") {
        return { error: "Account Banned" };
    }

    if (user.status === "SUSPENDED") {
        if (!user.suspendedUntil) {
             return { error: `Account Suspended: ${user.suspendedReason || "Violation"}` };
        }

        if (new Date() > user.suspendedUntil) {
           await prisma.user.update({
               where: { id: user.id },
               data: { status: "ACTIVE", suspendedUntil: null, suspendedReason: null }
           });
           user.status = "ACTIVE"; 
        } else {
           return { error: `Account Suspended until ${user.suspendedUntil.toLocaleDateString()}` };
        }
    }

    if (user.status === "PROVISIONED") {
      redirect(`/verify-email?email=${encodeURIComponent(user.email)}`);
    }

    const isValid = await verifyPassword(safePassword, user.passwordHash);

    if (!isValid) {
      return { error: "Invalid credentials" };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const userAgent = headerStore.get("user-agent") || "unknown";

    const { refreshToken, accessToken } = await createSession(user.id, userAgent, ip);

    const cookieStore = await cookies();
    cookieStore.set(REFRESH_TOKEN, refreshToken, getCookieOptions("refresh"));
    cookieStore.set(AUTH_TOKEN, accessToken, getCookieOptions("access"));

  } catch (error) {
    if ((error as any).digest?.startsWith("NEXT_REDIRECT")) {
        throw error;
    }
    console.error("Login Error:", error);
    return { error: "Internal Server Error" };
  }

  redirect(safeRedirectTo);
}

export async function registerAction(data: z.infer<typeof registerSchema>): Promise<AuthState> {
  const { name, email, password } = data;

  const validated = registerSchema.safeParse({ name, email, password });
  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const { name: safeName, email: safeEmail, password: safePassword } = validated.data;

  // Rate Limiting
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for") || "unknown";
  const { success } = await rateLimit(ip, "register", 5, 60);

  if (!success) {
    return { error: "Too many requests. Please try again later." };
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: safeEmail },
    });

    if (existingUser) {
      if (existingUser.status === "PROVISIONED") {
        console.log(`Smart Retry: Resending verification for ${safeEmail}`);
        
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await prisma.emailVerificationToken.create({
            data: { userId: existingUser.id, token, expiresAt }
        });

        await publishMessage(EXCHANGES.USER, EVENTS.USER_EMAIL_VERIFICATION_TOKEN_CREATED, {
            userId: existingUser.id,
            email: existingUser.email,
            token,
            expiresAt: expiresAt.toISOString()
        });
        
        return { success: true }; 
      }
      return { error: "User already exists" };
    }

    const hashedPassword = await hashPassword(safePassword);

    const user = await prisma.user.create({
      data: {
        email: safeEmail,
        passwordHash: hashedPassword,
        name: safeName,
        status: "PROVISIONED",
      },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.emailVerificationToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    await publishMessage(EXCHANGES.USER, EVENTS.USER_EMAIL_VERIFICATION_TOKEN_CREATED, {
      userId: user.id,
      email: safeEmail,
      token,
      expiresAt: expiresAt.toISOString(),
    });

    return { success: true };

  } catch (error) {
    console.error("Register Error:", error);
    return { error: "Internal Server Error" };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN)?.value;

  if (refreshToken) {
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    await revokeSession(tokenHash);
  }

  cookieStore.delete(REFRESH_TOKEN);
  cookieStore.delete(AUTH_TOKEN);
  
  redirect("/login");
}

/* -------------------------------------------------------------------------- */
/*                              Password Management                           */
/* -------------------------------------------------------------------------- */



export async function changePasswordAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;

  const validated = changePasswordSchema.safeParse({ currentPassword, newPassword });
  if (!validated.success) return { error: validated.error.errors[0].message };

  try {
    const session = await validateSession();

    if (!session) return { error: "Unauthorized" };

    const user = await prisma.user.findUnique({ where: { id: session.sub as string } });
    if (!user || !user.passwordHash) return { error: "User not found" };

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) return { error: "Incorrect current password" };

    const newPasswordHash = await hashPassword(newPassword);

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

    const cookieStore = await cookies();
    cookieStore.delete(REFRESH_TOKEN);
    cookieStore.delete(AUTH_TOKEN);

  } catch (error) {
    console.error("Change Password Error:", error);
    return { error: "Internal Server Error" };
  }
  
  redirect("/login?message=PasswordChanged");
}



export async function requestPasswordResetAction(data: z.infer<typeof requestResetSchema>): Promise<AuthState> {
  const { email } = data;
  const validated = requestResetSchema.safeParse({ email });
  
  if (!validated.success) return { error: validated.error.errors[0].message };

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      await publishMessage(EXCHANGES.USER, EVENTS.USER_PASSWORD_RESET_TOKEN_CREATED, {
        userId: user.id,
        email,
        token,
        expiresAt: expiresAt.toISOString(),
      });
    }
    return { success: true }; // Silent success
  } catch (error) {
    console.error("Request Reset Error:", error);
    return { error: "Internal Server Error" };
  }
}



export async function resetPasswordAction(data: z.infer<typeof resetPasswordSchema>): Promise<AuthState> {
  const { token, newPassword } = data;

  const validated = resetPasswordSchema.safeParse({ token, newPassword });
  if (!validated.success) return { error: validated.error.errors[0].message };

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!resetToken || resetToken.expiresAt < new Date()) {
      return { error: "Invalid or expired token" };
    }

    const user = await prisma.user.findUnique({ where: { id: resetToken.userId } });
    if (!user) return { error: "User not found" };

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.passwordResetToken.delete({ where: { id: resetToken.id } }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { revokedAt: new Date() },
      }),
    ]);

  } catch (error) {
    console.error("Reset Password Error:", error);
    return { error: "Internal Server Error" };
  }

  redirect("/login?message=PasswordResetSuccess");
}

/* -------------------------------------------------------------------------- */
/*                              Email Verification                            */
/* -------------------------------------------------------------------------- */

export async function verifyEmailAction(token: string): Promise<AuthState> {
  if (!token) return { error: "Missing token" };

  try {
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) return { error: "Invalid token" };
    if (new Date() > verificationToken.expiresAt) return { error: "Token expired" };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: new Date(), status: "ACTIVE" },
      }),
      prisma.emailVerificationToken.delete({ where: { id: verificationToken.id } }),
    ]);

    return { success: true, message: "Email verified successfully!" };
  } catch (error) {
    console.error("Verify Email Error:", error);
    return { error: "Internal Server Error" };
  }
}

export async function resendVerificationAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email") as string;
  
  try {
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for") || "unknown";
    const { success } = await rateLimit(ip, "resend_email", 3, 60);

    if (!success) return { error: "Too many requests" };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { success: true }; // Silent
    if (user.status !== "PROVISIONED") return { error: "Account already verified" };

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.emailVerificationToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    await publishMessage(EXCHANGES.USER, EVENTS.USER_EMAIL_VERIFICATION_TOKEN_CREATED, {
      userId: user.id,
      email: user.email,
      token,
      expiresAt: expiresAt.toISOString(),
    });


    return { success: true };
  } catch (error) {
    console.error("Resend Verification Error:", error);
    return { error: "Internal Server Error" };
  }
}

/* -------------------------------------------------------------------------- */
/*                              Session Management                            */
/* -------------------------------------------------------------------------- */

export async function getSessionsAction() {
  try {
    const payload = await validateSession();

    if (!payload) return { error: "Unauthorized" };

    const currentFamilyId = payload.familyId;

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
        lastUsedAt: true,
        familyId: true,
        expiresAt: true,
      },
      orderBy: { lastUsedAt: "desc" },
    });

    const safeSessions = sessions.map(s => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      isCurrent: s.familyId === currentFamilyId,
    }));

    return { success: true, sessions: safeSessions };
  } catch (error) {
    console.error("Get Sessions Error:", error);
    return { error: "Internal Server Error" };
  }
}

export async function revokeSessionByIdAction(sessionId: string) {
  try {
    const payload = await validateSession();

    if (!payload) return { error: "Unauthorized" };

    const targetSession = await prisma.refreshToken.findFirst({
      where: { id: sessionId, userId: payload.sub as string },
    });

    if (!targetSession) return { error: "Session not found" };

    if (targetSession.tokenHash) {
       await revokeSession(targetSession.tokenHash);
    } else {
       // Fallback if no hash (should not happen for valid sessions) or just DB revoke
       await prisma.refreshToken.updateMany({
        where: { familyId: targetSession.familyId },
        data: { revokedAt: new Date() },
       });
    }

    // Check if we just revoked our OWN session
    if (targetSession.familyId === payload.familyId) {
      const cookieStore = await cookies();
      cookieStore.delete(AUTH_TOKEN);
      cookieStore.delete(REFRESH_TOKEN);
      return { success: true, isCurrent: true };
    }

    return { success: true, isCurrent: false };

  } catch (error) {
    console.error("Revoke Session Error:", error);
    return { error: "Internal Server Error" };
  }
}
