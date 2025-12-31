import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/database";
import { randomBytes } from "crypto";
import { publishMessage, EVENTS, EXCHANGES } from "@repo/events";
import { rateLimit } from "@/lib/security/rate-limit";

const resendSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    
    // Rate Limit: 3 requests per 60 seconds per IP
    // const { success } = await rateLimit(ip);
    // if (!success) {
    //   return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    // }

    const body = await request.json();
    const { email } = resendSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Silent failure (Security: Don't reveal user existence)
      // Or return success to mislead enumeration attackers.
      // Given the "Smart Retry" in register, we can likely just say "If account exists..."
      return NextResponse.json({ message: "If account exists, email sent." }, { status: 200 });
    }

    if (user.status !== "PROVISIONED") {
      return NextResponse.json({ message: "Account already verified." }, { status: 400 });
    }

    // Regenerate Token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Publish Event
    await publishMessage(EXCHANGES.USER, EVENTS.USER_EMAIL_VERIFICATION_TOKEN_CREATED, {
      userId: user.id,
      email: user.email,
      token,
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.json({ message: "Verification email sent." }, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
