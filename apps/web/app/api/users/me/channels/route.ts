import { NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth/token";




export async function GET(request: Request) {
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

    const channels = await prisma.channel.findMany({
      where: { userId: payload.sub as string },
      select: {
        id: true,
        name: true,
        handle: true,
        image: true,
        subscriberCount: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ channels });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
