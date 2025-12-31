import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/database";
import { hashPassword } from "@/lib/auth/password";
import { randomBytes } from "crypto";
import { publishMessage, EVENTS, EXCHANGES } from "@repo/events";



const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    
    // Rate Limiting (Same as Login: 5 attempts per minute)
    // Adjust limit as needed for registration (maybe stricter?)
    const { success } = await import("@/lib/security/rate-limit").then(m => m.rateLimit(ip, "register", 5, 60));
    
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json();
    const { email, password, name } = registerSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (existingUser.status === "PROVISIONED") {
        // SMART RETRY: User exists but hasn't verified.
        // We allow them to "register" again, which effectively just resends the email.
        
        // 1. Verify Password matches (Security Check - Optional but good for privacy)
        // Actually, for "Resend", we don't strictly need to check password if we are just re-sending to the registered email.
        // But to prevent enumeration, we should theoretically check. 
        // However, standard flow is: if input matches, we resend. 
        // If someone else tries to register with your unverified email, they trigger a resend to YOU. This is safe.
        
        console.log(`Smart Retry: Resending verification for ${email}`);
        
        // Regenerate Token
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await prisma.emailVerificationToken.create({
            data: {
                userId: existingUser.id,
                token,
                expiresAt
            }
        });

        // Publish Event
        await publishMessage(EXCHANGES.USER, EVENTS.USER_EMAIL_VERIFICATION_TOKEN_CREATED, {
            userId: existingUser.id,
            email: existingUser.email,
            token,
            expiresAt: expiresAt.toISOString()
        });
        
        return NextResponse.json(
            { message: "Verification email resent." },
            { status: 200 }
        );
      }

      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
        status: "PROVISIONED", // Needs verification
      },
    });
    console.log("CreateUser: User Created", user.id);

    // Generate Verification Token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24h

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Publish Event
    console.log("CreateUser: Publishing Event...");
    await publishMessage(EXCHANGES.USER,EVENTS.USER_EMAIL_VERIFICATION_TOKEN_CREATED, {
      userId: user.id,
      email,
      token,
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.json(
      { message: "User created. Please verify your email." },
      { status: 201 }
    );


  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
