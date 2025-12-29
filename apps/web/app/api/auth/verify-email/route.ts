import { NextResponse } from "next/server";
import { prisma } from "@repo/database";



export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verificationToken) {
        return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    if (new Date() > verificationToken.expiresAt) {
        return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // Verify User
    await prisma.$transaction([
        prisma.user.update({
            where: { id: verificationToken.userId },
            data: { 
                emailVerified: new Date(),
                status: "ACTIVE" 
            }
        }),
        prisma.emailVerificationToken.delete({
            where: { id: verificationToken.id }
        })
    ]);

    // Redirect to login or success page
    // For API testing, JSON response is okay, but redirect is better for UX.
    // Let's return JSON for now to verify easily via script.
    return NextResponse.json({ message: "Email verified successfully. You can now login." });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
