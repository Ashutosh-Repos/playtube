"use server";

import { prisma } from "@repo/database";
import { getCurrentUserAction } from "./auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const updateUserSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  location: z.string().max(100).optional(),
  bannerUrl: z.string().url().optional(),
});

/**
 * Fetch the full user profile from the database.
 * Distinct from getCurrentUserAction (which gets session info).
 * Includes detailed fields like bannerUrl, bio, social links, etc.
 */
export async function fetchUserProfile() {
  const user = await getCurrentUserAction();
  if (!user?.id) return null;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bannerUrl: true, // Corrected from bannerImage
        bio: true,
        emailVerified: true,
        role: true,
        status: true,
        createdAt: true,
        primaryChannelId: true,
        websiteUrl: true,
        location: true,
      },
    });
    return dbUser;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return null;
  }
}

export async function updateUserAction(data: z.infer<typeof updateUserSchema>) {
    const user = await getCurrentUserAction();
    if (!user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    const validated = updateUserSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: validated.error.errors[0].message };
    }

    try {
        await prisma.user.update({
            where: { id: user.id },
            data: {
                ...validated.data,
                // Handle empty string for url as null if needed, but schema allows it.
            }
        });

        revalidatePath("/account");
        revalidatePath("/studio");
        return { success: true };
    } catch (error) {
        console.error("Failed to update user:", error);
        return { success: false, error: "Failed to update user" };
    }
}
