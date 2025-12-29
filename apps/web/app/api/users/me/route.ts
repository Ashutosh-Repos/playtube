import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@repo/database";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth/token";




const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  image: z.string().url().optional().or(z.literal("")),
  primaryChannelId: z.string().cuid().optional(),
});

export async function PATCH(request: Request) {
  try {
    const { validateSession } = await import("@/lib/auth/session");
    const payload = await validateSession();
    
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized or Session Revoked" }, { status: 401 });
    }

    const body = await request.json();
    const data = updateProfileSchema.parse(body);

    const updatedUser = await prisma.user.update({
      where: { id: payload.sub as string },
      data: {
        ...data,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        location: true,
        websiteUrl: true,
        bannerUrl: true,
        primaryChannelId: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
