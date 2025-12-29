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
    const body = await request.json();
    const { email, password, name } = registerSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
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
